import type { Collected } from "@/lib/assistant/ai/collected-schema";
import type { ResultView } from "@/lib/assistant/results";

/**
 * Tipe dan konstanta percakapan yang dipakai bersama klien dan server.
 *
 * Modul ini SENGAJA tanpa `server-only` dan tanpa ketergantungan ke modul
 * server. Komponen chat di sisi klien membutuhkan `CHAT_START` sebagai nilai
 * awal; kalau nilai itu diimpor dari modul ber-`server-only`, seluruh kode
 * server ikut tertarik ke bundel klien dan build gagal.
 *
 * Karena itu arah ketergantungannya satu arah: modul server mengimpor dari
 * sini, tidak pernah sebaliknya.
 */

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

// Skema zod-nya ada di collected-schema.ts: impor tipe saja supaya zod tidak
// ikut ke bundel klien lewat CHAT_START.
export type { Collected } from "@/lib/assistant/ai/collected-schema";

export const EMPTY_COLLECTED: Collected = {
  budgetIdr: null,
  budgetIsHard: null,
  activities: [],
  priorities: [],
  requirements: [],
  brands: [],
  brandsOnly: false,
  avoidBrands: [],
};

/** Kandidat nyata dari mesin deterministik, bukan karangan model. */
export type ChatResult = ResultView;

export type ChatState = {
  messages: ChatMessage[];
  collected: Collected;
  suggestions: string[];
  /** Hasil pencarian; null selama masih mengobrol. */
  result: ChatResult | null;
  /** Tautan halaman perbandingan bila pengguna minta dua kandidat dibandingkan. */
  compareHref: string | null;
  error: string | null;
};

export const CHAT_START: ChatState = {
  messages: [],
  collected: EMPTY_COLLECTED,
  suggestions: [],
  result: null,
  compareHref: null,
  error: null,
};
