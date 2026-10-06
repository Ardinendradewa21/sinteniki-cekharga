import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Memeriksa header `Authorization: Bearer <secret>` untuk endpoint yang
 * dipanggil penjadwal (cron Vercel, InsForge Schedules).
 *
 * Kedua sisi di-hash dulu supaya `timingSafeEqual` selalu membandingkan
 * panjang yang sama: perbandingan langsung harus menolak lebih awal saat
 * panjangnya beda, dan itu membocorkan panjang secret lewat waktu respons.
 * Secret kosong atau tidak diset selalu ditolak.
 */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}
