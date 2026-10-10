/**
 * Aturan percobaan ulang pengambilan situs resmi dan GSMArena (aturan system
 * design 7, PB-22). Murni, supaya bisa diuji tanpa jaringan.
 *
 * Yang diulang hanya kegagalan sementara: galat jaringan/timeout dan HTTP 5xx
 * (server tujuan sedang bermasalah). Yang TIDAK pernah diulang:
 *   - 403, 429, dan halaman tantangan anti-bot: tanda kita diminta berhenti.
 *     Mengulanginya sama dengan memaksa masuk.
 *   - 4xx lain: permintaannya yang salah, hasilnya tidak akan berubah.
 *
 * Batasnya kecil dan tetap: tarik otomatis dipicu admin yang sedang menunggu,
 * dan pemeriksaan harian punya anggaran waktu 60 detik.
 */

export const SCRAPE_MAX_ATTEMPTS = 3;

/** Jeda sebelum percobaan ke-(attempt+1): 1 dtk, lalu 3 dtk, ditambah acak kecil. */
export function scrapeBackoffMs(attempt: number, random: () => number = Math.random): number {
  const base = attempt <= 1 ? 1_000 : 3_000;
  return base + Math.floor(random() * 250);
}

export type ScrapeFailure =
  | { kind: "network" }
  | { kind: "http"; status: number }
  | { kind: "blocked" };

export function isRetryableScrapeFailure(failure: ScrapeFailure): boolean {
  if (failure.kind === "network") return true;
  if (failure.kind === "http") return failure.status >= 500 && failure.status <= 599;
  return false;
}
