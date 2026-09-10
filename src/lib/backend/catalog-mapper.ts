import "server-only";

import type { CatalogDataset } from "@/lib/catalog/schema";

/**
 * Penerjemah baris database menjadi bentuk domain (PRD §9).
 *
 * Database memakai snake_case dan tipe Postgres; model domain memakai camelCase
 * dan tipe TypeScript. Berkas ini satu-satunya tempat kedua dunia itu bertemu,
 * sehingga kalau nama kolom berubah, hanya file ini yang ikut berubah, bukan
 * seluruh query dan komponen.
 *
 * Dua hal yang gampang salah dan sengaja ditangani di sini:
 *
 * 1. Waktu. Postgres mengembalikan timestamptz dengan offset (mis.
 *    "+00:00"), sedangkan schema Zod memakai `z.iso.datetime()` yang menuntut
 *    format "Z". Semua waktu dinormalkan lewat Date supaya bentuknya seragam.
 *
 * 2. BIGINT. `price_idr` dideklarasikan BIGINT agar aman untuk angka Rupiah
 *    besar, dan driver bisa mengembalikannya sebagai string. Dipaksa ke Number
 *    di sini supaya tidak ada perbandingan harga yang diam-diam membandingkan
 *    string.
 *
 * Hasil terjemahan TIDAK divalidasi di sini. Validasinya satu pintu di adapter
 * lewat catalogDatasetSchema, sama seperti fixture demo.
 */

type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined ? null : str(v);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : num(v);
const bool = (v: unknown): boolean => v === true || v === "true";

/** Menyeragamkan waktu apa pun bentuknya menjadi ISO dengan "Z". */
const isoTime = (v: unknown): string => new Date(str(v)).toISOString();

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((s) => s.length > 0) : [];

export function mapProducts(rows: Row[]): CatalogDataset["products"] {
  return rows.map((r) => ({
    id: str(r.id),
    slug: str(r.slug),
    brand: str(r.brand),
    model: str(r.model),
    // specs disimpan sebagai JSONB; bentuk isinya dijaga Zod di gerbang adapter.
    specs: (r.specs ?? {}) as CatalogDataset["products"][number]["specs"],
    specsProvenance: {
      source: str(r.specs_source),
      url: strOrNull(r.specs_source_url),
      retrievedAt: isoTime(r.specs_retrieved_at),
    },
    status: str(r.status) as "draft" | "published",
  }));
}

export function mapVariants(rows: Row[]): CatalogDataset["variants"] {
  return rows.map((r) => ({
    id: str(r.id),
    productId: str(r.product_id),
    ramGb: num(r.ram_gb),
    storageGb: num(r.storage_gb),
    region: strOrNull(r.region),
  }));
}

export function mapAssets(rows: Row[]): CatalogDataset["assets"] {
  return rows.map((r) => ({
    id: str(r.id),
    productId: str(r.product_id),
    variantId: strOrNull(r.variant_id),
    kind: str(r.kind) as "photo" | "generic-illustration",
    src: str(r.src),
    alt: str(r.alt),
    provenance: {
      source: str(r.source),
      url: strOrNull(r.source_url),
      retrievedAt: isoTime(r.retrieved_at),
    },
    usageRights: str(r.usage_rights),
  }));
}

export function mapReviews(rows: Row[]): CatalogDataset["reviews"] {
  return rows.map((r) => ({
    id: str(r.id),
    productId: str(r.product_id),
    variantId: strOrNull(r.variant_id),
    channelName: str(r.channel_name),
    videoUrl: str(r.video_url),
    publishedAt: isoTime(r.published_at),
    timestampSeconds: numOrNull(r.timestamp_seconds),
    aspect: str(r.aspect),
    summary: str(r.summary),
    strengths: strArray(r.strengths),
    limitations: strArray(r.limitations),
    testContext: strOrNull(r.test_context),
    status: str(r.status) as "draft" | "published",
  }));
}

export function mapOffers(rows: Row[]): CatalogDataset["offers"] {
  return rows.map((r) => ({
    id: str(r.id),
    variantId: str(r.variant_id),
    marketplace: str(r.marketplace),
    sellerName: str(r.seller_name),
    url: str(r.url),
    condition: "new" as const,
    warranty: strOrNull(r.warranty),
    listingStatus: str(r.listing_status) as CatalogDataset["offers"][number]["listingStatus"],
    sellerVerified: bool(r.seller_verified),
  }));
}

export function mapPriceObservations(
  rows: Row[]
): CatalogDataset["priceObservations"] {
  return rows.map((r) => ({
    id: str(r.id),
    offerId: str(r.offer_id),
    priceIdr: num(r.price_idr),
    observedAt: isoTime(r.observed_at),
    origin: str(r.origin) as "manual" | "automatic",
  }));
}

export function mapPriceChecks(rows: Row[]): CatalogDataset["priceChecks"] {
  return rows.map((r) => ({
    id: str(r.id),
    offerId: str(r.offer_id),
    attemptedAt: isoTime(r.attempted_at),
    outcome: str(r.outcome) as "success" | "failure",
    errorSummary: strOrNull(r.error_summary),
  }));
}
