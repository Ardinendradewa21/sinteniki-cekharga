import "server-only";

import { revalidatePath } from "next/cache";

import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { chunk, INSERT_CHUNK, mapWithConcurrency } from "@/lib/import/batch";
import { isImageUsageBasis, type ImageRights } from "@/lib/import/image-rights";
import {
  importGalleryImage,
  importProductImage,
  reprocessAssetPhoto,
  type ProductImageImportResult,
} from "@/lib/import/product-images";
import { groupPhotoJobs, photoJobNextState, type PhotoJobKind } from "@/lib/import/photo-job-rules";

/**
 * Antrean foto produk (rencana kerja impor, Fase 2).
 *
 * Runner impor dan tombol "proses ulang foto lama" hanya MENGANTREKAN foto.
 * Worker foto memproses antrean per langkah dengan batas waktu: klaim beberapa
 * job (FOR UPDATE SKIP LOCKED di database), proses per produk secara berurutan
 * (foto utama dulu, lalu galeri), dan antar-produk paralel terbatas.
 *
 * Penggeraknya sama dengan penerapan batch: halaman batch / Pusat Impor
 * selama terbuka, dan worker terjadwal /api/admin/import/worker.
 */

export type PhotoJobInput = {
  productId: string;
  kind: PhotoJobKind;
  imageUrl: string;
  source: string;
  sourceUrl: string | null;
  alt: string;
  rights: ImageRights;
  assetId?: string | null;
  batchId?: string | null;
};

type PhotoJobRow = {
  id: string;
  product_id: string;
  kind: PhotoJobKind;
  image_url: string;
  source: string;
  source_url: string | null;
  alt: string;
  rights: { basis?: unknown; text?: unknown };
  asset_id: string | null;
  batch_id: string | null;
  attempts: number;
};

export type PhotoJobCounts = { pending: number; running: number; done: number; failed: number; skipped: number };

const PHOTO_LEASE_SECONDS = 90;
const PHOTO_CLAIM_LIMIT = 8;
const PHOTO_PRODUCT_CONCURRENCY = 4;

function db() {
  return getInsforgeAdminClient().database;
}

/**
 * Mengantrekan foto. Foto yang sama (produk + jenis + URL) yang sudah pernah
 * diantrekan dikembalikan ke pending, jadi impor ulang memproses ulang
 * fotonya; job yang ternyata sudah terbaru selesai sebagai "unchanged".
 */
export async function enqueuePhotoJobs(jobs: readonly PhotoJobInput[]): Promise<{ queued: number; failed: number }> {
  if (jobs.length === 0) return { queued: 0, failed: 0 };
  const unique = [...new Map(jobs.map((job) => [`${job.productId}|${job.kind}|${job.imageUrl}`, job])).values()];
  let queued = 0;
  let failed = 0;
  for (const group of chunk(unique, INSERT_CHUNK)) {
    const { error } = await db()
      .from("photo_jobs")
      .upsert(
        group.map((job) => ({
          product_id: job.productId,
          kind: job.kind,
          image_url: job.imageUrl,
          source: job.source,
          source_url: job.sourceUrl,
          alt: job.alt.slice(0, 300),
          rights: job.rights,
          asset_id: job.assetId ?? null,
          batch_id: job.batchId ?? null,
          status: "pending",
          outcome: null,
          attempts: 0,
          last_error: null,
          lease_until: null,
        })),
        { onConflict: "product_id,kind,image_url" }
      );
    if (error) {
      console.error("[foto] antrean gagal disimpan:", error);
      failed += group.length;
    } else {
      queued += group.length;
    }
  }
  return { queued, failed };
}

function rightsOf(row: PhotoJobRow): ImageRights | null {
  const { basis, text } = row.rights ?? {};
  return isImageUsageBasis(basis) && typeof text === "string" && text ? { basis, text } : null;
}

async function runJob(row: PhotoJobRow, retrievedAt: string): Promise<ProductImageImportResult> {
  try {
    if (row.kind === "reprocess") {
      return row.asset_id
        ? await reprocessAssetPhoto(row.asset_id, retrievedAt)
        : { ok: false, reason: "Job proses ulang tanpa foto acuan." };
    }
    const rights = rightsOf(row);
    if (!rights) return { ok: false, reason: "Dasar hak pakai foto tidak tercatat." };
    const candidate = { imageUrl: row.image_url, source: row.source, sourceUrl: row.source_url ?? row.image_url, alt: row.alt, rights };
    return row.kind === "primary"
      ? await importProductImage({ productId: row.product_id, candidate, defaultRights: rights, retrievedAt, batchId: row.batch_id })
      : await importGalleryImage({ productId: row.product_id, candidate, retrievedAt, batchId: row.batch_id });
  } catch (error) {
    console.error("[foto] job gagal:", error);
    return { ok: false, reason: "Gangguan sementara saat memproses foto." };
  }
}

/** Satu langkah worker foto. Mengembalikan jumlah job yang diselesaikan. */
export async function processPhotoStep(budgetMs: number): Promise<{ processed: number; changed: number }> {
  const started = Date.now();
  let processed = 0;
  let changed = 0;
  await db().rpc("photo_fail_exhausted");

  for (let first = true; first || Date.now() - started < budgetMs; first = false) {
    const claim = await db().rpc("photo_claim_jobs", { p_limit: PHOTO_CLAIM_LIMIT, p_lease_seconds: PHOTO_LEASE_SECONDS });
    if (claim.error) {
      console.error("[foto] klaim gagal:", claim.error);
      break;
    }
    const rows = (claim.data ?? []) as PhotoJobRow[];
    if (rows.length === 0) break;

    const retrievedAt = new Date().toISOString();
    // Per produk berurutan (foto utama dulu): galeri menghitung jumlah foto
    // dari isi tabel, dan foto utama mengganti foto tertua produk.
    await mapWithConcurrency(groupPhotoJobs(rows), PHOTO_PRODUCT_CONCURRENCY, async (jobs) => {
      for (const job of jobs) {
        const result = await runJob(job, retrievedAt);
        const next = photoJobNextState(result, job.attempts);
        const { error } = await db()
          .from("photo_jobs")
          .update({ ...next, lease_until: null })
          .eq("id", job.id)
          .eq("status", "running");
        if (error) console.error("[foto] status job gagal disimpan:", error);
        if (next.status !== "pending") processed += 1;
        if (next.status === "done" && next.outcome !== "unchanged") changed += 1;
      }
    });
    if (rows.length < PHOTO_CLAIM_LIMIT) break;
  }

  if (changed > 0) {
    invalidateCatalogCache();
    revalidatePath("/products");
    revalidatePath("/");
    revalidatePath("/admin/products");
  }
  return { processed, changed };
}

export async function photoJobCounts(filter: { batchId?: string; kind?: PhotoJobKind } = {}): Promise<PhotoJobCounts> {
  const counts: PhotoJobCounts = { pending: 0, running: 0, done: 0, failed: 0, skipped: 0 };
  await Promise.all(
    (Object.keys(counts) as (keyof PhotoJobCounts)[]).map(async (status) => {
      let query = db().from("photo_jobs").select("id", { count: "exact", head: true }).eq("status", status);
      if (filter.batchId) query = query.eq("batch_id", filter.batchId);
      if (filter.kind) query = query.eq("kind", filter.kind);
      const { count } = await query;
      counts[status] = count ?? 0;
    })
  );
  return counts;
}

export type ProductPhotoJob = {
  id: string;
  kind: PhotoJobKind;
  status: keyof PhotoJobCounts;
  imageUrl: string;
  lastError: string | null;
  attempts: number;
  updatedAt: string;
};

/** Antrean foto satu produk yang masih berjalan atau gagal, untuk halaman sunting produk. */
export async function productPhotoJobs(productId: string): Promise<ProductPhotoJob[]> {
  const { data, error } = await db()
    .from("photo_jobs")
    .select("id, kind, status, image_url, last_error, attempts, updated_at")
    .eq("product_id", productId)
    .in("status", ["pending", "running", "failed"])
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    kind: row.kind as PhotoJobKind,
    status: row.status as keyof PhotoJobCounts,
    imageUrl: String(row.image_url),
    lastError: row.last_error ? String(row.last_error) : null,
    attempts: Number(row.attempts ?? 0),
    updatedAt: String(row.updated_at),
  }));
}

/** Mengantrekan ulang job foto yang gagal (semua, atau milik satu produk). */
export async function retryFailedPhotoJobs(productId?: string): Promise<number> {
  let query = db()
    .from("photo_jobs")
    .update({ status: "pending", attempts: 0, last_error: null, lease_until: null })
    .eq("status", "failed");
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query.select("id");
  if (error) {
    console.error("[foto] coba ulang gagal:", error);
    return 0;
  }
  return (data ?? []).length;
}

/** Umur job foto selesai/dilewati sebelum dihapus; job gagal disimpan lebih lama untuk ditelusuri. */
export const PHOTO_JOB_RETENTION_DAYS = { finished: 30, failed: 90 } as const;

/**
 * Retensi antrean foto. Job yang sudah selesai tidak dibutuhkan lagi: fotonya
 * ada di `product_assets`, dan jejak batch-nya disalin ke
 * `product_assets.created_by_batch_id` saat foto dibuat.
 */
export async function purgePhotoJobs(now = new Date()): Promise<number> {
  const before = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  let purged = 0;
  for (const [statuses, days] of [
    [["done", "skipped"], PHOTO_JOB_RETENTION_DAYS.finished],
    [["failed"], PHOTO_JOB_RETENTION_DAYS.failed],
  ] as const) {
    const { data, error } = await db()
      .from("photo_jobs")
      .delete()
      .in("status", [...statuses])
      .lt("updated_at", before(days))
      .select("id");
    if (error) console.error("[foto] retensi antrean gagal:", error);
    else purged += (data ?? []).length;
  }
  return purged;
}

/** Job foto batch yang SEDANG dikerjakan worker (lease masih berlaku). */
export async function activePhotoJobs(batchIds: readonly string[], now = new Date()): Promise<number> {
  if (batchIds.length === 0) return 0;
  const { count, error } = await db()
    .from("photo_jobs")
    .select("id", { count: "exact", head: true })
    .in("batch_id", [...batchIds])
    .eq("status", "running")
    .gt("lease_until", now.toISOString());
  if (error) throw new Error("Antrean foto batch gagal diperiksa.");
  return count ?? 0;
}

/**
 * Membatalkan antrean foto batch yang diurungkan, supaya foto tidak muncul
 * SETELAH undo. Pemanggil memastikan tidak ada job dengan lease aktif
 * (`activePhotoJobs`); job "running" yang lease-nya habis berarti worker-nya
 * berhenti, jadi aman ikut dibatalkan. Dua UPDATE terpisah karena InsForge
 * menolak `or(... and(...))` pada UPDATE.
 */
export async function cancelBatchPhotoJobs(batchIds: readonly string[], now = new Date()): Promise<number> {
  if (batchIds.length === 0) return 0;
  const cancel = { status: "skipped", last_error: "Batch asalnya diurungkan.", lease_until: null };
  const waiting = await db()
    .from("photo_jobs")
    .update(cancel)
    .in("batch_id", [...batchIds])
    .in("status", ["pending", "failed"])
    .select("id");
  const stalled = await db()
    .from("photo_jobs")
    .update(cancel)
    .in("batch_id", [...batchIds])
    .eq("status", "running")
    .lt("lease_until", now.toISOString())
    .select("id");
  if (waiting.error || stalled.error) {
    console.error("[foto] antrean batch gagal dibatalkan:", waiting.error ?? stalled.error);
  }
  return (waiting.data ?? []).length + (stalled.data ?? []).length;
}
