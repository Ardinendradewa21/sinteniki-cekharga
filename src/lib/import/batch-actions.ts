"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { requireStaff } from "@/lib/auth/dal";
import {
  createBatch,
  discardBatch,
  getBatchSummary,
  getFollowUpBatchId,
  queueBatch,
  retryFailedItems,
  type BatchSummary,
} from "@/lib/import/batches";
import { readImageRights } from "@/lib/import/image-rights";
import { processBatchStep } from "@/lib/import/jobs";
import { executeUndo } from "@/lib/import/undo";
import { photoJobCounts, processPhotoStep, type PhotoJobCounts } from "@/lib/import/photo-jobs";
import { defaultObservedAtFrom, readCsvFile } from "@/lib/import/upload";

/** Langkah dari polling halaman lebih pendek supaya tiap panggilan cepat kembali. */
const POLL_STEP_BUDGET_MS = 20_000;
/** Sisa waktu `after()` setelah langkah batch, dipakai untuk antrean foto. */
const AFTER_PHOTO_BUDGET_MS = 12_000;

/** Langkah batch, lalu langkah foto bila batch sudah tidak sedang dikerjakan. */
async function kick(batchId: string) {
  await processBatchStep(batchId);
  await processPhotoStep(AFTER_PHOTO_BUDGET_MS);
}

/**
 * Aksi Pusat Impor: unggah → pratinjau → antrekan / batalkan.
 *
 * Setiap aksi memanggil requireStaff([]) lebih dulu (hanya peran admin); aksi
 * server adalah endpoint POST yang bisa dipanggil tanpa melewati antarmuka.
 */

export type PreviewState = { error: string | null };

async function preview(kind: "specs" | "offers", formData: FormData): Promise<PreviewState> {
  const admin = await requireStaff([]);
  const read = await readCsvFile(formData);
  if (!read.ok) return { error: read.error };

  const rights = readImageRights(formData.get("image_usage_basis"), formData.get("image_usage_rights"));
  if (!rights.ok) return { error: rights.error };

  const created = await createBatch({
    kind,
    origin: "csv",
    sourceLabel: read.file.name,
    options:
      kind === "specs"
        ? { imageRights: rights.rights }
        : {
            imageRights: rights.rights,
            defaultObservedAt: defaultObservedAtFrom(formData, new Date()),
            defaultSellerName: String(formData.get("seller_name") ?? "").trim().slice(0, 160),
          },
    rows: read.parsed.rows,
    malformedLines: read.parsed.malformed.map((m) => m.line),
    admin,
  });
  if (!created.ok) return { error: created.error };

  revalidatePath("/admin/import");
  redirect(`/admin/import/batch/${created.id}`);
}

export async function previewSpecsAction(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  return preview("specs", formData);
}

export async function previewOffersAction(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  return preview("offers", formData);
}

export async function applyBatchAction(
  batchId: string,
  _prev: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const admin = await requireStaff([]);
  const itemIds = formData.getAll("item").map(String).filter(Boolean);
  if (itemIds.length === 0) return { error: "Pilih minimal satu baris untuk diterapkan." };

  const result = await queueBatch(batchId, itemIds, admin);
  revalidatePath("/admin/import");
  revalidatePath(`/admin/import/batch/${batchId}`);
  if (!result.ok) return { error: result.error };

  // Langkah pertama dimulai segera setelah respons terkirim. Halaman batch
  // melanjutkan sisanya lewat polling, dan worker terjadwal sebagai cadangan.
  after(() => kick(batchId));
  redirect(`/admin/import/batch/${batchId}`);
}

/**
 * Satu langkah worker yang dipicu polling halaman batch. Aman dipanggil
 * berulang dan dari beberapa tab: klaim lease di database hanya memberi
 * satu worker per batch.
 */
export async function continueBatchAction(batchId: string): Promise<{
  batch: BatchSummary | null;
  photos: PhotoJobCounts;
  /** Batch harga resmi lanjutan (tarik otomatis), diterapkan otomatis setelah batch ini. */
  followUp: BatchSummary | null;
}> {
  await requireStaff([]);
  const step = await processBatchStep(batchId, POLL_STEP_BUDGET_MS);
  const parentBusy = step.claimed && (step.status === "applying" || step.status === null);
  if (!parentBusy) {
    // Batch induk selesai: langkah ini dipakai untuk batch harga lanjutan,
    // lalu antrean foto batch ini.
    const followUpId = await getFollowUpBatchId(batchId);
    if (followUpId) await processBatchStep(followUpId, POLL_STEP_BUDGET_MS);
    const pending = await photoJobCounts({ batchId });
    if (pending.pending + pending.running > 0) await processPhotoStep(POLL_STEP_BUDGET_MS);
  }
  const followUpId = await getFollowUpBatchId(batchId);
  const [batch, photos, followUp] = await Promise.all([
    getBatchSummary(batchId),
    photoJobCounts({ batchId }),
    followUpId ? getBatchSummary(followUpId) : Promise.resolve(null),
  ]);
  return { batch, photos, followUp };
}

export async function retryFailedAction(batchId: string): Promise<PreviewState> {
  const admin = await requireStaff([]);
  const result = await retryFailedItems(batchId, admin);
  revalidatePath(`/admin/import/batch/${batchId}`);
  if (!result.ok) return { error: result.error };
  after(() => kick(batchId));
  return { error: null };
}

/** Undo terbatas: menghapus data buatan batch ini yang belum disentuh siapa pun. */
export async function undoBatchAction(batchId: string): Promise<PreviewState & { message?: string }> {
  const admin = await requireStaff([]);
  const outcome = await executeUndo(batchId, admin);
  revalidatePath(`/admin/import/batch/${batchId}`);
  if (!outcome.ok) return { error: outcome.error };
  const r = outcome.result;
  const f = outcome.followUp;
  return {
    error: null,
    message:
      `Diurungkan: ${r.products} produk, ${r.offers + (f?.offers ?? 0)} penawaran, ` +
      `${r.observations + (f?.observations ?? 0)} catatan harga dihapus.`,
  };
}

export async function discardBatchAction(batchId: string): Promise<void> {
  const admin = await requireStaff([]);
  await discardBatch(batchId, admin);
  revalidatePath("/admin/import");
  redirect("/admin/import");
}
