"use server";

import { z } from "zod";

import { AI_LIMITS, rateLimit } from "@/lib/assistant/ai/client";
import { runChatTurn } from "@/lib/assistant/ai/chat";
import { consumeDailyQuota, quotaMessage } from "@/lib/assistant/ai/quota";
import { CHAT_START, type ChatMessage, type ChatState } from "@/lib/assistant/ai/chat-state";
import { collectedSchema } from "@/lib/assistant/ai/collected-schema";
import { clientIp } from "@/lib/rate-limit";
import { recommend } from "@/lib/assistant/recommend";
import { parseNeeds } from "@/lib/assistant/needs";
import { toResultView } from "@/lib/assistant/results";
import { guardRequirements, mergeHints, readHints } from "@/lib/assistant/hints";
import { compareRequest, decideTurn, nextFocus, refinementSuggestions } from "@/lib/assistant/dialog-policy";
import { fallbackResultReply, writeProductReply, writeResultReply } from "@/lib/assistant/ai/writer";
import { spreadAcrossPriceBands } from "@/lib/assistant/price-bands";
import { findProductMentions } from "@/lib/assistant/product-mentions";
import { productFacts } from "@/lib/assistant/product-facts";
import { checkReply, readAmounts } from "@/lib/assistant/reply-validator";
import { numberCandidates } from "@/lib/assistant/result-numbering";
import { loadPublishedCatalog } from "@/lib/catalog/queries";
import { buildCompareHref } from "@/lib/catalog/compare-href";

/**
 * Satu giliran percakapan (PRD FR-06).
 *
 * Urutannya penting dan disengaja:
 *
 *   1. Batasi laju    — endpoint ini memanggil model berbayar (PRD §10):
 *                       per menit di memori, lalu kuota harian di database.
 *   2. Model memahami — maksud pesan, kebutuhan, nama produk yang disebut.
 *                       Kamus sinonim (`hints.ts`) menambah yang terlewat;
 *                       nama produk dicocokkan ke katalog oleh KODE.
 *   3. Kode memutuskan — `decideTurn()`: bertanya, mencari, menjawab dari
 *                       data produk, atau menjawab pertanyaan umum (VD-08).
 *   4. Kode mengambil fakta — `recommend()` untuk rekomendasi, halaman
 *                       detail/perbandingan untuk produk yang disebut.
 *   5. Model menjelaskan — penulis balasan, diperiksa validator nama/harga.
 *
 * Riwayat percakapan datang dari klien dan kembali ke klien; tidak ada yang
 * disimpan di server (PRD §10).
 */

/**
 * State sebelumnya dikirim BALIK oleh browser, jadi statusnya masukan tidak
 * tepercaya, sama seperti FormData. Tanpa validasi ini, riwayat bisa diisi
 * pesan sepanjang apa pun lalu diteruskan ke model berbayar.
 */
const historySchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(AI_LIMITS.maxHistoryMessageChars),
    })
  )
  .max(AI_LIMITS.maxHistoryMessages);

export async function sendChatMessage(
  rawPrev: ChatState,
  formData: FormData
): Promise<ChatState> {
  const history = historySchema.safeParse(rawPrev?.messages);
  if (!history.success) {
    return {
      ...CHAT_START,
      error: "Percakapan tidak bisa dilanjutkan. Silakan mulai percakapan baru.",
    };
  }

  // Riwayat dan kebutuhan memakai versi tervalidasi. `result` dan
  // `suggestions` hanya dipantulkan balik ke klien yang sama (tidak pernah
  // dikirim ke model atau disimpan), jadi dibiarkan supaya panel hasil tidak
  // hilang saat giliran berikutnya gagal.
  const prevCollected = collectedSchema.safeParse(rawPrev.collected);
  const prev: ChatState = {
    ...CHAT_START,
    ...rawPrev,
    messages: history.data,
    collected: prevCollected.success ? prevCollected.data : CHAT_START.collected,
    error: null,
  };

  const text = String(formData.get("pesan") ?? "").trim();
  if (!text) return { ...prev, error: "Tulis dulu pesannya." };
  // Ditolak SEBELUM masuk riwayat: pesan kepanjangan yang ikut tersimpan akan
  // membuat validasi riwayat di giliran berikutnya gagal.
  if (text.length > AI_LIMITS.maxInputChars) {
    return {
      ...prev,
      error: `Pesannya terlalu panjang, maksimal ${AI_LIMITS.maxInputChars} karakter.`,
    };
  }

  // "Coba lagi" (PRD FR-06): pesan yang gagal sudah ada di riwayat; jangan
  // digandakan.
  const last = prev.messages.at(-1);
  if (formData.get("ulang") === "ya" && last?.role === "user" && last.content === text) {
    prev.messages = prev.messages.slice(0, -1);
  }

  const ip = await clientIp();
  const limit = rateLimit(ip);
  if (!limit.allowed) {
    return {
      ...prev,
      error: `Terlalu cepat. Tunggu ${limit.retryAfterSec} detik lagi.`,
      retryText: null,
    };
  }

  // Jatah harian dipakai tepat sebelum model dipanggil, setelah semua
  // validasi murah lolos, supaya pesan yang ditolak tidak memakan kuota.
  const quota = await consumeDailyQuota(ip);
  if (!quota.allowed) {
    return { ...prev, error: quotaMessage(quota.reason), retryText: null };
  }

  // Pesan pengguna langsung masuk daftar supaya tetap terlihat walau
  // giliran berikutnya gagal. Percakapan yang menghilangkan ucapan sendiri
  // membingungkan.
  const withUser: ChatMessage[] = [...prev.messages, { role: "user", content: text }];

  const now = new Date();
  const hints = readHints(text);
  const hasResult = prev.result !== null;
  const [turn, catalog] = await Promise.all([
    runChatTurn(prev.messages, text, {
      collected: prev.collected,
      focus: nextFocus(mergeHints(prev.collected, hints), hasResult),
      hasResult,
    }),
    loadPublishedCatalog(now),
  ]);

  if (!turn.ok) {
    return { ...prev, messages: withUser, suggestions: [], error: turn.reason, retryText: text };
  }

  const collected = mergeHints(guardRequirements(prev.collected.requirements, turn.collected, text), hints);
  const userTurns = withUser.filter((message) => message.role === "user").length;
  // Produk dikenali dari kalimat pengguna, lalu dari nama yang ditangkap model
  // (salah ketik ringan). Keduanya dicocokkan ke katalog terbit oleh kode.
  const mentioned = [
    ...new Set([
      ...findProductMentions(text, catalog.products),
      ...findProductMentions(turn.namedProducts.join(" | "), catalog.products),
    ]),
  ].slice(0, 3);
  const catalogNames = catalogNameList(catalog.products);

  const action = decideTurn({
    intent: turn.intent,
    mentions: mentioned.length,
    namedProducts: turn.namedProducts.length,
    collected,
    hasResult,
    userTurns,
    modelEnough: turn.enough,
  });

  /** Balasan asisten baru + lampiran; hasil lama tetap di tempatnya. */
  const reply = (content: string, extra: Partial<ChatState> = {}): ChatState => ({
    ...prev,
    messages: [...withUser, { role: "assistant", content }],
    collected,
    suggestions: [],
    compareHref: null,
    error: null,
    retryText: null,
    ...extra,
  });
  const assistantIndex = withUser.length;

  if (action === "ask" || action === "chat") {
    return reply(turn.reply, { suggestions: turn.suggestions });
  }

  if (action === "general") {
    // Jawaban umum dari model pemahaman: tanpa nama produk katalog dan tanpa
    // harga karangan (hanya angka yang disebut pengguna sendiri).
    const safe = checkReply({
      reply: turn.reply,
      allowedNames: [],
      catalogNames,
      allowedAmounts: [...readAmounts(text), ...(collected.budgetIdr ? [collected.budgetIdr] : [])],
    }).ok;
    return reply(
      safe
        ? turn.reply
        : "Pertanyaan itu menyinggung produk atau harga tertentu, jadi aku jawab dari data katalog saja. Sebutkan nama HP-nya, atau ceritakan kebutuhanmu supaya aku carikan kandidatnya.",
      { suggestions: turn.suggestions }
    );
  }

  if (action === "missing-product") {
    const names = turn.namedProducts.slice(0, 3).join(" dan ");
    return reply(
      `Aku belum menemukan ${names} di katalog CekHarga, jadi belum bisa memberi harga atau spesifikasinya dari data kami. Kalau mau, aku carikan HP lain yang mirip kebutuhannya.`,
      { suggestions: ["Carikan yang mirip"] }
    );
  }

  if (action === "product") {
    const facts = await productFacts(now, mentioned);
    if (!facts) {
      return reply("Data produk itu belum bisa dibaca sekarang. Coba lagi sebentar, atau buka katalog.", {
        retryText: text,
      });
    }
    const written = await writeProductReply({ history: prev.messages, userText: text, facts, catalogNames });
    const fallback =
      facts.cards.length > 1
        ? `Ini data ${facts.cards.map((card) => card.name).join(" dan ")} dari katalog CekHarga. Perbedaan lengkapnya ada di halaman perbandingan.`
        : `Ini data ${facts.cards[0]!.name} dari katalog CekHarga. Rincian spesifikasi dan penawarannya ada di halaman produk.`;
    return reply(written?.reply ?? fallback, {
      products: facts.cards,
      productsIndex: assistantIndex,
      productsCompareHref: facts.compareHref,
      suggestions: written?.followUps ?? [],
    });
  }

  // action === "search"
  const result = await cariKandidat(collected, now);

  /*
   * Giliran yang menampilkan hasil ditulis ulang oleh penulis balasan, yang
   * boleh menyebut produk dan harga dari hasil giliran ini (PB-39). Bila
   * penulis gagal atau ditolak validator, balasan giliran pertama yang tanpa
   * nama produk tetap dipakai, jadi percakapan tidak pernah putus.
   */
  const written = await writeResultReply({
    history: prev.messages,
    userText: text,
    collected,
    view: result,
    catalogNames,
  });
  const numbered = numberCandidates(result);
  const compareNumbers = compareRequest(text, numbered.length) ?? written?.compareNumbers ?? null;
  const compareHref = compareNumbers
    ? buildCompareHref(
        compareNumbers.map((n) => {
          const { candidate } = numbered[n - 1]!;
          return { slug: candidate.slug, variantKey: candidate.variantKey };
        })
      )
    : null;

  return reply(written?.reply ?? fallbackResultReply(result), {
    result,
    resultIndex: assistantIndex,
    compareHref,
    // Saran dari penulis (spesifik ke hasil) dulu, lalu penyempurnaan dari kode.
    suggestions: [...new Set([...(written?.followUps ?? []).slice(0, 2), ...refinementSuggestions(collected)])].slice(0, 4),
  });
}

/**
 * Nama produk terbit untuk validator: merek + model, ditambah model saja bila
 * cukup khas (mengandung huruf dan minimal 5 karakter). Model seperti "17"
 * atau "A6s" terlalu pendek dan akan salah tangkap angka di kalimat biasa.
 */
function catalogNameList(products: readonly { brand: string; model: string }[]): string[] {
  return products.flatMap((product) => {
    const names = [`${product.brand} ${product.model}`];
    if (/[a-z]/i.test(product.model) && product.model.length >= 5) names.push(product.model);
    return names;
  });
}

async function cariKandidat(collected: ChatState["collected"], now: Date) {
  /*
   * Jembatan antara hasil obrolan dan mesin rekomendasi.
   *
   * Kebutuhan dilewatkan `parseNeeds` supaya bentuknya identik dengan yang
   * datang dari jalur form, termasuk `requirementsAnswered` yang menentukan
   * apakah syarat wajib benar-benar diberlakukan sebagai penyaring keras.
   */
  const needs = parseNeeds({
    budget: collected.budgetIdr === null ? undefined : String(collected.budgetIdr),
    budget_wajib:
      collected.budgetIsHard === null ? undefined : collected.budgetIsHard ? "ya" : "tidak",
    kegiatan: collected.activities,
    prioritas: collected.priorities,
    wajib: collected.requirements,
    wajib_jawab: "ya",
    merek: collected.brands,
    merek_saja: collected.brandsOnly ? "ya" : undefined,
    hindari: collected.avoidBrands,
  });

  const found = await recommend(now, needs);
  // Tanpa budget: satu kandidat per kelas harga dulu, bukan ponsel termahal
  // yang paling cocok di atas (VD-08). Prioritas "harga" sudah murah dulu.
  const spread =
    needs.budgetIdr === null && !needs.priorities.includes("harga")
      ? { ...found, matches: spreadAcrossPriceBands(found.matches, (c) => (c.price.status === "unavailable" ? null : c.price.priceIdr)) }
      : found;
  return toResultView(spread, needs);
}
