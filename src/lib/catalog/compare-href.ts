/**
 * Bagian kontrak URL perbandingan yang aman dipakai di klien: batas jumlah
 * pilihan dan pembuat URL. Validasi (zod) tetap di compare-params.ts supaya
 * zod tidak ikut terkirim ke setiap halaman publik lewat baki bandingkan.
 */

export const COMPARE_PARAM = "produk";

/** PRD FR-04: "Pengguna memilih 2-3 kandidat beserta variannya." */
export const MIN_COMPARE_ITEMS = 2;
export const MAX_COMPARE_ITEMS = 3;

export type CompareSelection = {
  slug: string;
  /** `null` = pakai varian basis harga. */
  variantKey: string | null;
};

export function buildCompareHref(selections: CompareSelection[]): string {
  if (selections.length === 0) return "/compare";

  /*
    Query string dirakit manual, bukan lewat `URLSearchParams`, karena
    `toString()` meng-encode `~` menjadi `%7E` dan URL-nya jadi sulit dibaca.
    Aman dilakukan di sini: slug sudah dibatasi pola kebab-case dan kunci varian
    hanya angka dengan tanda hubung, jadi tidak ada karakter yang perlu di-escape.
  */
  const parts = selections.map((selection) => {
    const value = selection.variantKey
      ? `${selection.slug}~${selection.variantKey}`
      : selection.slug;
    return `${COMPARE_PARAM}=${value}`;
  });

  return `/compare?${parts.join("&")}`;
}
