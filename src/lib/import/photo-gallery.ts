import "server-only";

import { selectWhereIn } from "@/lib/backend/paged-read";
import type { CsvRow } from "@/lib/import/csv-parser";
import { imageSourceName } from "@/lib/import/image-hosts";
import type { ImageRights } from "@/lib/import/image-rights";
import { loadOfferContext } from "@/lib/import/offer-runner";
import { resolveNamedProduct, type OfferCatalogProduct } from "@/lib/import/offers";
import { planGalleryRows, readGalleryRow, type GalleryPlanItem } from "@/lib/import/photo-gallery-rows";
import { enqueuePhotoJobs } from "@/lib/import/photo-jobs";
import type { StoredPhoto } from "@/lib/import/photo-rules";
import type { ImportPlan, PlanItem } from "@/lib/import/plan";
import type { PhotoGalleryReport, RowResult } from "@/lib/import/report";

/**
 * Impor galeri foto (2026-10-12). Pratinjau dan penerapan memakai rencana
 * yang sama (`planGalleryRows`), dihitung ulang terhadap data terkini saat
 * diterapkan. Penerapan hanya MENGANTREKAN foto: worker foto mengunduh,
 * mengoptimasi, dan menyimpannya, dan batas per warna diperiksa lagi di sana.
 */

type GalleryContext = {
  products: OfferCatalogProduct[];
  existing: Map<string, StoredPhoto[]>;
};

/** Katalog untuk pencocokan + foto tersimpan dan foto yang masih antre untuk produk di berkas. */
async function loadGalleryContext(rows: readonly CsvRow[]): Promise<GalleryContext | null> {
  const context = await loadOfferContext();
  if (!context) return null;
  const products = context.catalogProducts;
  const ids = new Set<string>();
  for (const raw of rows) {
    const read = readGalleryRow(raw);
    if (!read.ok) continue;
    const named = resolveNamedProduct(read.row.name, products);
    if (named && !("error" in named)) ids.add(named.product.id);
  }
  const productIds = [...ids];
  const [assets, jobs] = await Promise.all([
    selectWhereIn("product_assets", "id, product_id, original_url, color, is_cover, kind", "product_id", productIds),
    selectWhereIn("photo_jobs", "id, product_id, image_url, color, is_cover, status, kind", "product_id", productIds),
  ]);
  const existing = new Map<string, StoredPhoto[]>();
  const add = (productId: string, photo: StoredPhoto) => existing.set(productId, [...(existing.get(productId) ?? []), photo]);
  for (const row of assets) {
    if (row.kind !== "photo") continue;
    add(String(row.product_id), {
      id: String(row.id),
      original_url: (row.original_url as string | null) ?? null,
      color: (row.color as string | null) ?? null,
      is_cover: Boolean(row.is_cover),
    });
  }
  // Foto yang masih antre dihitung, supaya dua unggahan berturut-turut tidak
  // melewati batas per warna sebelum worker sempat memprosesnya.
  for (const row of jobs) {
    if (row.kind === "reprocess" || (row.status !== "pending" && row.status !== "running")) continue;
    add(String(row.product_id), {
      id: `antre-${String(row.id)}`,
      original_url: String(row.image_url),
      color: (row.color as string | null) ?? null,
      is_cover: Boolean(row.is_cover),
    });
  }
  return { products, existing };
}

function toPlanItem(item: GalleryPlanItem): PlanItem {
  const photo = item.photo;
  return {
    entity: "photo",
    action: item.action,
    label: item.label,
    reason: item.reason,
    rowIndexes: [item.rowIndex],
    view: {
      product: item.product?.name ?? item.label,
      // Dipakai pengurutan kartu pratinjau: per warna, lalu urutan foto.
      variant: photo ? `${photo.color} · foto ${photo.sortOrder}` : null,
      color: photo?.color ?? null,
      url: photo?.url ?? null,
      cover: photo?.isCover ? true : null,
      source: photo?.sourceUrl ?? null,
      productReview: item.colorReview ? true : null,
    },
    changes: item.action === "update" ? [{ field: "Warna foto", before: null, after: photo?.color ?? null }] : [],
  };
}

export async function planPhotoImport(rows: readonly CsvRow[], imageRights: ImageRights | null): Promise<ImportPlan> {
  const context = await loadGalleryContext(rows);
  if (!context) throw new Error("Katalog produk gagal dibaca untuk pencocokan galeri.");
  const items = planGalleryRows(rows, { products: context.products, existing: context.existing, defaultRights: imageRights }).map(toPlanItem);
  const counts: ImportPlan["counts"] = { create: 0, update: 0, unchanged: 0, skip: 0 };
  for (const item of items) counts[item.action] += 1;
  return { items, counts };
}

/** Menerapkan satu potongan galeri: rencana dihitung ulang, foto Baru/Berubah diantrekan. */
export async function runPhotoGalleryImport({
  rows,
  fileName,
  imageRights,
  batchId,
}: {
  rows: readonly CsvRow[];
  fileName: string;
  imageRights: ImageRights | null;
  batchId: string;
}): Promise<PhotoGalleryReport & { rowResults: RowResult[] }> {
  const context = await loadGalleryContext(rows);
  if (!context) return { error: "Katalog produk gagal dibaca untuk pencocokan galeri.", summary: null, rowResults: [] };
  const plan = planGalleryRows(rows, { products: context.products, existing: context.existing, defaultRights: imageRights });

  const toQueue = plan.filter((item) => (item.action === "create" || item.action === "update") && item.product && item.photo);
  const queued = await enqueuePhotoJobs(
    toQueue.map((item) => ({
      productId: item.product!.id,
      kind: "gallery" as const,
      imageUrl: item.photo!.url,
      source: imageSourceName(new URL(item.photo!.url)),
      sourceUrl: item.photo!.sourceUrl,
      alt: `Foto ${item.product!.name} ${item.photo!.color}`,
      rights: item.photo!.rights,
      color: item.photo!.color,
      sortOrder: item.photo!.sortOrder,
      isCover: item.photo!.isCover,
      batchId,
    }))
  );
  const queueFailed = queued.failed > 0;

  const rowResults: RowResult[] = plan.map((item) => {
    if (item.action === "skip") return { rowIndex: item.rowIndex, outcome: "skipped", entityId: null, message: item.reason };
    if (item.action === "unchanged") return { rowIndex: item.rowIndex, outcome: "unchanged", entityId: item.product?.id ?? null, message: null };
    if (queueFailed) return { rowIndex: item.rowIndex, outcome: "failed", entityId: null, message: "Foto gagal masuk antrean foto; coba ulang." };
    return {
      rowIndex: item.rowIndex,
      outcome: item.action === "create" ? "created" : "updated",
      entityId: item.product?.id ?? null,
      message: null,
    };
  });

  return {
    error: null,
    summary: {
      fileName,
      totalRows: rows.length,
      queued: queueFailed ? 0 : toQueue.length,
      unchanged: plan.filter((item) => item.action === "unchanged").length,
      skipped: plan.filter((item) => item.action === "skip").map((item) => ({ label: item.label, reason: item.reason ?? "" })),
    },
    rowResults,
  };
}

