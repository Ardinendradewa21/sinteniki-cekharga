import type { MetadataRoute } from "next";

import { pairPath } from "@/lib/catalog/compare-pair-rules";
import { listComparePairs } from "@/lib/catalog/compare-pairs";
import { loadOrNull } from "@/lib/catalog/load";
import { qualifyingNeedPages } from "@/lib/catalog/need-page-data";
import { needPagePath } from "@/lib/catalog/need-pages";
import { listProductSummaries } from "@/lib/catalog/queries";
import { siteUrl } from "@/lib/site-url";

/**
 * sitemap.xml: halaman publik dan semua produk TERBIT (draft tidak pernah
 * masuk, karena listProductSummaries hanya membaca katalog terpublikasi).
 *
 * `lastModified` produk = waktu harga terakhir berhasil diperiksa bila ada.
 * Itu sinyal perubahan yang nyata bagi pengunjung; tanggal dikarang tidak
 * dipakai. Halaman tanpa sinyal semacam itu dibiarkan tanpa lastModified.
 *
 * Tanpa `SITE_URL` (bukan produksi) sitemap kosong; lihat src/lib/site-url.ts.
 */
export const revalidate = 3600;

const STATIC_PATHS = ["/", "/products", "/compare", "/assistant", "/how-it-works", "/faq", "/terms", "/iklan"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  if (!base) return [];

  const now = new Date();
  const products = (await loadOrNull(() => listProductSummaries(now))) ?? [];
  // Halaman "A vs B" hanya untuk pasangan pilihan admin yang kedua produknya terbit (PB-28).
  const pairs = (await loadOrNull(() => listComparePairs())) ?? [];
  // Halaman kebutuhan hanya yang saat ini punya minimal 3 produk berharga segar (PB-29).
  const needPages = (await loadOrNull(() => qualifyingNeedPages(now))) ?? [];

  return [
    ...STATIC_PATHS.map((path) => ({ url: new URL(path, base).href })),
    ...products.map((product) => ({
      url: new URL(`/products/${product.slug}`, base).href,
      ...(product.price.status === "available" ? { lastModified: new Date(product.price.checkedAt) } : {}),
    })),
    ...pairs.map((pair) => ({ url: new URL(pairPath(pair), base).href })),
    ...(needPages.length > 0 ? [{ url: new URL("/hp", base).href }] : []),
    ...needPages.map(({ page }) => ({ url: new URL(needPagePath(page), base).href })),
  ];
}
