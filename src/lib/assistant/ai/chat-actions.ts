"use server";

import { headers } from "next/headers";

import { rateLimit } from "@/lib/assistant/ai/client";
import { runChatTurn } from "@/lib/assistant/ai/chat";
import type { ChatMessage, ChatState } from "@/lib/assistant/ai/chat-state";
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

async function clientKey(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "tanpa-ip"
  );
}

export async function sendChatMessage(
  prev: ChatState,
  formData: FormData
): Promise<ChatState> {
  const text = String(formData.get("pesan") ?? "").trim();
  if (!text) return { ...prev, error: "Tulis dulu pesannya." };

  const limit = rateLimit(await clientKey());
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
