import { colorKey } from "@/lib/import/colors";

/**
 * Aturan galeri foto per warna (2026-10-12). Modul murni: dipakai importer
 * gambar (server), pratinjau galeri, dan unit test.
 *
 * - Foto dikenali dari URL aslinya DAN warnanya: satu URL boleh tercatat untuk
 *   dua warna (berkas Xiaomi memakai foto yang sama untuk beberapa warna).
 * - Batas: 6 foto per warna, 8 foto umum (tanpa warna), dan 60 foto per
 *   produk sebagai pengaman storage.
 */

export const MAX_PHOTOS_PER_COLOR = 6;
export const MAX_UNCOLORED_PHOTOS = 8;
export const MAX_PHOTOS_PER_PRODUCT = 60;

export type StoredPhoto = {
  id: string;
  original_url: string | null;
  color: string | null;
  is_cover?: boolean;
};

const sameColor = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : colorKey(a) === colorKey(b);

/**
 * Foto yang sama sudah tersimpan: URL dan warna sama. Bila belum ada dan
 * fotonya berwarna, foto dengan URL sama yang belum berwarna "diklaim" (warna
 * baru diketahui), supaya foto lama tidak tercatat dua kali.
 */
export function findSamePhoto<T extends StoredPhoto>(photos: readonly T[], url: string, color: string | null): T | undefined {
  const exact = photos.find((photo) => photo.original_url === url && sameColor(photo.color, color));
  if (exact || color === null) return exact;
  return photos.find((photo) => photo.original_url === url && photo.color === null);
}

/** Alasan foto BARU tidak boleh disimpan karena batas galeri, atau null. */
export function galleryLimitIssue(photos: readonly StoredPhoto[], color: string | null): string | null {
  if (photos.length >= MAX_PHOTOS_PER_PRODUCT) {
    return `Produk sudah berisi ${MAX_PHOTOS_PER_PRODUCT} foto; foto tambahan tidak disimpan.`;
  }
  const sameGroup = photos.filter((photo) => sameColor(photo.color, color)).length;
  if (color !== null && sameGroup >= MAX_PHOTOS_PER_COLOR) {
    return `Warna "${color}" sudah berisi ${MAX_PHOTOS_PER_COLOR} foto; foto ke-${sameGroup + 1} tidak disimpan.`;
  }
  if (color === null && sameGroup >= MAX_UNCOLORED_PHOTOS) {
    return `Galeri sudah berisi ${MAX_UNCOLORED_PHOTOS} foto tanpa warna; foto tambahan tidak disimpan.`;
  }
  return null;
}

/** Sampul hanya dipasang bila warna itu belum punya sampul (sampul pilihan admin tidak ditimpa). */
export function shouldBecomeCover(photos: readonly StoredPhoto[], color: string | null, wantsCover: boolean): boolean {
  return wantsCover && !photos.some((photo) => photo.is_cover && sameColor(photo.color, color));
}

/** Bagian kunci storage untuk warna; foto tanpa warna memakai kunci lama (tidak diproses ulang). */
export function storageColorSuffix(color: string | null): string {
  return color === null ? "" : `#${colorKey(color)}`;
}
