/**
 * Varian baru dari berkas penawaran (Sprint 12). Modul murni.
 *
 * Varian tidak boleh DIKARANG, tetapi varian yang dijual resmi di Indonesia
 * sering tidak tercatat di GSMArena (mis. vivo Y500 6/128 GB). Baris penawaran
 * untuk varian seperti itu tidak lagi dibuang: barisnya ditandai "Perlu
 * tinjau" dan variannya baru dibuat bila admin mencentang dan menerapkannya.
 * Kombinasi yang tidak lazim (salah ketik "16/516") tetap ditolak.
 */

/** Kapasitas penyimpanan yang dijual di pasar (GB). */
const STORAGE_GB = new Set([8, 16, 32, 64, 128, 256, 512, 1024, 2048]);
/** RAM ponsel yang dijual di pasar (GB). */
const RAM_GB = new Set([1, 2, 3, 4, 6, 8, 10, 12, 16, 18, 20, 24]);

/** Alasan kombinasi RAM/penyimpanan tidak lazim; null bila wajar. */
export function implausibleVariant(ramGb: number, storageGb: number): string | null {
  if (!STORAGE_GB.has(storageGb)) {
    return `Penyimpanan ${storageGb} GB tidak lazim (yang umum: 64, 128, 256, 512, 1024). Periksa ketikannya di berkas.`;
  }
  if (!RAM_GB.has(ramGb)) {
    return `RAM ${ramGb} GB tidak lazim (yang umum: 4, 6, 8, 12, 16). Periksa ketikannya di berkas.`;
  }
  return null;
}

const NEW_PREFIX = "baru:";

/** Kunci sementara varian yang belum ada; tidak pernah dikirim ke database. */
export function newVariantKey(productId: string, ramGb: number, storageGb: number): string {
  return `${NEW_PREFIX}${productId}:${ramGb}:${storageGb}`;
}

export function isNewVariantKey(variantId: string): boolean {
  return variantId.startsWith(NEW_PREFIX);
}
