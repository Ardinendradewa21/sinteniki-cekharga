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
 * Nilai di bawah adalah "usulan teknis" PRD (pemeriksaan harian, batas
 * freshness 24 jam) dan HARUS dikonfirmasi pemilik produk sebelum publikasi,
 * menyesuaikan sumber harga yang benar-benar dipakai.
 */
export const PRICING_POLICY = {
  /** Umur maksimum pengamatan harga agar masih layak jadi basis "mulai dari". */
  freshnessWindowHours: 24,
  /** Mata uang yang didukung versi awal. */
  currency: "IDR",
  /** Versi awal hanya kondisi baru (PRD §3). */
  allowedConditions: ["new"],
} as const;

export const FRESHNESS_WINDOW_MS =
  PRICING_POLICY.freshnessWindowHours * 60 * 60 * 1000;
