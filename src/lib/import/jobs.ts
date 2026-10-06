import "server-only";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/admin/audit";
import type { AdminSession } from "@/lib/auth/dal";
import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectWhereIn } from "@/lib/backend/paged-read";
import { mapWithConcurrency } from "@/lib/import/batch";
import {
  addToProgress,
  emptyProgress,
  finalStatus,
  LEASE_SECONDS,
  mapChunkResults,
  STEP_BUDGET_MS,
  type BatchStatus,
  type ItemOutcome,
  type Progress,
} from "@/lib/import/batch-status";
import {
  createBatch,
  queuePlannedItems,
  readRights,
  recordMissingOfficialPrices,
  resolveFollowUpSlugs,
  type BatchKind,
  type BatchOptions,
  type BatchOrigin,
} from "@/lib/import/batches";
import type { CsvRow } from "@/lib/import/csv-parser";
import { loadOfferContext, runOfferImport, type OfferContext } from "@/lib/import/offer-runner";
import {
  mergeOfferSummaries,
  mergeSpecSummaries,
  type ImportReport,
  type OfferImportReport,
} from "@/lib/import/report";
import { runSpecImport } from "@/lib/import/spec-runner";

/**
 * Worker penerapan batch impor (rencana kerja impor, Fase 1).
 *
 * Satu langkah = klaim lease → proses potongan item pending selama masih ada
 * waktu (`budgetMs`) → tulis hasil per item → lepas lease. Bila tidak ada lagi
 * item pending, batch difinalkan: status akhir, langkah lanjutan (catatan
 * harga resmi yang hilang, batch harga lanjutan), audit, dan revalidasi.
 *
 * Langkah bisa dipicu dari tiga tempat, semuanya memanggil fungsi ini:
 *   1. `after()` setelah admin menekan Terapkan,
 *   2. polling dari halaman batch selama halaman terbuka,
 *   3. route terjadwal /api/admin/import/worker (InsForge Schedules).
 * Klaim lease di database menjamin hanya satu worker per batch pada satu waktu.
 */

/**
 * Item per potongan. Foto tidak lagi diproses di sini (antrean foto terpisah),
 * jadi kedua jenis hanya menulis baris database.
 */
const CHUNK_SIZE: Record<BatchKind, number> = { specs: 25, offers: 40 };

type LoadedBatch = {
  id: string;
  kind: BatchKind;
  origin: BatchOrigin;
  source_label: string;
  options: BatchOptions;
  rows: CsvRow[];
  malformed_lines: number[];
  report: (ImportReport | OfferImportReport) | null;
  progress: Partial<Progress> | null;
  created_by: string | null;
  created_by_email: string | null;
};

export type StepResult = {
  /** false = batch sedang dipegang worker lain atau tidak dalam antrean. */
  claimed: boolean;
  status: BatchStatus | null;
  processed: number;
};

function db() {
  return getInsforgeAdminClient().database;
}

function actorOf(batch: LoadedBatch): AdminSession {
  const by = batch.options.appliedBy;
  return {
    userId: by?.userId ?? batch.created_by ?? "",
    email: by?.email ?? batch.created_by_email ?? "worker",
    role: "admin",
  };
}

function leaseFromNow(): string {
  return new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
}

async function writeOutcomes(outcomes: readonly ItemOutcome[]): Promise<void> {
  const processedAt = new Date().toISOString();
  await mapWithConcurrency(outcomes, 6, async (outcome) => {
    const { error } = await db()
      .from("import_items")
      .update({
        result: outcome.result,
        result_action: outcome.resultAction,
        result_message: outcome.message?.slice(0, 500) ?? null,
        entity_id: outcome.entityId,
        processed_at: processedAt,
      })
      .eq("id", outcome.id)
      .eq("result", "pending");
    if (error) console.error("[impor-worker] hasil item gagal disimpan:", error);
  });
}

/** Menjalankan runner untuk satu potongan item dan memetakan hasilnya ke item. */
async function runChunk(
  batch: LoadedBatch,
  items: { id: string; row_indexes: number[] }[],
  offerContext?: OfferContext
): Promise<{ outcomes: ItemOutcome[]; summary: ImportReport["summary"] | OfferImportReport["summary"] }> {
  const rows: CsvRow[] = [];
  const localIndexByItem = new Map<string, number>();
  for (const item of items) {
    const indexes = (item.row_indexes ?? []).filter((index) => batch.rows[index]);
    if (indexes.length === 0) continue;
    localIndexByItem.set(item.id, rows.length);
    for (const index of indexes) rows.push(batch.rows[index]!);
  }
  // Item tanpa baris mentah yang sah tidak bisa ditulis.
  const orphan: ItemOutcome[] = items
    .filter((item) => !localIndexByItem.has(item.id))
    .map((item) => ({ id: item.id, result: "failed", resultAction: null, message: "Baris mentah item ini tidak ditemukan.", entityId: null }));
  if (rows.length === 0) return { outcomes: orphan, summary: null };

  const admin = actorOf(batch);
  const rights = readRights(batch.options.imageRights);
  try {
    const report =
      batch.kind === "specs"
        ? await runSpecImport({
            rows,
            fileName: batch.source_label,
            defaultImageRights: rights,
            admin,
            malformedLines: batch.malformed_lines,
            quiet: true,
            batchId: batch.id,
            source: batch.origin === "csv" ? "import" : "scrape",
          })
        : await runOfferImport({
            rows,
            fileName: batch.source_label,
            defaultObservedAt: batch.options.defaultObservedAt ?? new Date().toISOString(),
            defaultSellerName: batch.options.defaultSellerName ?? "",
            imageRights: rights,
            admin,
            malformedLines: batch.malformed_lines,
            quiet: true,
            batchId: batch.id,
            context: offerContext,
            source: batch.origin === "csv" ? "import" : "scrape",
          });
    return {
      outcomes: [...orphan, ...mapChunkResults(localIndexByItem, report.rowResults, report.error)],
      summary: report.summary,
    };
  } catch (error) {
    console.error("[impor-worker] potongan gagal:", error);
    return {
      outcomes: [
        ...orphan,
        ...mapChunkResults(localIndexByItem, [], "Gagal diproses karena gangguan sementara. Coba ulang baris ini."),
      ],
      summary: null,
    };
  }
}

function mergeSummary(
  kind: BatchKind,
  current: ImportReport["summary"] | OfferImportReport["summary"],
  next: ImportReport["summary"] | OfferImportReport["summary"]
) {
  if (!next) return current;
  return kind === "specs"
    ? mergeSpecSummaries(current as ImportReport["summary"], next as NonNullable<ImportReport["summary"]>)
    : mergeOfferSummaries(current as OfferImportReport["summary"], next as NonNullable<OfferImportReport["summary"]>);
}

async function finalize(batch: LoadedBatch, progress: Progress, summary: ImportReport["summary"] | OfferImportReport["summary"]) {
  const status = finalStatus(progress);
  const selected = await selectWhereIn("import_items", "id, row_indexes, result, entity_id", "batch_id", [batch.id]);
  const done = selected.filter((item) => item.result === "done");
  const doneRows = done
    .flatMap((item) => (item.row_indexes ?? []) as number[])
    .map((index) => batch.rows[index])
    .filter((row): row is CsvRow => Boolean(row));

  // Langkah lanjutan hanya untuk baris yang benar-benar tersimpan. Batch
  // terjadwal mencatat penawaran yang hilang sendiri (lebih teliti: harga yang
  // tidak bisa dipasangkan dengan yakin tidak dicatat gagal), jadi dilewati.
  if (batch.kind === "offers" && batch.origin === "scrape" && doneRows.length > 0) {
    try {
      await recordMissingOfficialPrices(
        doneRows,
        batch.rows,
        batch.options.defaultObservedAt ?? new Date().toISOString(),
        batch.id
      );
    } catch (error) {
      console.error("[impor-worker] kegagalan harga resmi gagal dicatat:", error);
    }
  }

  let followUpBatchId: string | null = null;
  const followUp = batch.options.followUpOffers;
  if (batch.kind === "specs" && followUp && done.length > 0) {
    const productIds = new Set(done.map((item) => String(item.entity_id ?? "")).filter(Boolean));
    const offerRows = await resolveFollowUpSlugs(followUp.rows, productIds);
    if (offerRows.length > 0) {
      const created = await createBatch({
        kind: "offers",
        origin: "scrape",
        sourceLabel: followUp.sourceLabel,
        options: { defaultObservedAt: followUp.defaultObservedAt, imageRights: null, parentBatchId: batch.id },
        rows: offerRows,
        malformedLines: [],
        admin: actorOf(batch),
      });
      if (created.ok) {
        followUpBatchId = created.id;
        // Harga resmi sudah ditinjau bersama spesifikasinya di batch ini, jadi
        // langsung diantrekan; baris yang tidak cocok (mis. varian tak tercatat)
        // tetap dilewati dengan alasan di batch harga.
        const queued = await queuePlannedItems(created.id, created.plan, actorOf(batch));
        if (!queued.ok) console.error("[impor-worker] batch harga resmi gagal diantrekan:", queued.error);
      }
    }
  }

  const { error } = await db()
    .from("import_batches")
    .update({
      status,
      progress,
      applied_at: new Date().toISOString(),
      lease_until: null,
      report: {
        error: status === "failed" ? "Semua baris terpilih gagal diterapkan. Lihat alasan per baris di bawah." : null,
        summary,
        ...(followUpBatchId ? { followUpBatchId } : {}),
      },
    })
    .eq("id", batch.id)
    .eq("status", "applying");
  if (error) console.error("[impor-worker] status akhir gagal disimpan:", error);

  invalidateCatalogCache();
  for (const path of ["/admin", "/admin/products", "/admin/import", `/admin/import/batch/${batch.id}`, "/products", "/"]) {
    revalidatePath(path);
  }
  await recordAudit(actorOf(batch), "impor.terapkan", "import_batch", batch.id, { status, ...progress });
  return status;
}

export async function processBatchStep(batchId: string, budgetMs = STEP_BUDGET_MS): Promise<StepResult> {
  const started = Date.now();
  const claim = await db().rpc("import_claim_batch", { p_batch: batchId, p_lease_seconds: LEASE_SECONDS });
  if (claim.error) {
    console.error("[impor-worker] klaim gagal:", claim.error);
    return { claimed: false, status: null, processed: 0 };
  }
  if (((claim.data ?? []) as unknown[]).length === 0) return { claimed: false, status: null, processed: 0 };

  const { data, error } = await db()
    .from("import_batches")
    .select("id, kind, origin, source_label, options, rows, malformed_lines, report, progress, created_by, created_by_email")
    .eq("id", batchId)
    .limit(1);
  const batch = (data ?? [])[0] as LoadedBatch | undefined;
  if (error || !batch) {
    await db().from("import_batches").update({ lease_until: null }).eq("id", batchId);
    return { claimed: true, status: "applying", processed: 0 };
  }

  let progress: Progress = { ...emptyProgress(0), ...(batch.progress ?? {}) } as Progress;
  let summary = batch.report?.summary ?? null;
  let processed = 0;
  // Katalog pencocokan penawaran dibaca sekali per langkah. Produk dan varian
  // tidak berubah oleh batch penawaran, jadi aman dipakai ulang antar potongan.
  const offerContext = batch.kind === "offers" ? ((await loadOfferContext()) ?? undefined) : undefined;

  // Minimal satu potongan per langkah walau anggaran waktunya sudah habis
  // (mis. klaim lambat), supaya setiap langkah yang mengklaim selalu maju.
  for (let first = true; first || Date.now() - started < budgetMs; first = false) {
    const pending = await db()
      .from("import_items")
      .select("id, row_indexes")
      .eq("batch_id", batchId)
      .eq("selected", true)
      .eq("result", "pending")
      .order("position", { ascending: true })
      .limit(CHUNK_SIZE[batch.kind]);
    if (pending.error) {
      console.error("[impor-worker] item pending gagal dibaca:", pending.error);
      break;
    }
    const items = (pending.data ?? []) as { id: string; row_indexes: number[] }[];
    if (items.length === 0) {
      const status = await finalize(batch, progress, summary);
      return { claimed: true, status, processed };
    }

    const chunkResult = await runChunk(batch, items, offerContext);
    await writeOutcomes(chunkResult.outcomes);
    progress = addToProgress(progress, chunkResult.outcomes);
    summary = mergeSummary(batch.kind, summary, chunkResult.summary);
    processed += chunkResult.outcomes.length;

    // Potongan tidak penuh = tidak ada lagi item pending: langsung finalkan.
    if (items.length < CHUNK_SIZE[batch.kind]) {
      const status = await finalize(batch, progress, summary);
      return { claimed: true, status, processed };
    }

    // Simpan progres dan perpanjang lease setelah setiap potongan.
    await db()
      .from("import_batches")
      .update({ progress, report: { error: null, summary }, lease_until: leaseFromNow() })
      .eq("id", batchId);
  }

  await db().from("import_batches").update({ lease_until: null }).eq("id", batchId).eq("status", "applying");
  return { claimed: true, status: "applying", processed };
}

/** Batch yang antre atau lease-nya kedaluwarsa, untuk worker terjadwal. */
export async function listWorkableBatches(limit = 5): Promise<string[]> {
  const { data, error } = await db().rpc("import_pending_batches", { p_limit: limit });
  if (error) {
    console.error("[impor-worker] daftar batch antre gagal dibaca:", error);
    return [];
  }
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}
