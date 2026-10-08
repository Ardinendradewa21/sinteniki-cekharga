import type { RowResult } from "@/lib/import/report";

/**
 * Aturan status batch impor yang murni (tanpa I/O), dipakai server, worker,
 * UI, dan unit test.
 *
 *   draft    -> queued     (admin menekan Terapkan; item terpilih ditandai pending)
 *   queued   -> applying   (worker mengklaim lease)
 *   applying -> applied | partial | failed   (semua item terpilih selesai)
 *   partial/failed -> queued   (coba ulang baris yang gagal)
 *   draft    -> discarded  (dibatalkan admin, atau kedaluwarsa)
 *   applied/partial -> reverted (undo terbatas, lihat undo.ts)
 *
 * Worker memegang lease berumur pendek. Lease yang kedaluwarsa berarti worker
 * mati di tengah jalan (mis. batas waktu fungsi serverless); worker berikutnya
 * melanjutkan item yang masih pending. Penulisan impor bersifat upsert dengan
 * kunci stabil, jadi mengulang satu potongan tidak membuat data ganda.
 */

export type BatchStatus =
  | "draft"
  | "queued"
  | "applying"
  | "applied"
  | "partial"
  | "failed"
  | "discarded"
  | "reverted";

export type ItemResult = "pending" | "done" | "failed" | "skipped";

/** Draft yang tidak ditinjau selama ini dianggap basi dan dibatalkan otomatis. */
export const DRAFT_TTL_DAYS = 14;
/** Batas kerja satu langkah worker; aman di bawah maxDuration 60 detik. */
export const STEP_BUDGET_MS = 40_000;
/** Lease = batas langkah + cadangan, supaya langkah yang masih jalan tidak direbut. */
export const LEASE_SECONDS = Math.ceil(STEP_BUDGET_MS / 1000) + 30;

const DAY_MS = 86_400_000;

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  draft: "Menunggu ditinjau",
  queued: "Antre diterapkan",
  applying: "Sedang diterapkan",
  applied: "Diterapkan",
  partial: "Sebagian gagal",
  failed: "Gagal diterapkan",
  discarded: "Dibatalkan",
  reverted: "Diurungkan",
};

export const BATCH_STATUS_TONE: Record<BatchStatus, string> = {
  draft: "bg-brand-muted text-brand",
  queued: "bg-warning-muted text-warning",
  applying: "bg-warning-muted text-warning",
  applied: "bg-success-muted text-success",
  partial: "bg-warning-muted text-warning",
  failed: "bg-destructive/10 text-destructive",
  discarded: "bg-muted text-foreground",
  reverted: "bg-muted text-foreground",
};

export function batchAgeDays(createdAt: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY_MS);
}

export function isExpiredDraft(batch: { status: BatchStatus; createdAt: string }, now: Date): boolean {
  return batch.status === "draft" && batchAgeDays(batch.createdAt, now) >= DRAFT_TTL_DAYS;
}

/**
 * Label status untuk tampilan. Draft yang sudah melewati umur maksimum
 * ditampilkan "Kedaluwarsa" walau job harian belum menandainya, sehingga
 * halaman tidak perlu menulis ke database saat dibuka (GET tetap hanya baca).
 */
export function batchStatusView(
  batch: { status: BatchStatus; createdAt: string },
  now: Date
): { label: string; tone: string; expired: boolean } {
  if (isExpiredDraft(batch, now)) {
    return { label: "Kedaluwarsa", tone: BATCH_STATUS_TONE.discarded, expired: true };
  }
  return { label: BATCH_STATUS_LABEL[batch.status], tone: BATCH_STATUS_TONE[batch.status], expired: false };
}

/** Batch yang sedang/menunggu dikerjakan worker. */
export function isWorking(status: BatchStatus): boolean {
  return status === "queued" || status === "applying";
}

/** Penerapan yang lease-nya habis: worker sebelumnya berhenti di tengah jalan. */
export function isStaleApplying(batch: { status: BatchStatus; leaseUntil: string | null }, now: Date): boolean {
  return (
    batch.status === "applying" &&
    (batch.leaseUntil === null || new Date(batch.leaseUntil).getTime() < now.getTime())
  );
}

/** Pilihan baris hanya bisa diubah sebelum penerapan dimulai. */
export function isEditable(status: BatchStatus): boolean {
  return status === "draft";
}

/** Baris yang gagal bisa dicoba ulang setelah penerapan selesai. */
export function isRetryable(status: BatchStatus): boolean {
  return status === "partial" || status === "failed";
}

export type Progress = { total: number; done: number; failed: number; skipped: number };

export function emptyProgress(total: number): Progress {
  return { total, done: 0, failed: 0, skipped: 0 };
}

/** Status akhir batch dari hitungan hasil item terpilih. */
export function finalStatus(progress: Progress): "applied" | "partial" | "failed" {
  if (progress.failed === 0) return "applied";
  return progress.done > 0 || progress.skipped > 0 ? "partial" : "failed";
}

export type ChunkItem = { id: string; rowIndexes: number[] };

export type ItemOutcome = {
  id: string;
  result: Exclude<ItemResult, "pending">;
  resultAction: "created" | "updated" | "unchanged" | null;
  message: string | null;
  entityId: string | null;
};

/**
 * Memetakan hasil runner (per baris dalam potongan) ke hasil per item batch.
 *
 * `localIndexByItem` = posisi baris UTAMA item di dalam potongan. Baris
 * tambahan item (mis. listing warna lain yang digabung) tidak menentukan
 * hasil item. Item yang barisnya tidak dilaporkan runner dianggap gagal:
 * lebih baik terlihat gagal daripada diam-diam dianggap berhasil.
 */
export function mapChunkResults(
  localIndexByItem: ReadonlyMap<string, number>,
  rowResults: readonly RowResult[],
  chunkError: string | null
): ItemOutcome[] {
  const byRow = new Map(rowResults.map((row) => [row.rowIndex, row]));
  return [...localIndexByItem].map(([id, localIndex]) => {
    if (chunkError) {
      return { id, result: "failed", resultAction: null, message: chunkError, entityId: null };
    }
    const row = byRow.get(localIndex);
    if (!row) {
      return { id, result: "failed", resultAction: null, message: "Baris tidak diproses.", entityId: null };
    }
    if (row.outcome === "failed" || row.outcome === "skipped") {
      return { id, result: row.outcome, resultAction: null, message: row.message, entityId: row.entityId };
    }
    return { id, result: "done", resultAction: row.outcome, message: row.message, entityId: row.entityId };
  });
}

export function addToProgress(progress: Progress, outcomes: readonly ItemOutcome[]): Progress {
  const next = { ...progress };
  for (const outcome of outcomes) {
    if (outcome.result === "done") next.done += 1;
    else if (outcome.result === "failed") next.failed += 1;
    else next.skipped += 1;
  }
  return next;
}
