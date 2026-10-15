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
 * Pembaruan 2026-10-15 (rancangan Tanya AI §3.5, PO menyetujui anggaran
 * model naik). Diuji dengan set emas `pnpm test:assistant-eval` (30 pesan):
 *
 * - `openai/gpt-6-luna`: ekstraksi 100%, balasan paling natural, 0 gagal
 *   panggil, latensi median 2,6 dtk (p90 4,0 dtk). $0,10/$0,50 per juta token.
 * - `anthropic/claude-haiku-5.5`: 98,5%, natural, salah membaca "range 2-3
 *   juta", median 2,7 dtk.
 * - `google/gemini-2.5-flash-lite`: 100% dan paling cepat (median 1,6 dtk),
 *   tetapi bahasanya kaku dan membuka 63% balasan dengan "Oke".
 *
 * Model utama `gpt-6-luna`; `flash-lite` menjadi cadangan otomatis lewat
 * daftar `models` OpenRouter bila model utama gagal atau tidak tersedia
 * (aturan system design 7). Perkiraan biaya: sekitar $0,0004 per giliran.
 *
 * Bisa diganti lewat OPENROUTER_CHAT_MODEL tanpa menyentuh kode.
 */
const DEFAULT_MODEL = "openai/gpt-6-luna";

/**
 * Model cadangan, dicoba OpenRouter berurutan bila penyedia model utama gagal
 * (gangguan, batas laju, penolakan). ID model yang salah tetap ditolak 400
 * sebelum cadangan dicoba, jadi salah ketik OPENROUTER_CHAT_MODEL tetap
 * terlihat sebagai galat, bukan diam-diam memakai cadangan.
 */
const FALLBACK_MODELS = ["google/gemini-2.5-flash-lite"] as const;

/** Batas operasional. Diubah di sini, bukan tersebar di pemanggil. */
export const AI_LIMITS = {
  /** Panjang maksimum kalimat pengguna yang diterima. */
  maxInputChars: 600,
  /**
   * Timeout satu percobaan. Dengan satu percobaan ulang, waktu tunggu terburuk
   * sekitar 21 detik; lebih dari itu pengguna lebih baik pakai form.
   */
  timeoutMs: 10_000,
  /**
   * Percobaan ulang SDK (aturan system design 7). SDK hanya mengulang galat
   * koneksi, timeout, 408, 409, 429, dan 5xx, dengan backoff eksponensial.
   * Satu kali saja: setiap percobaan bisa ditagih, dan kuota harian di bawah
   * dihitung per giliran, bukan per percobaan.
   */
  maxRetries: 1,
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
  /** Kuota harian per pengunjung (HMAC IP), dihitung bersama di database. */
  dailyPerClient: 60,
  /** Kuota harian total semua pengunjung; batas biaya terburuk per hari. */
  dailyGlobal: 3000,
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
    maxRetries: AI_LIMITS.maxRetries,
  });

  return cached;
}

export function getModel(): string {
  return process.env.OPENROUTER_CHAT_MODEL || DEFAULT_MODEL;
}

/** Urutan model untuk parameter `models` OpenRouter: utama dulu, lalu cadangan. */
export function getModelChain(): string[] {
  return [...new Set([getModel(), ...FALLBACK_MODELS])];
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
