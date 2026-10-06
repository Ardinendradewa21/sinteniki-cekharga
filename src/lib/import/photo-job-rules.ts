import type { ProductImageImportResult } from "@/lib/import/product-images";

/**
 * Aturan antrean foto yang murni (tanpa I/O), dipakai worker dan unit test.
 * Modul ini hanya mengimpor TIPE dari product-images, jadi aman diuji tanpa
 * sharp atau koneksi database.
 */

export type PhotoJobKind = "primary" | "gallery" | "reprocess";

/** Batas percobaan per job; harus sama dengan kondisi di RPC photo_claim_jobs. */
export const PHOTO_MAX_ATTEMPTS = 3;

/**
 * Alasan kegagalan yang tidak akan berubah bila dicoba lagi (URL tidak
 * diizinkan, format salah, galeri penuh, hak pakai kosong). Gagal seperti ini
 * langsung final; selebihnya (jaringan, storage) dicoba ulang.
 */
const PERMANENT_FAILURE = [
  /tidak diizinkan/i,
  /bukan gambar/i,
  /animasi/i,
  /melebihi batas/i,
  /Galeri sudah berisi/i,
  /hak pakai/i,
  /tidak menyimpan URL asli/i,
  /sudah tidak ada/i,
  /tanpa foto acuan/i,
];

export function isPermanentFailure(reason: string): boolean {
  return PERMANENT_FAILURE.some((pattern) => pattern.test(reason));
}

export type PhotoJobNextState = {
  status: "pending" | "done" | "failed";
  outcome: "created" | "updated" | "unchanged" | null;
  last_error: string | null;
};

/**
 * Status job setelah satu percobaan. `attempts` = jumlah percobaan TERMASUK
 * yang barusan (sudah dinaikkan saat klaim).
 */
export function photoJobNextState(result: ProductImageImportResult, attempts: number): PhotoJobNextState {
  if (result.ok) return { status: "done", outcome: result.outcome, last_error: null };
  const retry = !isPermanentFailure(result.reason) && attempts < PHOTO_MAX_ATTEMPTS;
  return { status: retry ? "pending" : "failed", outcome: null, last_error: result.reason.slice(0, 500) };
}

/**
 * Mengelompokkan job per produk dengan urutan aman: foto utama, lalu galeri,
 * lalu proses ulang. Kelompok diproses paralel; isi kelompok berurutan.
 */
export function groupPhotoJobs<T extends { product_id: string; kind: PhotoJobKind }>(rows: readonly T[]): T[][] {
  const order: Record<PhotoJobKind, number> = { primary: 0, gallery: 1, reprocess: 2 };
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.product_id, [...(groups.get(row.product_id) ?? []), row]);
  return [...groups.values()].map((group) => [...group].sort((a, b) => order[a.kind] - order[b.kind]));
}
