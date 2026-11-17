/**
 * Harga Rupiah yang diketik admin di form (15 November 2026).
 *
 * Kolom harga dulu `type="number" step=1000`. Chrome menolak "2.849.000"
 * (titik ribuan Indonesia terbaca desimal) dan harga yang bukan kelipatan
 * Rp1.000 seperti "2849500" dengan gelembung berbahasa Inggris, sehingga
 * harga tidak pernah terkirim dan admin mengira sudah tersimpan. Sekarang
 * kolomnya teks biasa dan angkanya diurai di server:
 *
 *   "2.849.000", "2849000", "Rp 2.849.000", "2,849,000", "2.849.000,00" -> 2849000
 *
 * Sen selain ",00"/".00" ditolak, karena harga katalog adalah Rupiah bulat.
 */

/** Ponsel termurah di katalog di atas Rp500 ribu; di bawah ini hampir pasti salah ketik (mis. "2.849"). */
export const MIN_MANUAL_PRICE_IDR = 100_000;
/** Salah ketik nol berlebih tertangkap di sini, bukan tampil sebagai harga Rp1 miliar. */
export const MAX_MANUAL_PRICE_IDR = 500_000_000;

export type RupiahParse = { ok: true; value: number } | { ok: false; error: string };

export function parseRupiahInput(raw: string): RupiahParse {
  const text = raw.replace(/rp\.?/gi, "").replace(/\s+/g, "");
  if (!text) return { ok: false, error: "Harga wajib diisi." };

  let digits = text;
  // Akhiran sen ",00" atau ".00" (dua digit setelah pemisah terakhir).
  const cents = digits.match(/[.,](\d{2})$/);
  if (cents && !/[.,]\d{3}$/.test(digits)) {
    if (cents[1] !== "00") return { ok: false, error: "Harga ditulis dalam Rupiah bulat, tanpa sen." };
    digits = digits.slice(0, -3);
  }
  // Pemisah ribuan harus tepat per tiga digit, supaya "2.84.9000" tidak lolos diam-diam.
  if (/[.,]/.test(digits) && !/^\d{1,3}([.,]\d{3})+$/.test(digits)) {
    return { ok: false, error: "Format harga tidak dikenali. Tulis seperti 2.849.000 atau 2849000." };
  }
  digits = digits.replace(/[.,]/g, "");
  if (!/^\d+$/.test(digits)) {
    return { ok: false, error: "Harga hanya boleh berisi angka, titik, atau koma. Contoh: 2.849.000." };
  }

  const value = Number(digits);
  if (value < MIN_MANUAL_PRICE_IDR) {
    return { ok: false, error: `Harga terlalu kecil untuk ponsel (minimal Rp${MIN_MANUAL_PRICE_IDR.toLocaleString("id-ID")}). Periksa lagi angkanya.` };
  }
  if (value > MAX_MANUAL_PRICE_IDR) {
    return { ok: false, error: "Harga di luar batas wajar, periksa lagi angkanya." };
  }
  return { ok: true, value };
}
