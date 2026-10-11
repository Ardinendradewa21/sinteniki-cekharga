"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { requireStaff } from "@/lib/auth/dal";
import {
  stageUpload,
  discardBatch,
  followUpRowsOf,
  getBatch,
  getBatchSummary,
  resolveRowsForExistingProducts,
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
import { detectFileKind } from "@/lib/import/canonical";

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

/**
 * Mode "harga saja" untuk batch spesifikasi yang membawa penawaran: hanya
 * penawaran milik produk yang sudah ada di katalog yang dijadikan batch
 * penawaran baru (dianalisis di worker, lalu ditinjau seperti biasa).
 * Spesifikasi di batch ini tidak diterapkan, jadi batch ini dibatalkan.
 */
export async function applyPricesOnlyAction(batchId: string): Promise<PreviewState> {
  const admin = await requireStaff([]);
  const batch = await getBatch(batchId);
  if (!batch || batch.status !== "draft" || batch.kind !== "specs" || !batch.options.followUpOffers) {
    return { error: "Batch ini tidak membawa penawaran yang bisa diterapkan terpisah." };
  }
  const { rows, dropped } = await resolveRowsForExistingProducts(await followUpRowsOf(batch.id, batch.options));
  if (rows.length === 0) {
    return { error: "Semua penawaran di berkas ini milik produk yang belum ada di katalog. Terapkan spesifikasinya dulu." };
  }
  const staged = await stageUpload({
    kind: "offers",
    origin: batch.origin,
    sourceLabel: `${batch.sourceLabel} (harga saja)`,
    role: "row",
    rows,
    malformedLines: [],
    admin,
    options: {
      sourceFormat: batch.options.sourceFormat,
      imageRights: null,
      defaultObservedAt: batch.options.followUpOffers.defaultObservedAt,
      parentBatchId: batch.id,
      ...(dropped > 0 ? { droppedNewProductOffers: dropped } : {}),
    },
  });
  if (!staged.ok) return { error: staged.error };
  await discardBatch(batch.id, admin);

  after(() => kick(staged.id));
  revalidatePath("/admin/import");
  redirect(`/admin/import/batch/${staged.id}`);
}

/**
 * Unggah berkas: request ini HANYA membaca dan menyimpan baris berkas, lalu
 * mengarahkan admin ke halaman batch berstatus "Sedang dianalisis". Koreksi
 * templat terpadu, pencocokan, dan diff berjalan di worker (`analyzeBatch`),
 * dipicu `after()` (tetap berjalan walau action memanggil redirect, sampai
 * maxDuration halaman), polling halaman batch, atau worker terjadwal.
 *
 * Jenis batch mengikuti ISI berkas, bukan formulir yang dipakai: berkas
 * penawaran yang terunggah lewat formulir spesifikasi (atau sebaliknya) tetap
 * diproses dengan benar, dan admin diberi tahu di halaman batch.
 */
async function preview(submittedAs: "specs" | "offers", formData: FormData): Promise<PreviewState> {
  const admin = await requireStaff([]);
  const read = await readCsvFile(formData);
  if (!read.ok) return { error: read.error };

  const rights = readImageRights(formData.get("image_usage_basis"), formData.get("image_usage_rights"));
  if (!rights.ok) return { error: rights.error };

  // Hanya header dan 20 baris pertama yang dibaca di sini.
  const detected = detectFileKind(read.parsed.headers, read.parsed.rows);
  if (detected.kind === null) return { error: detected.reason };
  const unified = detected.kind === "unified";
  // Templat terpadu baru tahu jenis batchnya setelah dianalisis; sementara spesifikasi.
  const kind = unified ? "specs" : detected.kind;

  const staged = await stageUpload({
    kind,
    origin: "csv",
    sourceLabel: read.file.name,
    role: unified ? "upload" : "row",
    rows: read.parsed.rows,
    malformedLines: read.parsed.malformed.map((m) => m.line),
    admin,
    options: {
      sourceFormat: detected.format,
      ...(!unified && kind !== submittedAs ? { submittedAs } : {}),
      imageRights: rights.rights,
      defaultObservedAt: defaultObservedAtFrom(formData, new Date()),
      defaultSellerName: String(formData.get("seller_name") ?? "").trim().slice(0, 160),
    },
  });
  if (!staged.ok) return { error: staged.error };

  after(() => kick(staged.id));
  revalidatePath("/admin/import");
  redirect(`/admin/import/batch/${staged.id}`);
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
  // Mode "spesifikasi saja": batch harga lanjutan tidak dibuat setelah produk diterapkan.
  const skipFollowUp = formData.get("mode") === "specs-only";

  const result = await queueBatch(batchId, itemIds, admin, { skipFollowUp });
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
