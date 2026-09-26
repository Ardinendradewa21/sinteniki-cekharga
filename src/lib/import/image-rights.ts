/**
 * Dasar hak pakai foto produk (PRD §6: hak penggunaan aset harus jelas).
 *
 * Sebelumnya hak pakai berupa teks bebas ("Izinkan", "izinkan", "Diizinkan oleh
 * saya"), yang tidak bisa ditelusuri. Sekarang admin memilih DASAR haknya, dan
 * dua dasar yang mengklaim izin dari pihak lain wajib disertai keterangan
 * bukti (siapa pemberi izin dan kapan, atau nama lisensinya).
 *
 * Modul murni: dipakai form admin (klien) dan aksi impor (server).
 */

export const IMAGE_USAGE_BASES = [
  "written-permission",
  "public-license",
  "own-work",
  "admin-declared",
] as const;
export type ImageUsageBasis = (typeof IMAGE_USAGE_BASES)[number];

export const IMAGE_USAGE_BASIS_LABELS: Record<ImageUsageBasis, string> = {
  "written-permission": "Izin tertulis dari pemilik foto",
  "public-license": "Lisensi publik (mis. CC BY)",
  "own-work": "Foto atau aset milik sendiri",
  "admin-declared": "Dinyatakan admin, bukti belum dicatat",
};

/** Dasar yang mengklaim izin pihak lain wajib menyebut buktinya. */
export const IMAGE_BASIS_NEEDS_NOTE: ReadonlySet<ImageUsageBasis> = new Set([
  "written-permission",
  "public-license",
]);

export type ImageRights = { basis: ImageUsageBasis; text: string };

export function isImageUsageBasis(value: unknown): value is ImageUsageBasis {
  return typeof value === "string" && (IMAGE_USAGE_BASES as readonly string[]).includes(value);
}

/**
 * Membaca pilihan form. `rights: null` berarti admin tidak memilih dasar hak,
 * sehingga foto dilewati (spesifikasi dan harga tetap diimpor).
 */
export function readImageRights(
  basisRaw: unknown,
  noteRaw: unknown
): { ok: true; rights: ImageRights | null } | { ok: false; error: string } {
  const basis = String(basisRaw ?? "").trim();
  const note = String(noteRaw ?? "").trim().slice(0, 500);

  if (!basis) {
    return note
      ? { ok: false, error: "Pilih dasar hak pakai foto, atau kosongkan keterangannya untuk melewati foto." }
      : { ok: true, rights: null };
  }
  if (!isImageUsageBasis(basis)) {
    return { ok: false, error: "Dasar hak pakai foto tidak dikenal." };
  }
  if (IMAGE_BASIS_NEEDS_NOTE.has(basis) && !note) {
    return {
      ok: false,
      error: "Tulis bukti hak pakainya: pemberi izin dan tanggalnya, atau nama lisensinya.",
    };
  }
  return { ok: true, rights: { basis, text: note || IMAGE_USAGE_BASIS_LABELS[basis] } };
}
