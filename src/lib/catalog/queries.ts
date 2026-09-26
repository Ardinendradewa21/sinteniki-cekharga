import "server-only";

import { getCatalogSource, isDemoData } from "@/lib/catalog/source";
import {
  isFresh,
  isPriceableListing,
  lastSuccessfulCheckAt,
  latestObservation,
  priceDifference,
  resolveStartingPrice,
  resolveVariantPrice,
  type PriceResolution,
  type StartingPriceResolution,
} from "@/lib/catalog/pricing";
import type {
  CatalogDataset,
  Offer,
  ProductSpecs,
  Variant,
} from "@/lib/catalog/schema";
import {
  hasPriceBound,
  type CatalogQuery,
} from "@/lib/catalog/search-params";
import {
  interpretCatalogNeeds,
  reviewMatchesTopic,
} from "@/lib/catalog/semantic-needs";
import {
  buildSearchDocument,
  isKnownKeyword,
  matchKeywords,
  planKeywords,
} from "@/lib/catalog/keyword-search";
import {
  buildCompareHref,
  MAX_COMPARE_ITEMS,
  type CompareSelection,
} from "@/lib/catalog/compare-params";

/**
 * Fungsi katalog yang dipakai halaman. Server-only: halaman menerima view model
 * seperlunya, bukan seluruh dataset (PRD §9).
 *
 * `now` selalu parameter eksplisit supaya freshness bisa diuji dengan clock
 * terkendali (PRD §7).
 *
 * CATATAN untuk sprint berikutnya: dengan model rendering default, halaman yang
 * memanggil fungsi ini bisa ter-prerender statis, sehingga `now` terkunci di
 * waktu build. Untuk data demo itu tidak menyesatkan, umur fixture memang
 * relatif terhadap `now` yang sama, jadi hubungan segar/kedaluwarsanya tetap
 * benar. Begitu sumber harga nyata masuk (FE-2/FE-3 dan Irisan D), halaman yang
 * menampilkan "diperiksa X lalu" HARUS dipastikan tidak menyajikan waktu build
 * sebagai waktu pemeriksaan.
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
function findProductBySlug(catalog: CatalogDataset, slug: string) {
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
function buildProductSummary(
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

export type ComparisonItem = {
  id: string;
  slug: string;
  name: string;
  /** Varian yang menjadi basis harga, spesifikasi di bawah mengikuti varian ini. */
  variantLabel: string | null;
  price: StartingPriceResolution;
  attributes: { label: string; value: string | null }[];
};

export type ComparisonExample = {
  items: ComparisonItem[];
  /**
   * Selisih harga hanya terisi bila KEDUA harga layak (PRD FR-04). `null`
   * berarti tidak dapat dihitung, bukan nol.
   */
  differenceIdr: number | null;
};

/**
 * Contoh perbandingan untuk beranda. Sengaja memakai jalur data dan aturan yang
 * sama dengan halaman perbandingan nanti, supaya yang ditampilkan di beranda
 * bukan ilustrasi karangan.
 *
 * Spesifikasi yang ditampilkan mengikuti varian basis harga, supaya harga dan
 * spesifikasi tidak berasal dari varian berbeda (PRD §7 butir 3).
 */
export async function getComparisonExample(
  now: Date,
  slugs: readonly [string, string]
): Promise<ComparisonExample | null> {
  const catalog = await loadPublishedCatalog(now);

  const items: ComparisonItem[] = [];

  for (const slug of slugs) {
    const product = catalog.products.find((candidate) => candidate.slug === slug);
    if (!product) return null;

    const variants = catalog.variants.filter(
      (variant) => variant.productId === product.id
    );

    const price = resolveStartingPrice({
      variants,
      offers: catalog.offers,
      observations: catalog.priceObservations,
      checks: catalog.priceChecks,
      now,
    });

    const variant =
      variants.find((candidate) => candidate.id === price.referenceVariantId) ??
      null;

    items.push({
      id: product.id,
      slug: product.slug,
      name: `${product.brand} ${product.model}`,
      variantLabel: variant ? formatVariantLabel(variant) : null,
      price,
      attributes: [
        { label: "RAM", value: variant ? `${variant.ramGb} GB` : null },
        {
          label: "Penyimpanan",
          value: variant ? `${variant.storageGb} GB` : null,
        },
        {
          label: "Layar",
          value: product.specs.displayInches
            ? `${product.specs.displayInches}" ${product.specs.displayTechnology ?? ""}`.trim()
            : null,
        },
        {
          label: "Baterai",
          value: product.specs.batteryMah
            ? `${product.specs.batteryMah} mAh`
            : null,
        },
        { label: "Garansi", value: variant?.region ?? null },
      ],
    });
  }

  const [first, second] = items;

  return {
    items,
    differenceIdr:
      first && second ? priceDifference(first.price, second.price) : null,
  };
}

export type CatalogFacets = {
  brands: string[];
  ram: number[];
  storage: number[];
};

export type CatalogSearchResult = {
  items: ProductSummary[];
  /** Ulasan terbit yang membahas topik kebutuhan, bukan klaim produk terbaik. */
  semanticReviews: Record<string, { summary: string; channelName: string; videoUrl: string }[]>;
  /** Jumlah hasil setelah filter. */
  matched: number;
  /** Jumlah seluruh produk terpublikasi, untuk konteks "X dari Y". */
  totalPublished: number;
  facets: CatalogFacets;
  /**
   * Cara search bar membaca teks pengguna, untuk ditampilkan terbuka: syarat
   * yang dipakai menyaring, kata kunci, dan kata yang diabaikan beserta
   * alasannya. Pencarian yang tidak bisa dijelaskan tidak boleh diam-diam
   * mengubah hasil.
   */
  interpretation: {
    appliedLabels: string[];
    cautions: string[];
    keywords: string[];
    /** Kata yang tidak dikenal nama, merek, maupun tag produk mana pun. */
    ignoredWords: string[];
    /** Kata penilaian seperti "murah" atau "terbaik" yang tidak terukur. */
    subjectiveWords: string[];
    hasReviewTopic: boolean;
  };
  /** Halaman yang benar-benar disajikan (sudah dijepit ke jangkauan valid). */
  page: number;
  pageSize: number;
  totalPages: number;
};

/** 20 = empat baris penuh pada grid desktop lima kolom. */
export const CATALOG_PAGE_SIZE = 20;

/** Skor kecocokan teks. BUKAN skor kualitas produk (PRD FR-02). */
function matchScore(name: string, query: string): number {
  if (!query) return 0;

  const haystack = name.toLowerCase();
  const needle = query.toLowerCase();

  if (haystack === needle) return 3;
  if (haystack.startsWith(needle)) return 2;
  if (haystack.includes(needle)) return 1;

  // Cocok sebagian kata, mis. "arc ultra" untuk "Volt Arc 3 Ultra".
  const words = needle.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => haystack.includes(word))) {
    return 1;
  }

  return 0;
}

/**
 * Pencarian, penyaringan, dan pengurutan katalog (PRD FR-02).
 *
 * Dua aturan yang gampang salah dan sengaja ditegakkan di sini:
 *
 * 1. Harga yang tidak diketahui BUKAN nol. Produk tanpa harga layak tidak boleh
 *    lolos filter budget, dan pada urutan harga ia jatuh ke belakang, bukan ke
 *    depan seolah paling murah (PRD FR-02 dan §6).
 *
 * 2. Saat filter RAM atau penyimpanan aktif, harga dihitung ulang HANYA dari
 *    varian yang cocok. Tanpa ini kartu bisa memasang harga varian yang justru
 *    tidak diminta pengguna (PRD §7 butir 3).
 */
export async function searchCatalog(
  now: Date,
  query: CatalogQuery
): Promise<CatalogSearchResult> {
  const catalog = await loadPublishedCatalog(now);

  const facets: CatalogFacets = {
    brands: [...new Set(catalog.products.map((product) => product.brand))].sort(
      (a, b) => a.localeCompare(b, "id")
    ),
    ram: [...new Set(catalog.variants.map((variant) => variant.ramGb))].sort(
      (a, b) => a - b
    ),
    storage: [
      ...new Set(catalog.variants.map((variant) => variant.storageGb)),
    ].sort((a, b) => a - b),
  };

  const brandFilter = new Set(query.brands.map((brand) => brand.toLowerCase()));

  // Satu search bar, dibaca dua lapis: syarat terukur (harga, kapasitas, NFC,
  // 5G, topik ulasan) lebih dulu, lalu sisanya menjadi kata kunci.
  const semantic = interpretCatalogNeeds(query.query);
  const documents = catalog.products.map(buildSearchDocument);
  const plan = planKeywords(semantic.keywordText);
  const keywords = plan.keywords.filter((keyword) =>
    isKnownKeyword(keyword, documents)
  );
  const ignoredWords = plan.keywords.filter(
    (keyword) => !keywords.includes(keyword)
  );

  const semanticMaxPrice = semantic.maxPriceIdr === null
    ? null
    : semantic.maxPriceIdr - (semantic.maxPriceExclusive ? 1 : 0);
  const effectiveMaxPrice = semanticMaxPrice === null
    ? query.maxPrice
    : query.maxPrice === null
      ? semanticMaxPrice
      : Math.min(query.maxPrice, semanticMaxPrice);
  const priceBounded = hasPriceBound(query) || effectiveMaxPrice !== null;

  type Scored = {
    summary: ProductSummary;
    score: number;
    order: number;
    reviews: { summary: string; channelName: string; videoUrl: string }[];
  };
  const scored: Scored[] = [];

  catalog.products.forEach((product, order) => {
    if (brandFilter.size > 0 && !brandFilter.has(product.brand.toLowerCase())) {
      return;
    }
    if (semantic.requiredFeatures.includes("nfc") && product.specs.hasNfc !== true) return;
    if (semantic.requiredFeatures.includes("5g") && product.specs.is5G !== true) return;

    const topicReviews = semantic.reviewTopics.map((topic) =>
      catalog.reviews.find(
        (review) => review.productId === product.id && reviewMatchesTopic(review, topic)
      )
    );
    if (topicReviews.some((review) => !review)) return;
    const relevantReviews = [...new Map(
      topicReviews.filter((review) => review !== undefined).map((review) => [review.id, review])
    ).values()].map((review) => ({
      summary: review.summary,
      channelName: review.channelName,
      videoUrl: review.videoUrl,
    }));

    // Setiap kata kunci yang dikenal katalog wajib cocok (nama, merek, atau
    // tag spesifikasi). Skornya kecocokan teks, bukan kualitas produk.
    let score = 0;
    if (keywords.length > 0) {
      const match = matchKeywords(keywords, documents[order]);
      if (!match.matched) return;
      score =
        match.score * 10 +
        matchScore(`${product.brand} ${product.model}`, keywords.join(" "));
    }

    // Varian yang cocok dengan filter kapasitas. Ini juga yang jadi dasar harga.
    const variants = catalog.variants.filter(
      (variant) =>
        variant.productId === product.id &&
        (query.ram.length === 0 || query.ram.includes(variant.ramGb)) &&
        (semantic.minRamGb === null || variant.ramGb >= semantic.minRamGb) &&
        (query.storage.length === 0 ||
          query.storage.includes(variant.storageGb)) &&
        (semantic.minStorageGb === null || variant.storageGb >= semantic.minStorageGb)
    );
    if (variants.length === 0) return;

    const summary = buildProductSummary(product, variants, catalog, now);

    if (priceBounded) {
      // Hanya harga yang benar-benar layak boleh dinilai terhadap batas budget.
      // "Harga belum tersedia" tidak diam-diam dianggap masuk anggaran.
      if (summary.price.status !== "available") return;
      if (query.minPrice !== null && summary.price.priceIdr < query.minPrice) {
        return;
      }
      if (effectiveMaxPrice !== null && summary.price.priceIdr > effectiveMaxPrice) {
        return;
      }
    }

    scored.push({ summary, score, order, reviews: relevantReviews });
  });

  /**
   * Tingkat harga untuk pengurutan. Harga terakhir tercatat kini tampil sebagai
   * angka di kartu, jadi ikut diurutkan menurut harganya, tetapi SELALU di
   * belakang harga yang masih berlaku: harga lama tidak boleh tampil seolah
   * pilihan termurah saat ini (PRD §7 butir 5).
   */
  const priceTierOf = (summary: ProductSummary): number =>
    summary.price.status === "available" ? 0 : summary.price.status === "stale" ? 1 : 2;

  /** Harga untuk pengurutan; null = tidak ada harga tercatat sama sekali. */
  const priceOf = (summary: ProductSummary): number | null =>
    summary.price.status === "unavailable" ? null : summary.price.priceIdr;

  /**
   * Waktu harga terakhir benar-benar teramati; null = belum pernah. Harga
   * berlaku selalu lebih baru dari batas freshness, jadi otomatis di depan.
   */
  const checkedAtOf = (summary: ProductSummary): number | null =>
    summary.price.status === "available"
      ? new Date(summary.price.checkedAt).getTime()
      : summary.price.status === "stale"
        ? new Date(summary.price.observedAt).getTime()
        : null;

  /** Yang tidak punya nilai selalu ke belakang, apa pun arah urutannya. */
  function compareNullable(
    a: number | null,
    b: number | null,
    direction: "asc" | "desc"
  ): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return direction === "asc" ? a - b : b - a;
  }

  const sorted = [...scored].sort((a, b) => {
    switch (query.sort) {
      case "price-asc":
        return (
          priceTierOf(a.summary) - priceTierOf(b.summary) ||
          compareNullable(priceOf(a.summary), priceOf(b.summary), "asc") ||
          a.order - b.order
        );
      case "price-desc":
        return (
          priceTierOf(a.summary) - priceTierOf(b.summary) ||
          compareNullable(priceOf(a.summary), priceOf(b.summary), "desc") ||
          a.order - b.order
        );
      case "checked":
        return (
          compareNullable(
            checkedAtOf(a.summary),
            checkedAtOf(b.summary),
            "desc"
          ) || a.order - b.order
        );
      case "relevance":
      default:
        // Tanpa kata kunci, relevansi tidak punya arti; pertahankan urutan
        // katalog apa adanya alih-alih mengarang peringkat.
        return b.score - a.score || a.order - b.order;
    }
  });

  // Paginasi sungguhan di atas hasil yang sudah difilter dan diurutkan (PRD
  // FR-02: "bukan simulasi cursor palsu"). Halaman di luar jangkauan, mis.
  // tautan lama setelah katalog menyusut, jatuh ke halaman terakhir yang ada.
  const totalPages = Math.max(Math.ceil(sorted.length / CATALOG_PAGE_SIZE), 1);
  const page = Math.min(Math.max(query.page, 1), totalPages);
  const pageEntries = sorted.slice(
    (page - 1) * CATALOG_PAGE_SIZE,
    page * CATALOG_PAGE_SIZE
  );

  return {
    items: pageEntries.map((entry) => entry.summary),
    semanticReviews: Object.fromEntries(
      pageEntries.filter((entry) => entry.reviews.length > 0)
        .map((entry) => [entry.summary.id, entry.reviews])
    ),
    matched: sorted.length,
    totalPublished: catalog.products.length,
    facets,
    interpretation: {
      appliedLabels: semantic.appliedLabels,
      cautions: semantic.cautions,
      keywords,
      ignoredWords,
      subjectiveWords: plan.subjective,
      hasReviewTopic: semantic.reviewTopics.length > 0,
    },
    page,
    pageSize: CATALOG_PAGE_SIZE,
    totalPages,
  };
}

/** Kunci varian yang dipakai di URL halaman detail, mis. "8-256". */
export function variantKey(variant: Variant): string {
  return `${variant.ramGb}-${variant.storageGb}`;
}

export type ProductDetailVariant = {
  id: string;
  key: string;
  label: string;
  ramGb: number;
  storageGb: number;
  /** `null` = atribut pembeda lain tidak tercatat, bukan berarti tidak ada. */
  region: string | null;
  href: string;
  isSelected: boolean;
  /** Harga varian ini sendiri, supaya pemilih varian jujur soal ketersediaan. */
  price: PriceResolution;
};

export type ProductDetailOffer = {
  id: string;
  marketplace: string;
  sellerName: string;
  url: string;
  warranty: string | null;
  listingStatus: Offer["listingStatus"];
  sellerVerified: boolean;
  priceIdr: number | null;
  observedAt: string | null;
  /** Waktu pemeriksaan BERHASIL terakhir; percobaan gagal tidak menggesernya. */
  checkedAt: string | null;
  isFreshPrice: boolean;
  /** Penawaran inilah yang menjadi dasar harga aktif varian terpilih. */
  isPriceBasis: boolean;
  /** Toko terdaftar; `null` bila domain listing belum dikenal. */
  store: { slug: string; name: string; kind: "official" | "marketplace" | "retailer" } | null;
};

export type ProductSpecRow = {
  label: string;
  /** `null` berarti belum diketahui, bukan tidak ada dan bukan nol. */
  value: string | null;
};

export type ProductReview = {
  id: string;
  channelName: string;
  videoUrl: string;
  publishedAt: string;
  timestampSeconds: number | null;
  aspect: string;
  summary: string;
  strengths: string[];
  limitations: string[];
  testContext: string | null;
  /** Review yang terikat varian tertentu, supaya konteksnya tidak digeneralisir. */
  variantLabel: string | null;
};

export type ProductDetail = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  name: string;
  image: ProductSummary["image"];
  /**
   * Semua foto produk asli, foto utama lebih dulu. Kosong bila produk hanya
   * punya ilustrasi generik; ilustrasi tidak pernah dicampur ke galeri foto.
   */
  gallery: { src: string; alt: string; source: string }[];
  specs: ProductSpecRow[];
  specsSource: string;
  specsRetrievedAt: string;
  variants: ProductDetailVariant[];
  selectedVariant: ProductDetailVariant | null;
  /** Harga varian TERPILIH, bukan harga terendah lintas varian (PRD §7 butir 3). */
  price: PriceResolution;
  offers: ProductDetailOffer[];
  reviews: ProductReview[];
};

/**
 * Merangkai susunan kamera belakang jadi satu kalimat pendek, mis. "Triple
 * kamera (ultrawide, telefoto 3.5x)". `null` kalau jumlah lensa tidak
 * diketahui — flag ultrawide/telefoto yang diketahui tanpa jumlah lensa tidak
 * cukup untuk menyusun kalimat yang jujur, jadi baris ini ikut kosong.
 */
function formatCameraArrangement(specs: ProductSpecs): string | null {
  if (specs.cameraLensCount === null) return null;

  const COUNT_LABEL: Record<number, string> = {
    1: "Kamera tunggal",
    2: "Dual kamera",
    3: "Triple kamera",
    4: "Quad kamera",
  };
  const base = COUNT_LABEL[specs.cameraLensCount] ?? `${specs.cameraLensCount} kamera`;

  const notes: string[] = [];
  if (specs.cameraHasUltrawide) notes.push("ultrawide");
  if (specs.cameraHasTelephoto) {
    notes.push(
      specs.cameraOpticalZoomX
        ? `telefoto ${specs.cameraOpticalZoomX}x`
        : "telefoto"
    );
  }

  return notes.length > 0 ? `${base} (${notes.join(", ")})` : base;
}

/**
 * Detail satu produk untuk `/products/[slug]` (PRD FR-03 dan FR-05).
 *
 * Yang ditegakkan di sini:
 *
 * - Halaman detail memakai harga VARIAN TERPILIH, bukan "mulai dari" lintas
 *   varian. PRD §7 butir 3 melarang mencampur basis harga diam-diam.
 * - Penawaran yang ditampilkan hanya milik varian terpilih, sehingga listing
 *   varian lain tidak pernah jadi basis harga (PRD FR-05).
 * - Penawaran yang tidak layak (habis, ambigu, nonaktif) tetap ditampilkan agar
 *   pengguna tahu keberadaannya, tapi ditandai dan tidak menjadi dasar harga.
 * - Spesifikasi yang tidak diketahui dikembalikan sebagai `null`, bukan
 *   dihilangkan, supaya UI bisa menandainya secara eksplisit.
 *
 * Mengembalikan `null` bila slug tidak dikenal; pemanggil yang memutuskan
 * memanggil `notFound()`.
 */
function buildProductDetail(
  catalog: CatalogDataset,
  product: CatalogDataset["products"][number],
  requestedVariantKey: string | undefined,
  now: Date
): ProductDetail {
  const rawVariants = catalog.variants.filter(
    (variant) => variant.productId === product.id
  );

  // Varian default mengikuti basis harga "mulai dari", supaya pengguna yang
  // datang dari kartu katalog melihat harga yang sama dengan yang tadi diklik.
  const startingPrice = resolveStartingPrice({
    variants: rawVariants,
    offers: catalog.offers,
    observations: catalog.priceObservations,
    checks: catalog.priceChecks,
    now,
  });

  const defaultVariant =
    rawVariants.find(
      (variant) => variant.id === startingPrice.referenceVariantId
    ) ??
    rawVariants[0] ??
    null;

  const selectedRaw =
    (requestedVariantKey
      ? rawVariants.find(
          (variant) => variantKey(variant) === requestedVariantKey
        )
      : undefined) ?? defaultVariant;

  const variants: ProductDetailVariant[] = rawVariants.map((variant) => {
    const key = variantKey(variant);
    return {
      id: variant.id,
      key,
      label: formatVariantLabel(variant),
      ramGb: variant.ramGb,
      storageGb: variant.storageGb,
      region: variant.region,
      href: `/products/${product.slug}?varian=${key}`,
      isSelected: selectedRaw?.id === variant.id,
      price: resolveVariantPrice({
        variantId: variant.id,
        offers: catalog.offers,
        observations: catalog.priceObservations,
        checks: catalog.priceChecks,
        now,
      }),
    };
  });

  const selectedVariant = variants.find((variant) => variant.isSelected) ?? null;

  const price: PriceResolution = selectedVariant
    ? selectedVariant.price
    : { status: "unavailable" };

  const priceBasisOfferId =
    price.status === "available" || price.status === "stale"
      ? price.offerId
      : null;

  const offers: ProductDetailOffer[] = selectedRaw
    ? catalog.offers
        .filter((offer) => offer.variantId === selectedRaw.id)
        .map((offer) => {
          const observation = latestObservation(
            offer.id,
            catalog.priceObservations
          );
          return {
            id: offer.id,
            marketplace: offer.marketplace,
            sellerName: offer.sellerName,
            url: offer.url,
            warranty: offer.warranty,
            listingStatus: offer.listingStatus,
            sellerVerified: offer.sellerVerified,
            store: (() => {
              const store = catalog.stores.find((entry) => entry.id === offer.storeId);
              return store ? { slug: store.slug, name: store.name, kind: store.kind } : null;
            })(),
            priceIdr: observation?.priceIdr ?? null,
            observedAt: observation?.observedAt ?? null,
            checkedAt: lastSuccessfulCheckAt(offer.id, catalog.priceChecks),
            isFreshPrice: observation
              ? isFresh(observation.observedAt, now) && isPriceableListing(offer)
              : false,
            isPriceBasis: offer.id === priceBasisOfferId,
          };
        })
        // Yang menjadi dasar harga ditaruh paling atas, sisanya menyusul.
        .sort((a, b) => Number(b.isPriceBasis) - Number(a.isPriceBasis))
    : [];

  const variantLabelById = new Map(
    variants.map((variant) => [variant.id, variant.label])
  );

  const reviews: ProductReview[] = catalog.reviews
    .filter((review) => review.productId === product.id)
    .map((review) => ({
      id: review.id,
      channelName: review.channelName,
      videoUrl: review.videoUrl,
      publishedAt: review.publishedAt,
      timestampSeconds: review.timestampSeconds,
      aspect: review.aspect,
      summary: review.summary,
      strengths: review.strengths,
      limitations: review.limitations,
      testContext: review.testContext,
      variantLabel: review.variantId
        ? (variantLabelById.get(review.variantId) ?? null)
        : null,
    }));

  const asset =
    catalog.assets.find(
      (candidate) =>
        candidate.productId === product.id && candidate.kind === "photo"
    ) ??
    catalog.assets.find((candidate) => candidate.productId === product.id);

  const specs: ProductSpecRow[] = [
    {
      label: "Layar",
      value: product.specs.displayInches
        ? [
            `${product.specs.displayInches} inci`,
            product.specs.displayTechnology,
          ]
            .filter(Boolean)
            .join(", ")
        : null,
    },
    {
      label: "Refresh rate",
      value: product.specs.refreshRateHz
        ? `${product.specs.refreshRateHz} Hz`
        : null,
    },
    { label: "Chipset", value: product.specs.chipset },
    {
      label: "Baterai",
      value: product.specs.batteryMah ? `${product.specs.batteryMah} mAh` : null,
    },
    {
      label: "Pengisian",
      value: product.specs.chargingWatt
        ? `${product.specs.chargingWatt} W`
        : null,
    },
    {
      label: "Kamera utama",
      value: product.specs.mainCameraMp
        ? `${product.specs.mainCameraMp} MP`
        : null,
    },
    {
      // Baris terpisah dari "Kamera utama" dengan sengaja: resolusi dan susunan
      // lensa adalah dua fakta berbeda. Produk bisa punya salah satu diketahui
      // tanpa yang lain (mis. p-note-12: MP diketahui, susunan lensa belum),
      // dan menggabungkannya jadi satu baris akan memaksa salah satunya
      // ditebak atau disembunyikan.
      label: "Susunan kamera",
      value: formatCameraArrangement(product.specs),
    },
    {
      label: "Bobot",
      value: product.specs.weightGrams
        ? `${product.specs.weightGrams} gram`
        : null,
    },
    {
      label: "Tahun rilis",
      value: product.specs.releaseYear
        ? String(product.specs.releaseYear)
        : null,
    },
    {
      label: "Jaringan",
      value:
        product.specs.is5G === null
          ? null
          : product.specs.is5G
            ? "5G"
            : "4G LTE",
    },
    {
      label: "NFC",
      value:
        product.specs.hasNfc === null
          ? null
          : product.specs.hasNfc
            ? "Ada"
            : "Tidak ada",
    },
    { label: "Ketahanan (IP rating)", value: product.specs.ipRating },
    {
      label: "Jack headphone 3.5mm",
      value:
        product.specs.has35mmJack === null
          ? null
          : product.specs.has35mmJack
            ? "Ada"
            : "Tidak ada",
    },
    { label: "Sistem operasi", value: product.specs.osVersion },
    {
      label: "Pilihan warna",
      value: product.specs.colorOptions?.length
        ? product.specs.colorOptions.join(", ")
        : null,
    },
  ];

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
    gallery: catalog.assets
      .filter(
        (candidate) =>
          candidate.productId === product.id && candidate.kind === "photo"
      )
      .map((photo) => ({
        src: photo.src,
        alt: photo.alt,
        source: photo.provenance.source,
      })),
    specs,
    specsSource: product.specsProvenance.source,
    specsRetrievedAt: product.specsProvenance.retrievedAt,
    variants,
    selectedVariant,
    price,
    offers,
    reviews,
  };
}

export async function getProductDetail(
  now: Date,
  slug: string,
  requestedVariantKey?: string
): Promise<ProductDetail | null> {
  const catalog = await loadPublishedCatalog(now);
  const product = catalog.products.find((candidate) => candidate.slug === slug);
  if (!product) return null;
  return buildProductDetail(catalog, product, requestedVariantKey, now);
}

/** Slug produk terpublikasi, untuk prerender halaman detail saat build. */
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
export type CompareRowState = "same" | "different" | "incomplete";

/** Ikon garis per atribut; digambar sendiri di `compare/spec-icons.tsx`. */
export type CompareSpecIcon =
  | "display"
  | "refresh"
  | "chip"
  | "os"
  | "camera"
  | "lenses"
  | "battery"
  | "charging"
  | "memory"
  | "storage"
  | "weight"
  | "water"
  | "palette"
  | "network"
  | "nfc"
  | "jack"
  | "calendar"
  | "shield";

export type CompareRow = {
  label: string;
  state: CompareRowState;
  /** Nilai per item, urutannya sama dengan urutan item. */
  values: (string | null)[];
  icon: CompareSpecIcon;
  /** Nilai pendek yang ditampilkan besar (mis. "5G", "5000 mAh"). */
  headline: boolean;
};

export type CompareSection = {
  id: string;
  title: string;
  rows: CompareRow[];
};

export type CompareItem = {
  slug: string;
  name: string;
  brand: string;
  model: string;
  image: ProductSummary["image"];
  variantLabel: string | null;
  variantKey: string | null;
  price: PriceResolution;
  detailHref: string;
  removeHref: string;
  /** Varian lain untuk produk ini, supaya bisa ditukar tanpa keluar halaman. */
  variantOptions: {
    key: string;
    label: string;
    href: string;
    ramGb: number;
    storageGb: number;
  }[];
  /** Konteks pengalaman reviewer (PRD FR-04 meminta ini ikut ditampilkan). */
  reviewNotes: { channelName: string; aspect: string; summary: string }[];
};

export type CompareResult = {
  items: CompareItem[];
  /** Semua baris, datar. Sama isinya dengan gabungan `sections`. */
  rows: CompareRow[];
  /** Baris yang dikelompokkan per bagian (Layar, Kamera, ...). */
  sections: CompareSection[];
  /** Pilihan yang sudah diselesaikan, untuk menukar produk per kolom. */
  selections: CompareSelection[];
  /**
   * Selisih harga hanya terisi bila MINIMAL DUA item punya harga layak
   * (PRD FR-04). Item tanpa harga layak tidak pernah ikut dihitung.
   */
  priceSpread: {
    differenceIdr: number;
    cheapestName: string;
    mostExpensiveName: string;
    comparedCount: number;
  } | null;
  /** Nama item yang tidak punya harga layak, dinyatakan terbuka. */
  itemsWithoutPrice: string[];
  /** Produk lain yang masih bisa ditambahkan. */
  addable: { slug: string; name: string; href: string }[];
  isFull: boolean;
};

/**
 * Susunan bagian perbandingan, meniru pola "Spesifikasi Utama" situs resmi
 * produsen: dikelompokkan per topik, bukan satu daftar panjang. Label baris
 * sama dengan label `ProductDetail.specs`, kecuali RAM, Penyimpanan, dan
 * Garansi yang diambil dari varian terpilih.
 */
const COMPARE_SECTIONS: {
  id: string;
  title: string;
  rows: { label: string; icon: CompareSpecIcon; headline?: boolean }[];
}[] = [
  {
    id: "layar",
    title: "Layar",
    rows: [
      { label: "Layar", icon: "display" },
      { label: "Refresh rate", icon: "refresh" },
    ],
  },
  {
    id: "kamera",
    title: "Kamera",
    rows: [
      { label: "Kamera utama", icon: "camera", headline: true },
      { label: "Susunan kamera", icon: "lenses" },
    ],
  },
  {
    id: "performa",
    title: "Performa",
    rows: [
      { label: "Chipset", icon: "chip" },
      { label: "Sistem operasi", icon: "os" },
    ],
  },
  {
    id: "baterai",
    title: "Baterai",
    rows: [
      { label: "Baterai", icon: "battery", headline: true },
      { label: "Pengisian", icon: "charging" },
    ],
  },
  {
    id: "memori",
    title: "Memori varian terpilih",
    rows: [
      { label: "RAM", icon: "memory", headline: true },
      { label: "Penyimpanan", icon: "storage", headline: true },
    ],
  },
  {
    id: "desain",
    title: "Desain dan ketahanan",
    rows: [
      { label: "Bobot", icon: "weight" },
      { label: "Ketahanan (IP rating)", icon: "water" },
      { label: "Pilihan warna", icon: "palette" },
    ],
  },
  {
    id: "konektivitas",
    title: "Konektivitas",
    rows: [
      { label: "Jaringan", icon: "network", headline: true },
      { label: "NFC", icon: "nfc" },
      { label: "Jack headphone 3.5mm", icon: "jack" },
    ],
  },
  {
    id: "lainnya",
    title: "Lainnya",
    rows: [
      { label: "Tahun rilis", icon: "calendar" },
      { label: "Garansi", icon: "shield" },
    ],
  },
];

/**
 * Menyusun perbandingan 2-3 kandidat (PRD FR-04).
 *
 * Yang ditegakkan di sini:
 *
 * - Tidak ada skor, peringkat, atau pemenang. Fungsi ini hanya melaporkan
 *   nilainya dan apakah nilainya berbeda.
 * - Atribut yang salah satu nilainya tidak diketahui ditandai `incomplete`,
 *   bukan `different`, supaya UI tidak menampilkannya seolah keunggulan atau
 *   kekurangan.
 * - Spesifikasi mengikuti varian yang dipilih untuk tiap produk, sehingga
 *   harga dan spesifikasi selalu berasal dari varian yang sama.
 */
export async function getComparison(
  now: Date,
  selections: CompareSelection[]
): Promise<CompareResult> {
  const catalog = await loadPublishedCatalog(now);

  const details = selections
    .map((selection) => {
      // Tautan bandingkan lama dengan slug yang sudah diganti tetap berfungsi.
      const product = findProductBySlug(catalog, selection.slug);
      if (!product) return null;
      return {
        selection,
        detail: buildProductDetail(
          catalog,
          product,
          selection.variantKey ?? undefined,
          now
        ),
      };
    })
    .filter((entry) => entry !== null);

  const resolvedSelections: CompareSelection[] = details.map((entry) => ({
    slug: entry.detail.slug,
    variantKey: entry.detail.selectedVariant?.key ?? null,
  }));

  const items: CompareItem[] = details.map((entry, index) => {
    const { detail } = entry;

    const others = resolvedSelections.filter((_, other) => other !== index);

    return {
      slug: detail.slug,
      name: detail.name,
      brand: detail.brand,
      model: detail.model,
      image: detail.image,
      variantLabel: detail.selectedVariant?.label ?? null,
      variantKey: detail.selectedVariant?.key ?? null,
      price: detail.price,
      detailHref: detail.selectedVariant
        ? `/products/${detail.slug}?varian=${detail.selectedVariant.key}`
        : `/products/${detail.slug}`,
      removeHref: buildCompareHref(others),
      variantOptions: detail.variants.map((variant) => ({
        key: variant.key,
        label: variant.label,
        ramGb: variant.ramGb,
        storageGb: variant.storageGb,
        href: buildCompareHref(
          resolvedSelections.map((selection, other) =>
            other === index
              ? { slug: detail.slug, variantKey: variant.key }
              : selection
          )
        ),
      })),
      reviewNotes: detail.reviews.map((review) => ({
        channelName: review.channelName,
        aspect: review.aspect,
        summary: review.summary,
      })),
    };
  });

  const buildRow = ({
    label,
    icon,
    headline = false,
  }: (typeof COMPARE_SECTIONS)[number]["rows"][number]): CompareRow => {
    const values = details.map((entry) => {
      const { detail } = entry;

      if (label === "RAM") {
        return detail.selectedVariant
          ? `${detail.selectedVariant.ramGb} GB`
          : null;
      }
      if (label === "Penyimpanan") {
        return detail.selectedVariant
          ? `${detail.selectedVariant.storageGb} GB`
          : null;
      }
      if (label === "Garansi") {
        return detail.selectedVariant?.region ?? null;
      }
      return detail.specs.find((spec) => spec.label === label)?.value ?? null;
    });

    const hasUnknown = values.some((value) => value === null);
    const allEqual = values.every((value) => value === values[0]);

    return {
      label,
      values,
      icon,
      headline,
      state: hasUnknown ? "incomplete" : allEqual ? "same" : "different",
    };
  };
  const sections: CompareSection[] = COMPARE_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    rows: section.rows.map(buildRow),
  }));
  const rows = sections.flatMap((section) => section.rows);

  const priced = items.filter(
    (item): item is CompareItem & { price: { priceIdr: number } } =>
      item.price.status === "available"
  );

  const priceSpread =
    priced.length >= 2
      ? (() => {
          const sorted = [...priced].sort(
            (a, b) => a.price.priceIdr - b.price.priceIdr
          );
          const cheapest = sorted[0];
          const mostExpensive = sorted[sorted.length - 1];
          return {
            differenceIdr: mostExpensive.price.priceIdr - cheapest.price.priceIdr,
            cheapestName: cheapest.name,
            mostExpensiveName: mostExpensive.name,
            comparedCount: priced.length,
          };
        })()
      : null;

  const chosenSlugs = new Set(items.map((item) => item.slug));

  const addable = catalog.products
    .filter((product) => !chosenSlugs.has(product.slug))
    .map((product) => ({
      slug: product.slug,
      name: `${product.brand} ${product.model}`,
      href: buildCompareHref([
        ...resolvedSelections,
        { slug: product.slug, variantKey: null },
      ]),
    }));

  return {
    items,
    rows,
    sections,
    selections: resolvedSelections,
    priceSpread,
    itemsWithoutPrice: items
      .filter((item) => item.price.status !== "available")
      .map((item) => item.name),
    addable,
    isFull: items.length >= MAX_COMPARE_ITEMS,
  };
}

export { isDemoData };


