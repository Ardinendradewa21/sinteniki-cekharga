/**
 * Konfigurasi operasional yang tidak boleh tersebar sebagai angka ajaib di UI
 * (PRD §7: "Simpan sebagai konfigurasi, bukan angka tersebar di UI").
 */

/**
 * Mode sumber data.
 *
 * PRD §9: adapter nyata dan demo harus dapat dibedakan melalui konfigurasi
 * server, dan "Produksi tidak boleh diam-diam fallback ke fixture saat API
 * gagal". Karena itu mode dibaca sekali di server dan tidak punya jalur
 * fallback otomatis, kalau adapter nyata gagal, kegagalan itu muncul sebagai
 * error, bukan diganti data demo.
 */
export type DataSourceMode = "demo" | "live";

export function getDataSourceMode(): DataSourceMode {
  return process.env.CEKHARGA_DATA_SOURCE === "live" ? "live" : "demo";
}

/**
 * Kebijakan harga & freshness (PRD §7).
 *
 * Batas freshness 30 jam: keputusan pemilik produk 2026-10-08 (PRD §7),
 * menggantikan usulan awal 24 jam. Pemeriksaan harga otomatis berjalan sekali
 * sehari (cron 06.00 WIB) dan cron Vercel tidak presisi; dengan 24 jam, harga
 * sempat tampil "kedaluwarsa" setiap pagi sebelum pemeriksaan selesai. Selisih
 * 6 jam memberi ruang keterlambatan tanpa membuat harga lama tampak segar.
 */
export const PRICING_POLICY = {
  /** Umur maksimum pengamatan harga agar masih layak jadi basis "mulai dari". */
  freshnessWindowHours: 30,
  /** Mata uang yang didukung versi awal. */
  currency: "IDR",
  /** Versi awal hanya kondisi baru (PRD §3). */
  allowedConditions: ["new"],
  /**
   * Umur maksimum harga lama (melewati freshness) yang masih boleh dipakai
   * asisten untuk grup terpisah "harga perlu dicek ulang". Grup ini tidak
   * pernah disebut memenuhi syarat budget; tanggal pemeriksaannya selalu tampil.
   */
  assistantStaleWindowDays: 14,
} as const;

export const FRESHNESS_WINDOW_MS =
  PRICING_POLICY.freshnessWindowHours * 60 * 60 * 1000;
