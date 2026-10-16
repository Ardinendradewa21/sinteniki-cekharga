import "server-only";

/**
 * Titik ekspor gabungan fungsi katalog yang dipakai halaman (PB-33). Isinya
 * dipecah per fitur:
 *
 * - `core.ts`: memuat katalog terbit, ringkasan produk, slug, kunci varian.
 * - `search.ts`: pencarian katalog.
 * - `product-detail.ts`: halaman detail produk.
 * - `comparison.ts`: perbandingan.
 *
 * Server-only: halaman menerima view model seperlunya, bukan seluruh dataset
 * (PRD §9). `now` selalu parameter eksplisit supaya freshness bisa diuji
 * dengan clock terkendali (PRD §7).
 */

export {
  formatVariantLabel,
  listProductSummaries,
  listPublishedSlugs,
  loadPublishedCatalog,
  resolveProductSlugRedirect,
  variantKey,
  type ProductSummary,
} from "@/lib/catalog/core";
export { searchCatalog, type CatalogFacets, type CatalogSearchResult } from "@/lib/catalog/search";
export {
  getProductDetail,
  type ProductDetail,
  type ProductDetailColor,
  type ProductDetailOffer,
  type ProductDetailVariant,
  type ProductReview,
  type ProductSpecRow,
} from "@/lib/catalog/product-detail";
export {
  getComparison,
  getComparisonExample,
  type CompareItem,
  type CompareResult,
  type CompareSpecIcon,
  type ComparisonExample,
} from "@/lib/catalog/comparison";
export { isDemoData } from "@/lib/catalog/source";
