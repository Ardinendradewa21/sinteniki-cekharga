import { isPriceableListing, resolveVariantPrice } from "@/lib/catalog/pricing";
import type { CatalogDataset } from "@/lib/catalog/schema";

/**
 * Statistik hidup katalog untuk halaman Cara Kerja (PB-30). Modul murni.
 *
 * Hanya angka yang bisa dihitung dari data tercatat: produk, merek, penawaran,
 * toko, dan berapa produk yang harganya masih segar. Tidak ada jumlah
 * pengguna, kunjungan, atau angka popularitas (PRD FR-01, FR-05).
 */
export type CatalogStats = {
  products: number;
  brands: number;
  /** Penawaran yang dihitung untuk harga: kondisi baru, listing aktif. */
  activeOffers: number;
  /** Toko terdaftar ditambah toko yang dikenali dari nama penjual + marketplace. */
  stores: number;
  /** Produk dengan minimal satu varian berharga segar. */
  freshProducts: number;
  /** Pemeriksaan harga berhasil paling baru di katalog; null bila belum ada. */
  latestCheckAt: string | null;
};

export function catalogStats(dataset: CatalogDataset, now: Date): CatalogStats {
  const activeOffers = dataset.offers.filter(isPriceableListing);
  const stores = new Set(
    activeOffers.map((offer) => offer.storeId ?? `${offer.marketplace.toLowerCase()}|${offer.sellerName.toLowerCase()}`)
  );

  const variantsByProduct = new Map<string, string[]>();
  for (const variant of dataset.variants) {
    variantsByProduct.set(variant.productId, [...(variantsByProduct.get(variant.productId) ?? []), variant.id]);
  }

  let freshProducts = 0;
  let latest: string | null = null;
  for (const product of dataset.products) {
    let fresh = false;
    for (const variantId of variantsByProduct.get(product.id) ?? []) {
      const price = resolveVariantPrice({
        variantId,
        offers: activeOffers,
        observations: dataset.priceObservations,
        checks: dataset.priceChecks,
        now,
      });
      if (price.status === "available") {
        fresh = true;
        if (latest === null || price.checkedAt > latest) latest = price.checkedAt;
      }
    }
    if (fresh) freshProducts += 1;
  }

  return {
    products: dataset.products.length,
    brands: new Set(dataset.products.map((product) => product.brand.toLowerCase())).size,
    activeOffers: activeOffers.length,
    stores: stores.size,
    freshProducts,
    latestCheckAt: latest,
  };
}
