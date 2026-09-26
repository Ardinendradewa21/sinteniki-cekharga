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
    imagesCreated: number;
    imagesUpdated: number;
    imagesUnchanged: number;
    imageSkipped: { label: string; reason: string }[];
    skipped: { label: string; reason: string }[];
    malformedLines: number[];
  } | null;
};

export const EMPTY_REPORT: ImportReport = { error: null, summary: null };

/**
 * Laporan impor penawaran. Bentuknya mirip laporan impor spesifikasi, tetapi
 * angkanya berbeda maknanya: di sini yang dihitung adalah penawaran dan harga,
 * bukan produk.
 */
export type OfferImportReport = {
  error: string | null;
  summary: {
    totalRows: number;
    /** Baris mentah scraper (Shopee, Erafone) yang melewati preprocessing otomatis. */
    preprocessedRows: number;
    /** Listing warna lain dari varian yang sama (Erafone) yang digabung ke satu penawaran. */
    mergedListings: number;
    /** Baris tanpa memori yang aman dipasangkan ke varian penyimpanan dasar. */
    inferredBaseVariants: number;
    /** Format sumber yang terdeteksi dalam satu berkas. */
    sourceFormats: ("template" | "shopee-scrape" | "erafone-scrape")[];
    /** Foto listing yang baru masuk galeri produk. */
    imagesAdded: number;
    imagesUnchanged: number;
    imageSkipped: { label: string; reason: string }[];
    /** Penawaran yang baru pertama kali tercatat. */
    created: number;
    /** Penawaran yang sudah ada dan datanya diperbarui. */
    updated: number;
    /** Harga yang berhasil dicatat beserta waktu pemeriksaannya. */
    pricesRecorded: number;
    /** Pengamatan identik yang sudah pernah diimpor dan tidak diduplikasi. */
    duplicatePrices: number;
    skipped: { label: string; reason: string }[];
    malformedLines: number[];
  } | null;
};

export const EMPTY_OFFER_REPORT: OfferImportReport = { error: null, summary: null };

/** Hasil satu batch proses ulang foto produk (pipeline gambar terbaru). */
export type PhotoReprocessReport = {
  error: string | null;
  summary: {
    processed: number;
    failed: { label: string; reason: string }[];
    remaining: number;
    withoutOrigin: number;
  } | null;
};

export const EMPTY_PHOTO_REPORT: PhotoReprocessReport = { error: null, summary: null };
