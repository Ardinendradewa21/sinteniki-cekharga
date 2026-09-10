/**
 * Bentuk laporan hasil impor.
 *
 * Dipisah dari actions.ts karena berkas `"use server"` hanya boleh mengekspor
 * fungsi async. Mengekspor konstanta objek dari sana lolos build tetapi gagal
 * saat halaman dirender, dengan pesan "A use server file can only export async
 * functions". Tipe murni sebenarnya aman karena terhapus saat kompilasi, tapi
 * EMPTY_REPORT adalah objek sungguhan, jadi keduanya ditaruh di sini agar
 * batasnya jelas.
 */
export type ImportReport = {
  error: string | null;
  /** Ringkasan hasil; null sebelum ada impor yang dijalankan. */
  summary: {
    totalRows: number;
    created: number;
    updated: number;
    skipped: { label: string; reason: string }[];
    malformedLines: number[];
  } | null;
};

export const EMPTY_REPORT: ImportReport = { error: null, summary: null };
