import "server-only";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/admin/audit";
import type { AdminSession } from "@/lib/auth/dal";
import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectWhereIn } from "@/lib/backend/paged-read";
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
  followUpRowsOf,
  planBatchRows,
  queuePlannedItems,
  readRights,
  recordMissingOfficialPrices,
  resolveFollowUpSlugs,
  writePlanItems,
  type BatchKind,
  type BatchOptions,
  type BatchOrigin,
} from "@/lib/import/batches";
import { selectStoredCorrections, summarizeCorrections } from "@/lib/import/corrections";
import { clearRawRows, loadRawRowList, loadRawRows, stageRawRows } from "@/lib/import/raw-rows";
import { convertUnifiedRows } from "@/lib/import/unified";
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
  /** Hanya batch lama; batch baru menyimpan barisnya di raw_listings. */
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

/** Hasil item dalam SATU panggilan RPC (dulu satu update per item, pola N+1). */
async function writeOutcomes(outcomes: readonly ItemOutcome[]): Promise<void> {
  if (outcomes.length === 0) return;
  const { error } = await db().rpc("import_write_outcomes", {
    p_rows: outcomes.map((outcome) => ({
      id: outcome.id,
      result: outcome.result,
      result_action: outcome.resultAction,
      result_message: outcome.message?.slice(0, 500) ?? null,
      entity_id: outcome.entityId,
    })),
  });
  if (error) console.error("[impor-worker] hasil item gagal disimpan:", error);
}

/**
 * Baris kerja batch untuk posisi tertentu. Batch baru membaca hanya baris yang
 * diminta dari raw_listings; batch lama masih membawa seluruh barisnya.
 */
async function batchRows(batch: LoadedBatch, positions?: readonly number[]): Promise<Map<number, CsvRow>> {
  if (batch.rows && batch.rows.length > 0) {
    const all = new Map(batch.rows.map((row, index) => [index, row] as const));
    return positions ? new Map(positions.filter((p) => all.has(p)).map((p) => [p, all.get(p)!] as const)) : all;
  }
  return loadRawRows(batch.id, "row", positions);
}

/** Menjalankan runner untuk satu potongan item dan memetakan hasilnya ke item. */
async function runChunk(
  batch: LoadedBatch,
  items: { id: string; row_indexes: number[] }[],
  offerContext?: OfferContext
): Promise<{ outcomes: ItemOutcome[]; summary: ImportReport["summary"] | OfferImportReport["summary"] }> {
  const rows: CsvRow[] = [];
  const localIndexByItem = new Map<string, number>();
  const available = await batchRows(batch, items.flatMap((item) => item.row_indexes ?? []));
  for (const item of items) {
    const indexes = (item.row_indexes ?? []).filter((index) => available.has(index));
    if (indexes.length === 0) continue;
    localIndexByItem.set(item.id, rows.length);
    for (const index of indexes) rows.push(available.get(index)!);
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
  const donePositions = done.flatMap((item) => (item.row_indexes ?? []) as number[]);
  const doneRows = [...(await batchRows(batch, donePositions)).values()];

  // Langkah lanjutan hanya untuk baris yang benar-benar tersimpan. Batch
  // terjadwal mencatat penawaran yang hilang sendiri (lebih teliti: harga yang
  // tidak bisa dipasangkan dengan yakin tidak dicatat gagal), jadi dilewati.
  if (batch.kind === "offers" && batch.origin === "scrape" && doneRows.length > 0) {
    try {
      await recordMissingOfficialPrices(
        doneRows,
        [...(await batchRows(batch)).values()],
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
    const offerRows = await resolveFollowUpSlugs(await followUpRowsOf(batch.id, batch.options), productIds);
    if (offerRows.length > 0) {
      // Asal batch harga mengikuti induknya. "scrape" memicu pencatatan harga
      // resmi yang hilang, yang tidak berlaku untuk berkas CSV.
      const created = await createBatch({
        kind: "offers",
        origin: batch.origin,
        sourceLabel: followUp.sourceLabel,
        options: { defaultObservedAt: followUp.defaultObservedAt, imageRights: null, parentBatchId: batch.id },
        rows: offerRows,
        malformedLines: [],
        admin: actorOf(batch),
      });
      if (created.ok) {
        followUpBatchId = created.id;
        // Harga resmi tarik otomatis sudah ditinjau bersama spesifikasinya,
        // jadi langsung diantrekan. Harga dari templat terpadu (CSV) tetap
        // draft: pratinjau per penawaran baru bisa dihitung setelah produknya
        // ada, dan admin meninjaunya sebelum disimpan.
        if (batch.origin === "scrape") {
          const queued = await queuePlannedItems(created.id, created.plan, actorOf(batch));
          if (!queued.ok) console.error("[impor-worker] batch harga resmi gagal diantrekan:", queued.error);
        }
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
  // Unggahan yang menunggu dianalisis dikerjakan lebih dulu (klaim atomik
  // terpisah); batch lain langsung lanjut ke klaim penerapan.
  const analysis = await db().rpc("import_claim_analysis", { p_batch: batchId, p_lease_seconds: LEASE_SECONDS });
  if (!analysis.error && ((analysis.data ?? []) as unknown[]).length > 0) return analyzeBatch(batchId);

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

class AnalysisError extends Error {}

/**
 * Analisis unggahan di worker (aturan system design 3): koreksi templat
 * terpadu, pencocokan dengan katalog, dan diff per kolom. Hasilnya item
 * pratinjau dan status draft. Langkah ini aman diulang: baris kerja dan item
 * ditulis ulang dari baris unggahan setiap kali.
 */
async function analyzeBatch(batchId: string): Promise<StepResult> {
  const { data } = await db()
    .from("import_batches")
    .select("id, kind, origin, source_label, options, rows, malformed_lines, report, progress, created_by, created_by_email")
    .eq("id", batchId)
    .limit(1);
  const batch = (data ?? [])[0] as LoadedBatch | undefined;
  if (!batch) return { claimed: true, status: null, processed: 0 };

  try {
    let kind: BatchKind = batch.kind;
    let options: BatchOptions = batch.options;
    let rows: CsvRow[];

    if (options.sourceFormat === "unified") {
      const converted = convertUnifiedRows(await loadRawRowList(batchId, "upload"));
      const offerRows = [...converted.followUpOfferRows, ...converted.offerRows];
      const corrections = {
        items: selectStoredCorrections(converted.corrections),
        summary: summarizeCorrections(converted.corrections),
      };
      if (converted.specRows.length === 0 && offerRows.length === 0) {
        throw new AnalysisError("Tidak ada baris yang bisa dipakai. Periksa kolom merek, model, varian, dan offer_url.");
      }
      // Berkas berisi produk -> batch spesifikasi; penawarannya menjadi batch
      // harga lanjutan setelah produk diterapkan. Hanya penawaran -> batch penawaran.
      if (converted.specRows.length > 0) {
        kind = "specs";
        rows = converted.specRows;
        options = {
          ...options,
          corrections,
          followUpOffers:
            offerRows.length > 0
              ? {
                  sourceLabel: `${batch.source_label} (harga)`,
                  defaultObservedAt: options.defaultObservedAt ?? new Date().toISOString(),
                  rows: [],
                  staged: true,
                  count: offerRows.length,
                }
              : undefined,
        };
        await clearRawRows(batchId, "follow_up");
        await stageRawRows(batchId, "follow_up", offerRows);
      } else {
        kind = "offers";
        rows = converted.offerRows;
        options = { ...options, corrections };
      }
      await clearRawRows(batchId, "row");
      await stageRawRows(batchId, "row", rows);
    } else {
      rows = [...(await batchRows(batch)).values()];
    }

    const plan = await planBatchRows(kind, rows, options);
    if (!(await writePlanItems(batchId, plan))) throw new Error("Item pratinjau gagal disimpan.");
    await db()
      .from("import_batches")
      .update({ kind, options, counts: plan.counts, status: "draft", lease_until: null })
      .eq("id", batchId)
      .eq("status", "analyzing");
    await recordAudit(actorOf(batch), "impor.pratinjau", "import_batch", batchId, {
      jenis: kind,
      asal: batch.origin,
      sumber: batch.source_label,
      ...plan.counts,
    });
    revalidatePath(`/admin/import/batch/${batchId}`);
    return { claimed: true, status: "draft", processed: rows.length };
  } catch (error) {
    console.error("[impor-analisis] gagal:", error);
    const message =
      error instanceof AnalysisError
        ? error.message
        : "Analisis berkas gagal karena data katalog tidak bisa dibaca. Coba unggah ulang beberapa saat lagi.";
    await db()
      .from("import_batches")
      .update({ status: "failed", lease_until: null, report: { error: message, summary: null } })
      .eq("id", batchId)
      .eq("status", "analyzing");
    return { claimed: true, status: "failed", processed: 0 };
  }
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
