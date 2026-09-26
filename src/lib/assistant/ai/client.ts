import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { createRateLimiter, type RateLimitResult } from "@/lib/rate-limit";

/**
 * Gerbang model bahasa (PRD §9 dan §10).
 *
 * OpenRouter bicara protokol yang sama dengan OpenAI, jadi SDK-nya dipakai
 * ulang alih-alih menambah pustaka baru. Kuncinya berasal dari InsForge dan
 * TIDAK PERNAH ber-prefix NEXT_PUBLIC: seluruh panggilan model terjadi di
 * server.
 *
 * Batas-batas di bawah bukan hiasan. PRD §10 mewajibkan rate limit, timeout,
 * panjang konteks, dan anggaran ditetapkan di server, karena biaya model itu
 * nyata dan penyalahgunaan endpoint gratis itu murah bagi penyerangnya.
 */

const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
});

/**
 * Model default dipilih lewat pengujian, bukan dari tabel harga.
 *
 * Kandidat diuji dengan kalimat Indonesia sehari-hari berisi singkatan
 * ("3jt", "1,5 jt", "dua setengah juta") dan gaya bicara santai. Hasilnya:
 *
 * - `qwen/qwen3.7-flash` paling murah tetapi TIDAK mendukung structured
 *   output, hanya mode JSON longgar. Keluaran yang bentuknya tidak dijamin
 *   berarti kegagalan diam-diam, jadi gugur.
 * - `qwen/qwen3.5-9b` akurat setelah prompt diperbaiki, tetapi latensinya
 *   sangat tidak stabil: pernah 1,1 detik, pernah 16 detik untuk kalimat
 *   serupa. Pengguna yang menunggu 16 detik akan mengira situsnya rusak.
 * - `google/gemini-2.5-flash-lite` konsisten di kisaran 1,1 detik dan benar
 *   di seluruh kasus sulit.
 *
 * Selisih biayanya tidak berarti untuk pemakaian di sini: sekitar $0,000065
 * per panggilan, jadi kredit $1 cukup untuk belasan ribu percakapan.
 *
 * Bisa diganti lewat OPENROUTER_CHAT_MODEL tanpa menyentuh kode.
 */
export const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

/** Batas operasional. Diubah di sini, bukan tersebar di pemanggil. */
export const AI_LIMITS = {
  /** Panjang maksimum kalimat pengguna yang diterima. */
  maxInputChars: 600,
  /** Timeout satu panggilan. Lebih dari ini, pengguna lebih baik pakai form. */
  timeoutMs: 12_000,
  /** Token keluaran maksimum untuk pengurai satu kalimat. JSON pendek. */
  maxOutputTokens: 300,
  /** Percakapan butuh ruang lebih: ada balasan dan pilihan cepat di dalamnya. */
  maxChatOutputTokens: 600,
  /**
   * Giliran percakapan yang ikut dikirim ulang. Membatasi ini menjaga biaya dan
   * panjang konteks tetap terkendali di percakapan yang berlarut (PRD §10).
   */
  maxHistoryTurns: 12,
  /** Panggilan per IP per jendela waktu. */
  requestsPerWindow: 8,
  /** Panggilan total per instance per jendela waktu, lintas semua klien. */
  globalRequestsPerWindow: 120,
  windowMs: 60_000,
  /** Panjang maksimum satu pesan di riwayat (balasan model maks. 400). */
  maxHistoryMessageChars: 600,
  /** Jumlah pesan riwayat yang diterima dari klien sebelum ditolak. */
  maxHistoryMessages: 200,
} as const;

let cached: OpenAI | null = null;

export function getAiClient(): OpenAI {
  if (cached) return cached;

  const parsed = envSchema.safeParse({
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "OPENROUTER_API_KEY belum ada di environment. Jalankan " +
        "`npx @insforge/cli ai setup` untuk menariknya ke .env.local."
    );
  }

  cached = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: parsed.data.OPENROUTER_API_KEY,
    timeout: AI_LIMITS.timeoutMs,
    // Tanpa percobaan ulang otomatis: kegagalan lebih baik dilaporkan ke
    // pengguna beserta tombol coba lagi daripada diam-diam menggandakan biaya.
    maxRetries: 0,
  });

  return cached;
}

export function getModel(): string {
  return process.env.OPENROUTER_CHAT_MODEL || DEFAULT_MODEL;
}

export function hasAiCredentials(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Dua lapis pembatas laju untuk panggilan model (lihat `@/lib/rate-limit`).
 *
 * Batas per klien mencegah satu pengunjung menghabiskan anggaran dengan
 * menahan tombol kirim. Batas global per instance tetap berlaku walau header
 * IP dipalsukan, jadi biaya terburuk per instance selalu terbatas.
 */
const perClientLimiter = createRateLimiter({
  limit: AI_LIMITS.requestsPerWindow,
  windowMs: AI_LIMITS.windowMs,
});
const globalLimiter = createRateLimiter({
  limit: AI_LIMITS.globalRequestsPerWindow,
  windowMs: AI_LIMITS.windowMs,
});

export function rateLimit(key: string): RateLimitResult {
  const perClient = perClientLimiter.check(key);
  if (!perClient.allowed) return perClient;
  return globalLimiter.check("global");
}
