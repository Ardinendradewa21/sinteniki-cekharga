import "server-only";

import { hasPriceBound, type CatalogQuery } from "@/lib/catalog/search-params";
import { interpretCatalogNeeds, reviewMatchesTopic } from "@/lib/catalog/semantic-needs";
import { buildSearchDocument, isKnownKeyword, matchKeywords, planKeywords } from "@/lib/catalog/keyword-search";
import { type ProductSummary, buildProductSummary, loadPublishedCatalog } from "@/lib/catalog/core";

/** Pencarian katalog (PRD FR-02): filter, kata kunci, kebutuhan semantik, urutan, halaman. */

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
const CATALOG_PAGE_SIZE = 20;

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
