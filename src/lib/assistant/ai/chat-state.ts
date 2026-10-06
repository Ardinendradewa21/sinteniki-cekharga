import { z } from "zod";

import { ACTIVITIES, PRIORITIES, REQUIREMENTS } from "@/lib/assistant/needs";
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

/** Kebutuhan yang terkumpul sejauh percakapan berjalan. */
export const collectedSchema = z.object({
  budgetIdr: z.number().int().positive().max(500_000_000).nullable(),
  budgetIsHard: z.boolean().nullable(),
  activities: z.array(z.enum(ACTIVITIES)),
  priority: z.enum(PRIORITIES).nullable(),
  requirements: z.array(z.enum(REQUIREMENTS)),
  /** Merek yang disebut pengguna, apa adanya; dicocokkan ke katalog oleh kode. */
  brands: z.array(z.string().min(1).max(30)).max(8),
  /** true bila pengguna mewajibkan HANYA merek di atas. */
  brandsOnly: z.boolean(),
  avoidBrands: z.array(z.string().min(1).max(30)).max(8),
});
export type Collected = z.infer<typeof collectedSchema>;

export const EMPTY_COLLECTED: Collected = {
  budgetIdr: null,
  budgetIsHard: null,
  activities: [],
  priority: null,
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
  error: string | null;
};

export const CHAT_START: ChatState = {
  messages: [],
  collected: EMPTY_COLLECTED,
  suggestions: [],
  result: null,
  error: null,
};
