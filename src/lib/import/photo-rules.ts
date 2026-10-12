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

export type ManagedPhoto = StoredPhoto & { sort_order: number; created_at: string };

/**
 * Foto produk dikelompokkan per warna untuk panel admin: grup berwarna urut
 * nama, grup tanpa warna paling akhir; isi grup sampul dulu, lalu urutan,
 * lalu waktu dibuat. Urutan ini sama dengan urutan tampil di situs.
 */
export function groupPhotosByColor<T extends ManagedPhoto>(photos: readonly T[]): { color: string | null; photos: T[] }[] {
  const groups = new Map<string, { color: string | null; photos: T[] }>();
  for (const photo of photos) {
    const key = photo.color === null ? "" : colorKey(photo.color);
    const group = groups.get(key) ?? { color: photo.color, photos: [] };
    group.photos.push(photo);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.photos.sort(
      (a, b) =>
        Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover)) ||
        a.sort_order - b.sort_order ||
        a.created_at.localeCompare(b.created_at)
    );
  }
  return [...groups.values()].sort((a, b) =>
    a.color === null ? 1 : b.color === null ? -1 : a.color.localeCompare(b.color, "id")
  );
}

/** Urutan id baru setelah satu foto naik atau turun satu posisi di grupnya; null bila tidak bisa. */
export function movePhoto(ids: readonly string[], id: string, direction: "up" | "down"): string[] | null {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
