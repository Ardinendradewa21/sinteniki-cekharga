"use server";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { recordAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/auth/dal";
import { isImageUsageBasis } from "@/lib/import/image-rights";
import { enqueuePhotoJobs, photoJobCounts, processPhotoStep, retryFailedPhotoJobs } from "@/lib/import/photo-jobs";
import { listOutdatedPhotos } from "@/lib/import/product-images";
import type { PhotoReprocessReport } from "@/lib/import/report";

/** Satu klik memproses antrean selama ini; sisanya dilanjutkan klik berikutnya atau worker terjadwal. */
const STEP_BUDGET_MS = 20_000;

/**
 * Memproses ulang foto produk yang dibuat pipeline lama (mis. masih berlatar
 * putih) dari URL aslinya. Foto lama diantrekan ke antrean foto yang sama
 * dengan impor, lalu satu langkah worker dijalankan. Foto yang sudah versi
 * terbaru tidak diantrekan, jadi aman diklik berulang sampai sisanya nol.
 */
export async function reprocessPhotosAction(): Promise<PhotoReprocessReport> {
  const admin = await requireStaff([]);
  const listed = await listOutdatedPhotos();
  if ("error" in listed) return { error: listed.error, summary: null };

  const queued = await enqueuePhotoJobs(
    listed.outdated
      .filter((row) => row.original_url?.startsWith("https://"))
      .map((row) => ({
        productId: row.product_id,
        kind: "reprocess" as const,
        imageUrl: row.original_url!,
        source: row.source,
        sourceUrl: row.source_url,
        alt: row.alt,
        rights: {
          basis: isImageUsageBasis(row.usage_basis) ? row.usage_basis : "admin-declared",
          text: row.usage_rights,
        },
        assetId: row.id,
      }))
  );
  const step = await processPhotoStep(STEP_BUDGET_MS);
  const counts = await photoJobCounts({ kind: "reprocess" });

  const { data } = await getInsforgeAdminClient()
    .database.from("photo_jobs")
    .select("alt, last_error")
    .eq("kind", "reprocess")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(20);
  const failed = ((data ?? []) as { alt: string; last_error: string | null }[]).map((row) => ({
    label: row.alt,
    reason: row.last_error ?? "Gagal diproses.",
  }));

  await recordAudit(admin, "foto.proses-ulang", "dataset", null, {
    diantrekan: queued.queued,
    diproses: step.processed,
    sisa: counts.pending + counts.running,
    gagal: counts.failed,
  });

  return {
    error: null,
    summary: {
      processed: step.processed,
      failed,
      remaining: counts.pending + counts.running,
      withoutOrigin: listed.withoutOrigin,
    },
  };
}

/** Mengantrekan ulang foto yang gagal (semua produk, atau satu produk). */
export async function retryFailedPhotosAction(productId?: string): Promise<{ retried: number }> {
  await requireStaff([]);
  const retried = await retryFailedPhotoJobs(productId);
  if (retried > 0) await processPhotoStep(STEP_BUDGET_MS);
  return { retried };
}
