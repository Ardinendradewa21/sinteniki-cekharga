import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { requireAdmin } from "@/lib/auth/dal";

/**
 * Pembacaan data untuk antarmuka admin.
 *
 * Berbeda dari `src/lib/catalog/queries.ts` yang hanya melihat data
 * terpublikasi, modul ini sengaja melihat SEMUANYA termasuk draft. Karena itu
 * setiap fungsi di sini memanggil `requireAdmin()` lebih dulu, bukan
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

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  await requireAdmin();
  const db = getInsforgeAdminClient().database;

  const [products, variants, offers] = await Promise.all([
    db.from("products").select("id, slug, brand, model, status, updated_at").limit(1000),
    db.from("variants").select("id, product_id").limit(2000),
    db.from("offers").select("id, variant_id").limit(2000),
  ]);

  const variantRows = (variants.data ?? []) as { id: string; product_id: string }[];
  const offerRows = (offers.data ?? []) as { id: string; variant_id: string }[];

  const variantsByProduct = new Map<string, string[]>();
  for (const v of variantRows) {
    variantsByProduct.set(v.product_id, [
      ...(variantsByProduct.get(v.product_id) ?? []),
      v.id,
    ]);
  }
  const offerCountByVariant = new Map<string, number>();
  for (const o of offerRows) {
    offerCountByVariant.set(o.variant_id, (offerCountByVariant.get(o.variant_id) ?? 0) + 1);
  }

  type ProductRow = {
    id: string; slug: string; brand: string; model: string;
    status: "draft" | "published"; updated_at: string;
  };

  return ((products.data ?? []) as ProductRow[])
    .map((p) => {
      const ids = variantsByProduct.get(p.id) ?? [];
      return {
        id: p.id,
        slug: p.slug,
        brand: p.brand,
        model: p.model,
        status: p.status,
        updatedAt: p.updated_at,
        variantCount: ids.length,
        offerCount: ids.reduce((sum, id) => sum + (offerCountByVariant.get(id) ?? 0), 0),
      };
    })
    .sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model));
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  await requireAdmin();
  const db = getInsforgeAdminClient().database;

  const productRes = await db.from("products").select().eq("id", id).limit(1);
  const product = (productRes.data ?? [])[0] as Record<string, unknown> | undefined;
  if (!product) return null;

  const variantsRes = await db.from("variants").select().eq("product_id", id).limit(200);
  const variantRows = (variantsRes.data ?? []) as Record<string, unknown>[];
  const variantIds = variantRows.map((v) => String(v.id));

  const offersRes = variantIds.length
    ? await db.from("offers").select().in("variant_id", variantIds).limit(500)
    : { data: [] };
  const offerRows = (offersRes.data ?? []) as Record<string, unknown>[];

  const offerIds = offerRows.map((o) => String(o.id));
  const obsRes = offerIds.length
    ? await db
        .from("price_observations")
        .select("offer_id, price_idr, observed_at")
        .in("offer_id", offerIds)
        .limit(2000)
    : { data: [] };

  const checksRes = offerIds.length
    ? await db
        .from("price_checks")
        .select("offer_id, outcome, attempted_at, error_summary")
        .in("offer_id", offerIds)
        .limit(2000)
    : { data: [] };

  const checksByOffer = new Map<
    string,
    { outcome: string; attemptedAt: string; errorSummary: string | null }[]
  >();
  for (const row of (checksRes.data ?? []) as Record<string, unknown>[]) {
    const offerId = String(row.offer_id);
    const list = checksByOffer.get(offerId) ?? [];
    list.push({
      outcome: String(row.outcome),
      attemptedAt: String(row.attempted_at),
      errorSummary: (row.error_summary as string | null) ?? null,
    });
    checksByOffer.set(offerId, list);
  }
  for (const list of checksByOffer.values()) {
    list.sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime());
  }

  const reviewsRes = await db
    .from("review_summaries")
    .select()
    .eq("product_id", id)
    .limit(200);

  const variantLabelById = new Map(
    variantRows.map((v) => [String(v.id), `${v.ram_gb}/${v.storage_gb} GB`])
  );

  const reviews: AdminReviewRow[] = ((reviewsRes.data ?? []) as Record<string, unknown>[])
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

  // Pengamatan terbaru per penawaran; urutan dari database tidak diandalkan.
  const latestByOffer = new Map<string, { price: number; at: string }>();
  for (const row of (obsRes.data ?? []) as Record<string, unknown>[]) {
    const offerId = String(row.offer_id);
    const at = String(row.observed_at);
    const current = latestByOffer.get(offerId);
    if (!current || new Date(at) > new Date(current.at)) {
      latestByOffer.set(offerId, { price: Number(row.price_idr), at });
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
  await requireAdmin();
  const { data } = await getInsforgeAdminClient()
    .database.from("admin_audit")
    .select("id, actor_email, operation, object_type, object_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    actorEmail: (r.actor_email as string | null) ?? null,
    operation: String(r.operation),
    objectType: String(r.object_type),
    objectId: (r.object_id as string | null) ?? null,
    createdAt: String(r.created_at),
  }));
}
