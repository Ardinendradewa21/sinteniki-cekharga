/**
 * Susunan hasil saat pengguna belum menyebut budget (VD-08). Modul murni.
 *
 * Tanpa budget, mesin rekomendasi mengurutkan dari kecocokan saja, sehingga
 * "hp buat gaming" diawali ponsel lipat Rp44 juta (uji 17 November 2026).
 * Alih-alih menanyakan budget sebelum menampilkan apa pun, kartu teratas
 * disusun SATU PER KELAS HARGA dari yang terjangkau: pengguna langsung
 * melihat pilihan di tiap rentang dan bisa mempersempit dengan chip budget.
 * Di dalam tiap kelas, urutan mesin (kecocokan) tetap dipakai.
 */

/** Batas atas kelas harga, Rupiah. Kelas terakhir tanpa batas atas. */
export const PRICE_BAND_LIMITS = [2_500_000, 4_500_000, 7_000_000, 12_000_000] as const;

export function priceBand(priceIdr: number): number {
  const index = PRICE_BAND_LIMITS.findIndex((limit) => priceIdr <= limit);
  return index === -1 ? PRICE_BAND_LIMITS.length : index;
}

/**
 * Kandidat terbaik tiap kelas harga di depan (kelas termurah dulu), sisanya
 * mengikuti urutan semula. Kandidat tanpa harga tetap di belakang.
 */
export function spreadAcrossPriceBands<T>(candidates: readonly T[], priceOf: (candidate: T) => number | null): T[] {
  const firstOfBand = new Map<number, T>();
  for (const candidate of candidates) {
    const price = priceOf(candidate);
    if (price === null) continue;
    const band = priceBand(price);
    if (!firstOfBand.has(band)) firstOfBand.set(band, candidate);
  }
  const front = [...firstOfBand.entries()].sort((a, b) => a[0] - b[0]).map(([, candidate]) => candidate);
  const rest = candidates.filter((candidate) => !front.includes(candidate));
  return [...front, ...rest];
}
