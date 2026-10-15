"use server";

import { z } from "zod";

import { AI_LIMITS, rateLimit } from "@/lib/assistant/ai/client";
import { runChatTurn } from "@/lib/assistant/ai/chat";
import { consumeDailyQuota, quotaMessage } from "@/lib/assistant/ai/quota";
import {
  CHAT_START,
  collectedSchema,
  type ChatMessage,
  type ChatState,
} from "@/lib/assistant/ai/chat-state";
import { clientIp } from "@/lib/rate-limit";
import { recommend } from "@/lib/assistant/recommend";
import { parseNeeds } from "@/lib/assistant/needs";
import { toResultView } from "@/lib/assistant/results";
import { guardRequirements, mergeHints, readHints } from "@/lib/assistant/hints";
import { nextFocus, refinementSuggestions, shouldSearch } from "@/lib/assistant/dialog-policy";

/**
 * Satu giliran percakapan (PRD FR-06).
 *
 * Urutannya penting dan disengaja:
 *
 *   1. Batasi laju    — endpoint ini memanggil model berbayar (PRD §10):
 *                       per menit di memori, lalu kuota harian di database.
 *   2. Model bicara   — mengobrol, bertanya, mengumpulkan kebutuhan.
 *                       Kamus sinonim (`hints.ts`) menambah yang terlewat.
 *   3. Kode memutuskan — `dialog-policy.ts` menentukan kapan hasil tampil
 *                       (paling banyak dua pertanyaan sebelum hasil pertama).
 *   4. Kode mencari   — `recommend()` yang menentukan kandidat, bukan model.
 *                       Setelah hasil tampil, setiap pesan menyempurnakannya.
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

  const ip = await clientIp();
  const limit = rateLimit(ip);
  if (!limit.allowed) {
    return {
      ...prev,
      error: `Terlalu cepat. Tunggu ${limit.retryAfterSec} detik lagi.`,
    };
  }

  // Jatah harian dipakai tepat sebelum model dipanggil, setelah semua
  // validasi murah lolos, supaya pesan yang ditolak tidak memakan kuota.
  const quota = await consumeDailyQuota(ip);
  if (!quota.allowed) {
    return { ...prev, error: quotaMessage(quota.reason) };
  }

  // Pesan pengguna langsung masuk daftar supaya tetap terlihat walau
  // giliran berikutnya gagal. Percakapan yang menghilangkan ucapan sendiri
  // membingungkan.
  const withUser: ChatMessage[] = [...prev.messages, { role: "user", content: text }];

  // Petunjuk dari kamus sinonim ikut menentukan fokus pertanyaan giliran ini,
  // supaya model tidak menanyakan hal yang sudah tersirat di pesan terbaru.
  const hints = readHints(text);
  const hasResult = prev.result !== null;
  const turn = await runChatTurn(prev.messages, text, {
    collected: prev.collected,
    focus: nextFocus(mergeHints(prev.collected, hints), hasResult),
    hasResult,
  });

  if (!turn.ok) {
    return { ...prev, messages: withUser, suggestions: [], error: turn.reason };
  }

  const messages: ChatMessage[] = [
    ...withUser,
    { role: "assistant", content: turn.reply },
  ];

  const collected = mergeHints(guardRequirements(prev.collected.requirements, turn.collected, text), hints);
  const userTurns = withUser.filter((message) => message.role === "user").length;

  if (!shouldSearch(collected, { userTurns, modelEnough: turn.enough, hasResult })) {
    return {
      messages,
      collected,
      suggestions: turn.suggestions,
      result: null,
      error: null,
    };
  }

  return {
    messages,
    collected,
    suggestions: refinementSuggestions(collected),
    result: await cariKandidat(collected),
    error: null,
  };
}

async function cariKandidat(collected: ChatState["collected"]) {
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

  return toResultView(await recommend(new Date(), needs), needs);
}
