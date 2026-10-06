import type { CsvRow } from "@/lib/import/csv-parser";

/**
 * Penawaran situs resmi yang tidak lagi tercantum di hasil tarik otomatis.
 *
 * Dua himpunan baris dipakai dengan peran berbeda, dan memisahkannya adalah
 * inti fungsi ini:
 *
 * - `scopeRows` (baris yang DIPILIH admin) menentukan produk dan toko mana yang
 *   diperiksa. Produk yang tidak dipilih tidak disentuh sama sekali.
 * - `seenRows` (SELURUH baris hasil tarik) menjadi bukti varian apa saja yang
 *   masih tercantum. Varian yang ada di hasil tarik tetapi tidak dicentang
 *   admin tetap terhitung "masih tercantum", jadi tidak ditandai gagal.
 *
 * Dulu keduanya memakai baris terpilih saja, sehingga varian yang sekadar
 * tidak dicentang tercatat "tidak lagi tercantum di situs resmi".
 *
 * Fungsi murni: data katalog dan pemetaan toko diberikan pemanggil.
 */
export function findMissingOfficialOffers({
  scopeRows,
  seenRows,
  storeFor,
  products,
  variants,
  offers,
}: {
  scopeRows: readonly CsvRow[];
  seenRows: readonly CsvRow[];
  storeFor: (url: string) => string | null;
  products: readonly { id: string; slug: string }[];
  variants: readonly { id: string; productId: string; ramGb: number; storageGb: number }[];
  offers: readonly { id: string; variantId: string; url: string; storeId: string | null }[];
}): string[] {
  const storeIds = new Set(
    scopeRows.map((row) => storeFor(row.url ?? "")).filter((id): id is string => Boolean(id))
  );
  const scopeSlugs = new Set(scopeRows.map((row) => row.slug ?? "").filter(Boolean));
  if (storeIds.size === 0 || scopeSlugs.size === 0) return [];

  const productIdBySlug = new Map(products.map((row) => [row.slug, row.id]));
  const scopeProductIds = new Set(
    [...scopeSlugs].map((slug) => productIdBySlug.get(slug)).filter((id): id is string => Boolean(id))
  );
  const variantIdByKey = new Map(variants.map((row) => [`${row.productId}|${row.ramGb}|${row.storageGb}`, row.id]));
  const productIdByVariant = new Map(variants.map((row) => [row.id, row.productId]));

  const seen = new Set(
    seenRows.flatMap((row) => {
      const variantId = variantIdByKey.get(
        `${productIdBySlug.get(row.slug ?? "")}|${Number(row.ram_gb)}|${Number(row.storage_gb)}`
      );
      return variantId ? [`${variantId}|${row.url}`] : [];
    })
  );

  return offers
    .filter(
      (offer) =>
        offer.storeId !== null &&
        storeIds.has(offer.storeId) &&
        scopeProductIds.has(productIdByVariant.get(offer.variantId) ?? "") &&
        !seen.has(`${offer.variantId}|${offer.url}`)
    )
    .map((offer) => offer.id);
}
