import type { MetadataRoute } from "next";

import { loadOrNull } from "@/lib/catalog/load";
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

  return [
    ...STATIC_PATHS.map((path) => ({ url: new URL(path, base).href })),
    ...products.map((product) => ({
      url: new URL(`/products/${product.slug}`, base).href,
      ...(product.price.status === "available" ? { lastModified: new Date(product.price.checkedAt) } : {}),
    })),
  ];
}
