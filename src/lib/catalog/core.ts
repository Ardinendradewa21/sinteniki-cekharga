import "server-only";

import { getCatalogSource } from "@/lib/catalog/source";
import { resolveStartingPrice, type StartingPriceResolution } from "@/lib/catalog/pricing";
import type { CatalogDataset, Variant } from "@/lib/catalog/schema";

/**
 * Inti katalog publik: memuat katalog terbit, ringkasan produk untuk kartu,
 * slug, dan kunci varian. Dipakai modul pencarian, detail, dan perbandingan.
 *
 * `now` selalu parameter eksplisit supaya freshness bisa diuji dengan clock
 * terkendali (PRD §7).
 */

export type ProductSummary = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  name: string;
  image: {
    src: string;
    alt: string;
    /** true = ilustrasi generik, bukan foto produk asli (PRD §8). */
    isGenericIllustration: boolean;
  };
  price: StartingPriceResolution;
  /** Varian yang menjadi basis harga, wajib ditampilkan bersama harga. */
  priceReferenceVariant: string | null;
  variantCount: number;
};

export function formatVariantLabel(variant: Variant): string {
  return `${variant.ramGb}/${variant.storageGb} GB`;
}

/**
 * Hanya data terpublikasi yang boleh sampai ke publik maupun ke AI
 * (PRD FR-07: "draft tidak tampil ke publik/AI").
 */
function selectPublished(dataset: CatalogDataset): CatalogDataset {
  const products = dataset.products.filter(
    (product) => product.status === "published"
  );
  const productIds = new Set(products.map((product) => product.id));
  const variants = dataset.variants.filter((variant) =>
    productIds.has(variant.productId)
  );
  const variantIds = new Set(variants.map((variant) => variant.id));
  const offers = dataset.offers.filter((offer) =>
    variantIds.has(offer.variantId)
  );
  const offerIds = new Set(offers.map((offer) => offer.id));

  return {
    products,
    variants,
    assets: dataset.assets.filter((asset) => productIds.has(asset.productId)),
    reviews: dataset.reviews.filter(
      (review) =>
        review.status === "published" && productIds.has(review.productId)
    ),
    offers,
    priceObservations: dataset.priceObservations.filter((observation) =>
      offerIds.has(observation.offerId)
    ),
    priceChecks: dataset.priceChecks.filter((check) =>
      offerIds.has(check.offerId)
    ),
    stores: dataset.stores,
    // Redirect ke produk draft tidak boleh mengungkap produknya.
    slugRedirects: dataset.slugRedirects.filter((redirect) =>
      productIds.has(redirect.productId)
    ),
  };
}

/** Produk untuk slug ini, termasuk lewat slug lama yang sudah diganti. */
export function findProductBySlug(catalog: CatalogDataset, slug: string) {
  const direct = catalog.products.find((candidate) => candidate.slug === slug);
  if (direct) return direct;
  const redirect = catalog.slugRedirects.find((entry) => entry.oldSlug === slug);
  return redirect
    ? catalog.products.find((candidate) => candidate.id === redirect.productId)
    : undefined;
}

/**
 * Slug baru bila `slug` adalah slug lama yang sudah diganti (mis. "+" menjadi
 * "-plus", atau iQOO keluar dari vivo). `null` bila tidak ada pengalihan.
 */
export async function resolveProductSlugRedirect(
  now: Date,
  slug: string
): Promise<string | null> {
  const catalog = await loadPublishedCatalog(now);
  if (catalog.products.some((candidate) => candidate.slug === slug)) return null;
  return findProductBySlug(catalog, slug)?.slug ?? null;
}

export async function loadPublishedCatalog(
  now: Date
): Promise<CatalogDataset> {
  const source = getCatalogSource();
  const dataset = await source.loadDataset(now);
  return selectPublished(dataset);
}

/**
 * Membangun view model kartu dari satu produk dan HIMPUNAN VARIAN yang relevan.
 *
 * `variants` sengaja diminta dari pemanggil, bukan diambil sendiri dari katalog.
 * Alasannya penting: ketika pengguna menyaring RAM atau penyimpanan, harga yang
 * ditampilkan harus berasal dari varian yang cocok dengan filter itu. Kalau
 * fungsi ini selalu memakai semua varian, kartu bisa menampilkan harga varian
 * 4/128 GB padahal pengguna sedang menyaring 8 GB, dan itu mencampur basis harga
 * diam-diam (PRD §7 butir 3).
 */
export function buildProductSummary(
  product: CatalogDataset["products"][number],
  variants: readonly Variant[],
  catalog: CatalogDataset,
  now: Date
): ProductSummary {
  const price = resolveStartingPrice({
    variants,
    offers: catalog.offers,
    observations: catalog.priceObservations,
    checks: catalog.priceChecks,
    now,
  });

  const referenceVariant = price.referenceVariantId
    ? (variants.find((variant) => variant.id === price.referenceVariantId) ??
      null)
    : null;

  const asset =
    catalog.assets.find(
      (candidate) =>
        candidate.productId === product.id && candidate.kind === "photo"
    ) ??
    catalog.assets.find((candidate) => candidate.productId === product.id);

  return {
    id: product.id,
    slug: product.slug,
    brand: product.brand,
    model: product.model,
    name: `${product.brand} ${product.model}`,
    image: {
      src: asset?.src ?? "/images/generic-device.svg",
      alt: asset?.alt ?? "Ilustrasi generik perangkat smartphone",
      isGenericIllustration: asset?.kind !== "photo",
    },
    price,
    priceReferenceVariant: referenceVariant
      ? formatVariantLabel(referenceVariant)
      : null,
    variantCount: variants.length,
  };
}

export async function listProductSummaries(
  now: Date
): Promise<ProductSummary[]> {
  const catalog = await loadPublishedCatalog(now);

  return catalog.products.map((product) =>
    buildProductSummary(
      product,
      catalog.variants.filter((variant) => variant.productId === product.id),
      catalog,
      now
    )
  );
}


export function variantKey(variant: Variant): string {
  return `${variant.ramGb}-${variant.storageGb}`;
}


export async function listPublishedSlugs(now: Date): Promise<string[]> {
  const catalog = await loadPublishedCatalog(now);
  return catalog.products.map((product) => product.slug);
}

/**
 * Status satu baris atribut saat dibandingkan.
 *
 * `incomplete` sengaja dipisahkan dari `same`/`different`. PRD FR-04 melarang
 * data kosong dianggap lebih buruk atau bernilai nol, dan menyebut dua nilai
 * "sama" padahal salah satunya tidak diketahui sama saja mengarang kesimpulan.
 */
