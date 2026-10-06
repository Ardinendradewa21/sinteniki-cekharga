import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectWhereIn } from "@/lib/backend/paged-read";
import { requireStaff } from "@/lib/auth/dal";
import { mapWithConcurrency } from "@/lib/import/batch";
import { isFresh } from "@/lib/catalog/pricing";

/**
 * Pembacaan data untuk antarmuka admin.
 *
 * Berbeda dari `src/lib/catalog/queries.ts` yang hanya melihat data
 * terpublikasi, modul ini sengaja melihat SEMUANYA termasuk draft. Karena itu
 * setiap fungsi di sini memanggil `requireStaff([])` (hanya peran admin) lebih dulu, bukan
 * mengandalkan halaman pemanggilnya sudah memeriksa. Kalau suatu saat fungsi
 * ini dipanggil dari tempat baru yang lupa memeriksa, gerbangnya tetap menutup.
 */

export type AdminProductRow = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  status: "draft" | "published";
  updatedAt: string;
  variantCount: number;
  offerCount: number;
  image: {
    src: string;
    alt: string;
    isGenericIllustration: boolean;
  };
  recordedPrice: {
    priceIdr: number;
    observedAt: string;
  } | null;
};

export type AdminProductPage = {
  items: AdminProductRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminProductOverviewRow = Omit<
  AdminProductRow,
  "image" | "recordedPrice"
> & {
  hasPhoto: boolean;
  priceStatus: "fresh" | "stale" | "missing";
  /**
   * Spesifikasi kunci yang belum tercatat. `hasNfc` null berarti sumbernya
   * menulis "tergantung pasar" atau kosong; `ipRating` null bisa berarti
   * memang tanpa sertifikasi. Keduanya perlu dicek manual, bukan ditarik ulang.
   */
  specGaps: ("nfc" | "ip")[];
};

export type AdminProductDetail = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  status: "draft" | "published";
  sourceKey: string | null;
  specsSource: string;
  specsSourceUrl: string | null;
  specs: Record<string, unknown>;
  variants: {
    id: string;
    ramGb: number;
    storageGb: number;
    region: string | null;
    offers: {
      id: string;
      marketplace: string;
      sellerName: string;
      url: string;
      warranty: string | null;
      listingStatus: string;
      sellerVerified: boolean;
      latestPriceIdr: number | null;
      latestObservedAt: string | null;
      /** Riwayat pemeriksaan terakhir, berhasil maupun gagal. */
      checks: { outcome: string; attemptedAt: string; errorSummary: string | null }[];
    }[];
  }[];
  reviews: AdminReviewRow[];
};

export type AdminReviewRow = {
  id: string;
  variantLabel: string | null;
  channelName: string;
  videoUrl: string;
  publishedAt: string;
  timestampSeconds: number | null;
  aspect: string;
  summary: string;
  strengths: string[];
  limitations: string[];
  testContext: string | null;
  status: "draft" | "published";
};

export type AuditRow = {
  id: string;
  actorEmail: string | null;
  operation: string;
  objectType: string;
  objectId: string | null;
  createdAt: string;
};

const ADMIN_PRODUCTS_PAGE_SIZE = 20;
const ADMIN_BRANDS_READ_SIZE = 500;
const GENERIC_PRODUCT_IMAGE = "/images/generic-device.svg";

function safeAdminImageSrc(src: string): string | null {
  if (src.startsWith("/") && !src.startsWith("//")) return src;

  try {
    const imageUrl = new URL(src);
    const storageUrl = new URL(process.env.INSFORGE_URL ?? "");
    return imageUrl.protocol === "https:" &&
      imageUrl.hostname === storageUrl.hostname &&
      imageUrl.pathname.startsWith(
        "/api/storage/buckets/product-images/objects/"
      )
      ? imageUrl.href
      : null;
  } catch {
    return null;
  }
}

/** Opsi filter diambil dari semua produk, termasuk draft. */
export async function listAdminProductBrands(): Promise<string[]> {
  await requireStaff([]);
  const db = getInsforgeAdminClient().database;
  const brands = new Set<string>();

  // SDK tidak menyediakan DISTINCT untuk query tabel. Baca hanya kolom ringan
  // secara bertahap supaya opsi tetap lengkap tanpa satu select tak terbatas.
  for (let from = 0; ; from += ADMIN_BRANDS_READ_SIZE) {
    const { data, error } = await db
      .from("products")
      .select("id, brand")
      .order("brand", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + ADMIN_BRANDS_READ_SIZE - 1);

    if (error) throw new Error("Gagal membaca daftar merek produk admin.");
    const rows = (data ?? []) as { id: string; brand: string }[];
    for (const row of rows) {
      if (typeof row.brand === "string" && row.brand.trim()) brands.add(row.brand);
    }
    if (rows.length < ADMIN_BRANDS_READ_SIZE) break;
  }

  return [...brands].sort(new Intl.Collator("id", { sensitivity: "base" }).compare);
}

/**
 * Daftar produk admin yang dicari dan dipaginasi di database.
 *
 * Hanya varian dan penawaran milik produk di halaman aktif yang ikut dibaca.
 * Ini menjaga halaman tetap ringan ketika katalog membesar.
 */
export async function listAdminProductsPage({
  query = "",
  brand = "",
  page = 1,
  pageSize = ADMIN_PRODUCTS_PAGE_SIZE,
}: {
  query?: string;
  brand?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<AdminProductPage> {
  await requireStaff([]);
  const db = getInsforgeAdminClient().database;

  const safePageSize = Math.min(Math.max(Math.trunc(pageSize), 1), 50);
  const requestedPage = Math.max(Math.trunc(page) || 1, 1);
  const searchTerm = query
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  const createProductQuery = (withCount: boolean) => {
    let productQuery = db
      .from("products")
      .select("id, slug, brand, model, status, updated_at", {
        count: withCount ? "exact" : undefined,
      })
      .order("brand", { ascending: true })
      .order("model", { ascending: true })
      .order("id", { ascending: true });

    if (searchTerm) {
      const slugTerm = searchTerm.replace(/\s+/g, "-");
      productQuery = productQuery.or(
        `brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,slug.ilike.%${slugTerm}%`
      );
    }

    if (brand) productQuery = productQuery.eq("brand", brand);

    return productQuery;
  };

  const firstFrom = (requestedPage - 1) * safePageSize;
  let productResult = await createProductQuery(true).range(
    firstFrom,
    firstFrom + safePageSize - 1
  );

  if (productResult.error) {
    throw new Error("Gagal membaca daftar produk admin.");
  }

  const total = productResult.count ?? 0;
  const totalPages = Math.max(Math.ceil(total / safePageSize), 1);
  const resolvedPage = Math.min(requestedPage, totalPages);

  // URL halaman lama bisa menunjuk melewati halaman terakhir setelah data
  // dihapus. Ambil ulang halaman terakhir yang masih valid agar tidak terlihat
  // seperti katalog kosong.
  if (resolvedPage !== requestedPage && total > 0) {
    const from = (resolvedPage - 1) * safePageSize;
    productResult = await createProductQuery(false).range(
      from,
      from + safePageSize - 1
    );
    if (productResult.error) {
      throw new Error("Gagal membaca halaman terakhir daftar produk admin.");
    }
  }

  type ProductRow = {
    id: string;
    slug: string;
    brand: string;
    model: string;
    status: "draft" | "published";
    updated_at: string;
  };

  const productRows = (productResult.data ?? []) as ProductRow[];
  const productIds = productRows.map((product) => product.id);

  if (productIds.length === 0) {
    return {
      items: [],
      page: resolvedPage,
      pageSize: safePageSize,
      total,
      totalPages,
    };
  }

  // Dibaca per kelompok dan per halaman sampai habis (lihat paged-read):
  // `.limit()` saja bisa terpotong diam-diam oleh batas baris PostgREST.
  const [variantData, assetData] = await Promise.all([
    selectWhereIn("variants", "id, product_id", "product_id", productIds),
    selectWhereIn(
      "product_assets",
      "id, product_id, kind, src, alt, created_at",
      "product_id",
      productIds,
      { order: [{ column: "created_at", ascending: true }] }
    ),
  ]);

  const variantRows = variantData as { id: string; product_id: string }[];
  const variantIds = variantRows.map((variant) => variant.id);

  type OfferRow = {
    id: string;
    variant_id: string;
    condition: string;
    listing_status: string;
  };
  const offerRows = (await selectWhereIn(
    "offers",
    "id, variant_id, condition, listing_status",
    "variant_id",
    variantIds
  )) as OfferRow[];

  const priceableOfferRows = offerRows.filter(
    (offer) => offer.condition === "new" && offer.listing_status === "active"
  );
  // View `offer_latest_price` sudah satu baris per penawaran (pengamatan
  // terbaru), jadi riwayat lengkap tidak perlu ditarik ke aplikasi.
  const priceObservationRows = (await selectWhereIn(
    "offer_latest_price",
    "offer_id, price_idr, observed_at",
    "offer_id",
    priceableOfferRows.map((offer) => offer.id),
    { uniqueKey: ["offer_id"] }
  )) as { offer_id: string; price_idr: number | string; observed_at: string }[];

  const variantsByProduct = new Map<string, string[]>();
  const productByVariant = new Map<string, string>();
  for (const v of variantRows) {
    productByVariant.set(v.id, v.product_id);
    variantsByProduct.set(v.product_id, [
      ...(variantsByProduct.get(v.product_id) ?? []),
      v.id,
    ]);
  }
  const offerCountByVariant = new Map<string, number>();
  for (const o of offerRows) {
    offerCountByVariant.set(o.variant_id, (offerCountByVariant.get(o.variant_id) ?? 0) + 1);
  }

  type AssetRow = {
    id: string;
    product_id: string;
    kind: "photo" | "generic-illustration";
    src: string;
    alt: string;
    created_at: string;
  };
  const assetByProduct = new Map<string, AssetRow>();
  for (const asset of assetData as AssetRow[]) {
    const current = assetByProduct.get(asset.product_id);
    if (!current || (asset.kind === "photo" && current.kind !== "photo")) {
      assetByProduct.set(asset.product_id, asset);
    }
  }

  const latestObservationByOffer = new Map<
    string,
    { priceIdr: number; observedAt: string }
  >();
  for (const observation of priceObservationRows) {
    if (latestObservationByOffer.has(observation.offer_id)) continue;
    const priceIdr = Number(observation.price_idr);
    if (!Number.isFinite(priceIdr) || priceIdr < 0) continue;
    latestObservationByOffer.set(observation.offer_id, {
      priceIdr,
      observedAt: observation.observed_at,
    });
  }

  const recordedPriceByProduct = new Map<
    string,
    { priceIdr: number; observedAt: string }
  >();
  for (const offer of priceableOfferRows) {
    const productId = productByVariant.get(offer.variant_id);
    const observation = latestObservationByOffer.get(offer.id);
    if (!productId || !observation) continue;
    const current = recordedPriceByProduct.get(productId);
    if (!current || observation.priceIdr < current.priceIdr) {
      recordedPriceByProduct.set(productId, observation);
    }
  }

  const items = productRows.map((p) => {
      const ids = variantsByProduct.get(p.id) ?? [];
      const asset = assetByProduct.get(p.id);
      const safeImageSrc = asset ? safeAdminImageSrc(asset.src) : null;
      return {
        id: p.id,
        slug: p.slug,
        brand: p.brand,
        model: p.model,
        status: p.status,
        updatedAt: p.updated_at,
        variantCount: ids.length,
        offerCount: ids.reduce((sum, id) => sum + (offerCountByVariant.get(id) ?? 0), 0),
        image: {
          src: safeImageSrc ?? GENERIC_PRODUCT_IMAGE,
          alt: safeImageSrc
            ? asset?.alt || `Foto ${p.brand} ${p.model}`
            : "Ilustrasi generik perangkat smartphone",
          isGenericIllustration: !safeImageSrc || asset?.kind !== "photo",
        },
        recordedPrice: recordedPriceByProduct.get(p.id) ?? null,
      };
    });

  return {
    items,
    page: resolvedPage,
    pageSize: safePageSize,
    total,
    totalPages,
  };
}

/**
 * Daftar ringan untuk statistik dasbor.
 *
 * Selain statistik dasar, baris ini membawa kesehatan data yang dapat
 * ditindaklanjuti: foto asli dan freshness harga. Kolom berat seperti `specs`
 * tetap tidak dibaca. Semua list dibatasi dan filter UUID dipecah agar aman
 * saat katalog bertambah.
 */
export async function listAdminProducts(
  now = new Date()
): Promise<AdminProductOverviewRow[]> {
  await requireStaff([]);
  const db = getInsforgeAdminClient().database;
  const productRows: {
    id: string;
    slug: string;
    brand: string;
    model: string;
    status: "draft" | "published";
    updated_at: string;
    nfc: unknown;
    ip: unknown;
  }[] = [];

  for (let from = 0; ; from += ADMIN_BRANDS_READ_SIZE) {
    // Hanya dua kunci JSON yang dibaca, bukan seluruh kolom `specs`.
    const result = await db
      .from("products")
      .select("id, slug, brand, model, status, updated_at, nfc:specs->hasNfc, ip:specs->ipRating")
      .order("brand", { ascending: true })
      .order("model", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + ADMIN_BRANDS_READ_SIZE - 1);

    if (result.error) throw new Error("Gagal membaca ringkasan produk admin.");
    const page = (result.data ?? []) as typeof productRows;
    productRows.push(...page);
    if (page.length < ADMIN_BRANDS_READ_SIZE) break;
  }

  // Dasbor membaca SELURUH katalog, jadi batas `.limit()` lama paling cepat
  // terpotong di sini. Dibaca lengkap per halaman lewat paged-read.
  const productIds = productRows.map((product) => product.id);
  const [variantData, assetData] = await Promise.all([
    selectWhereIn("variants", "id, product_id", "product_id", productIds),
    selectWhereIn("product_assets", "id, product_id, kind", "product_id", productIds),
  ]);
  const variantRows = variantData as { id: string; product_id: string }[];
  const assetRows = assetData as {
    id: string;
    product_id: string;
    kind: "photo" | "generic-illustration";
  }[];

  const offerRows = (await selectWhereIn(
    "offers",
    "id, variant_id, condition, listing_status",
    "variant_id",
    variantRows.map((variant) => variant.id)
  )) as {
    id: string;
    variant_id: string;
    condition: string;
    listing_status: string;
  }[];

  const priceableOfferRows = offerRows.filter(
    (offer) => offer.condition === "new" && offer.listing_status === "active"
  );
  const observationRows = (await selectWhereIn(
    "offer_latest_price",
    "offer_id, observed_at",
    "offer_id",
    priceableOfferRows.map((offer) => offer.id),
    { uniqueKey: ["offer_id"] }
  )) as { offer_id: string; observed_at: string }[];

  const variantsByProduct = new Map<string, string[]>();
  for (const variant of variantRows) {
    variantsByProduct.set(variant.product_id, [
      ...(variantsByProduct.get(variant.product_id) ?? []),
      variant.id,
    ]);
  }
  const offersByVariant = new Map<string, number>();
  for (const offer of offerRows) {
    offersByVariant.set(
      offer.variant_id,
      (offersByVariant.get(offer.variant_id) ?? 0) + 1
    );
  }

  const productByVariant = new Map(
    variantRows.map((variant) => [variant.id, variant.product_id])
  );
  const priceableOffersByProduct = new Map<string, string[]>();
  for (const offer of priceableOfferRows) {
    const productId = productByVariant.get(offer.variant_id);
    if (!productId) continue;
    priceableOffersByProduct.set(productId, [
      ...(priceableOffersByProduct.get(productId) ?? []),
      offer.id,
    ]);
  }

  const latestObservationByOffer = new Map<string, string>();
  for (const observation of observationRows) {
    if (!latestObservationByOffer.has(observation.offer_id)) {
      latestObservationByOffer.set(
        observation.offer_id,
        observation.observed_at
      );
    }
  }

  const productsWithPhoto = new Set(
    assetRows
      .filter((asset) => asset.kind === "photo")
      .map((asset) => asset.product_id)
  );

  return productRows.map((product) => {
    const variantIds = variantsByProduct.get(product.id) ?? [];
    const priceableOfferIds = priceableOffersByProduct.get(product.id) ?? [];
    const observationDates = priceableOfferIds
      .map((offerId) => latestObservationByOffer.get(offerId))
      .filter((value): value is string => value !== undefined);
    const priceStatus: AdminProductOverviewRow["priceStatus"] =
      observationDates.some((observedAt) => isFresh(observedAt, now))
        ? "fresh"
        : observationDates.length > 0
          ? "stale"
          : "missing";

    return {
      id: product.id,
      slug: product.slug,
      brand: product.brand,
      model: product.model,
      status: product.status,
      updatedAt: product.updated_at,
      variantCount: variantIds.length,
      offerCount: variantIds.reduce(
        (sum, variantId) => sum + (offersByVariant.get(variantId) ?? 0),
        0
      ),
      hasPhoto: productsWithPhoto.has(product.id),
      priceStatus,
      specGaps: [
        ...(typeof product.nfc === "boolean" ? [] : (["nfc"] as const)),
        ...(typeof product.ip === "string" && product.ip.trim() ? [] : (["ip"] as const)),
      ],
    };
  });
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  await requireStaff([]);
  const db = getInsforgeAdminClient().database;

  const productRes = await db.from("products").select().eq("id", id).limit(1);
  // Kegagalan baca tidak boleh tampil sebagai "produk tidak ada" atau "belum
  // ada penawaran"; admin bisa mengambil keputusan dari data yang salah.
  if (productRes.error) throw new Error("Gagal membaca produk admin.");
  const product = (productRes.data ?? [])[0] as Record<string, unknown> | undefined;
  if (!product) return null;

  const [variantRows, reviewRows] = await Promise.all([
    selectWhereIn("variants", "*", "product_id", [id]),
    selectWhereIn("review_summaries", "*", "product_id", [id]),
  ]);
  const variantIds = variantRows.map((v) => String(v.id));

  const offerRows = await selectWhereIn("offers", "*", "variant_id", variantIds);

  // Riwayat harga dan pemeriksaan terus bertambah. Membaca semuanya lalu
  // memotong dengan `.limit()` tanpa urutan bisa kehilangan baris TERBARU.
  // Yang ditampilkan hanya harga terakhir dan 5 pemeriksaan terakhir, jadi
  // itulah yang diminta per penawaran, terurut dari database.
  const perOffer = await mapWithConcurrency(offerRows, 6, async (offer) => {
    const offerId = String(offer.id);
    const [latestObservation, recentChecks] = await Promise.all([
      db
        .from("price_observations")
        .select("price_idr, observed_at")
        .eq("offer_id", offerId)
        .order("observed_at", { ascending: false })
        .limit(1),
      db
        .from("price_checks")
        .select("outcome, attempted_at, error_summary")
        .eq("offer_id", offerId)
        .order("attempted_at", { ascending: false })
        .limit(5),
    ]);
    if (latestObservation.error || recentChecks.error) {
      throw new Error("Gagal membaca riwayat harga produk admin.");
    }
    return {
      offerId,
      latest: (latestObservation.data ?? [])[0] as
        | { price_idr: number | string; observed_at: string }
        | undefined,
      checks: ((recentChecks.data ?? []) as Record<string, unknown>[]).map((row) => ({
        outcome: String(row.outcome),
        attemptedAt: String(row.attempted_at),
        errorSummary: (row.error_summary as string | null) ?? null,
      })),
    };
  });

  const checksByOffer = new Map(perOffer.map((entry) => [entry.offerId, entry.checks]));

  const variantLabelById = new Map(
    variantRows.map((v) => [String(v.id), `${v.ram_gb}/${v.storage_gb} GB`])
  );

  const reviews: AdminReviewRow[] = reviewRows
    .map((r) => ({
      id: String(r.id),
      variantLabel: r.variant_id ? (variantLabelById.get(String(r.variant_id)) ?? null) : null,
      channelName: String(r.channel_name),
      videoUrl: String(r.video_url),
      publishedAt: String(r.published_at),
      timestampSeconds: r.timestamp_seconds === null ? null : Number(r.timestamp_seconds),
      aspect: String(r.aspect),
      summary: String(r.summary),
      strengths: Array.isArray(r.strengths) ? r.strengths.map(String) : [],
      limitations: Array.isArray(r.limitations) ? r.limitations.map(String) : [],
      testContext: (r.test_context as string | null) ?? null,
      status: r.status as "draft" | "published",
    }))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const latestByOffer = new Map<string, { price: number; at: string }>();
  for (const entry of perOffer) {
    if (entry.latest) {
      latestByOffer.set(entry.offerId, {
        price: Number(entry.latest.price_idr),
        at: String(entry.latest.observed_at),
      });
    }
  }

  return {
    id: String(product.id),
    slug: String(product.slug),
    brand: String(product.brand),
    model: String(product.model),
    status: product.status as "draft" | "published",
    sourceKey: (product.source_key as string | null) ?? null,
    specsSource: String(product.specs_source),
    specsSourceUrl: (product.specs_source_url as string | null) ?? null,
    specs: (product.specs ?? {}) as Record<string, unknown>,
    variants: variantRows
      .map((v) => ({
        id: String(v.id),
        ramGb: Number(v.ram_gb),
        storageGb: Number(v.storage_gb),
        region: (v.region as string | null) ?? null,
        offers: offerRows
          .filter((o) => String(o.variant_id) === String(v.id))
          .map((o) => {
            const latest = latestByOffer.get(String(o.id));
            return {
              id: String(o.id),
              marketplace: String(o.marketplace),
              sellerName: String(o.seller_name),
              url: String(o.url),
              warranty: (o.warranty as string | null) ?? null,
              listingStatus: String(o.listing_status),
              sellerVerified: o.seller_verified === true,
              latestPriceIdr: latest?.price ?? null,
              latestObservedAt: latest?.at ?? null,
              checks: (checksByOffer.get(String(o.id)) ?? []).slice(0, 5),
            };
          }),
      }))
      .sort((a, b) => a.ramGb - b.ramGb || a.storageGb - b.storageGb),
    reviews,
  };
}

export async function listRecentAudit(limit = 20): Promise<AuditRow[]> {
  await requireStaff([]);
  const { data, error } = await getInsforgeAdminClient()
    .database.from("admin_audit")
    .select("id, actor_email, operation, object_type, object_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Gagal membaca perubahan terakhir admin.");

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    actorEmail: (r.actor_email as string | null) ?? null,
    operation: String(r.operation),
    objectType: String(r.object_type),
    objectId: (r.object_id as string | null) ?? null,
    createdAt: String(r.created_at),
  }));
}

export type ImportQuality = {
  pendingBatches: number;
  offersWithoutStore: number;
  totalPhotos: number;
  photosWithoutProof: number;
  failedChecks7d: number;
};

/**
 * Ringkasan kualitas data hasil impor untuk dasbor: hal-hal yang perlu
 * ditindaklanjuti admin, dihitung di database (count), bukan dengan membaca
 * seluruh baris.
 */
export async function getImportQuality(now: Date): Promise<ImportQuality> {
  await requireStaff([]);
  const db = getInsforgeAdminClient().database;
  const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: value, error } = await query;
    if (error) throw new Error("Gagal menghitung kualitas data impor.");
    return value ?? 0;
  };
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [pendingBatches, offersWithoutStore, totalPhotos, photosWithoutProof, failedChecks7d] =
    await Promise.all([
      count(db.from("import_batches").select("id", { count: "exact", head: true }).eq("status", "draft")),
      count(db.from("offers").select("id", { count: "exact", head: true }).is("store_id", null)),
      count(db.from("product_assets").select("id", { count: "exact", head: true }).eq("kind", "photo")),
      count(
        db
          .from("product_assets")
          .select("id", { count: "exact", head: true })
          .eq("kind", "photo")
          .eq("usage_basis", "admin-declared")
      ),
      count(
        db
          .from("price_checks")
          .select("id", { count: "exact", head: true })
          .eq("outcome", "failure")
          .gte("attempted_at", weekAgo)
      ),
    ]);

  return { pendingBatches, offersWithoutStore, totalPhotos, photosWithoutProof, failedChecks7d };
}
