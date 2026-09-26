"use server";

import { z } from "zod";

import { AI_LIMITS, rateLimit } from "@/lib/assistant/ai/client";
import { runChatTurn } from "@/lib/assistant/ai/chat";
import {
  CHAT_START,
  collectedSchema,
  type ChatMessage,
  type ChatState,
} from "@/lib/assistant/ai/chat-state";
import { clientIp } from "@/lib/rate-limit";
import { recommend } from "@/lib/assistant/recommend";
import { parseNeeds } from "@/lib/assistant/needs";

/**
 * Satu giliran percakapan (PRD FR-06).
 *
 * Urutannya penting dan disengaja:
 *
 *   1. Batasi laju    — endpoint ini memanggil model berbayar (PRD §10).
 *   2. Model bicara   — mengobrol, bertanya, mengumpulkan kebutuhan.
 *   3. Kode mencari   — kalau datanya sudah cukup, `recommend()` yang
 *                       menentukan kandidat, bukan model.
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
  const collected = collectedSchema.safeParse(rawPrev.collected);
  const prev: ChatState = {
    ...CHAT_START,
    ...rawPrev,
    messages: history.data,
    collected: collected.success ? collected.data : CHAT_START.collected,
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

  const limit = rateLimit(await clientIp());
  if (!limit.allowed) {
    return {
      ...prev,
      error: `Terlalu cepat. Tunggu ${limit.retryAfterSec} detik lagi.`,
    };
  }

  // Pesan pengguna langsung masuk daftar supaya tetap terlihat walau
  // giliran berikutnya gagal. Percakapan yang menghilangkan ucapan sendiri
  // membingungkan.
  const withUser: ChatMessage[] = [...prev.messages, { role: "user", content: text }];

  const turn = await runChatTurn(prev.messages, text);

  if (!turn.ok) {
    return { ...prev, messages: withUser, suggestions: [], error: turn.reason };
  }

  const messages: ChatMessage[] = [
    ...withUser,
    { role: "assistant", content: turn.reply },
  ];

  if (!turn.enough) {
    return {
      messages,
      collected: turn.collected,
      suggestions: turn.suggestions,
      result: null,
      error: null,
    };
  }

  return {
    messages,
    collected: turn.collected,
    suggestions: [],
    result: await cariKandidat(turn.collected),
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
    prioritas: collected.priority ?? undefined,
    wajib: collected.requirements,
    wajib_jawab: "ya",
  });

  const result = await recommend(new Date(), needs);

  return {
    matches: result.matches,
    overBudget: result.overBudget,
    exclusions: result.exclusions,
    appliedHardRules: result.appliedHardRules,
  };
}
