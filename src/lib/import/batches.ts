import "server-only";

import type { AdminSession } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectWhereIn } from "@/lib/backend/paged-read";
import { recordAudit } from "@/lib/admin/audit";
import type { CsvRow } from "@/lib/import/csv-parser";
import { chunk, INSERT_CHUNK } from "@/lib/import/batch";
import { isImageUsageBasis, type ImageRights } from "@/lib/import/image-rights";
import {
  planOfferImport,
  planSpecImport,
  type ImportPlan,
  type PlanAction,
  type PlanChange,
} from "@/lib/import/plan";
import type { ImportReport, OfferImportReport } from "@/lib/import/report";
import {
  DRAFT_TTL_DAYS,
  emptyProgress,
  isExpiredDraft,
  type BatchStatus,
  type ItemResult,
  type Progress,
} from "@/lib/import/batch-status";
import { findMissingOfficialOffers } from "@/lib/import/missing-prices";
import { loadStoreResolver } from "@/lib/import/stores";

/**
 * Batch pratinjau impor (Pusat Impor): simpan → tinjau → antrekan → worker.
 *
 * Semua fungsi di sini dipanggil dari server action atau route yang sudah
 * memeriksa hak akses (requireStaff([]) / secret worker); tabelnya sendiri
 * tertutup untuk klien (RLS tanpa policy).
 *
 * Menerapkan batch TIDAK lagi dikerjakan dalam satu request. `queueBatch`
 * hanya menandai item terpilih sebagai pending; worker di `jobs.ts` menulis
 * per potongan kecil dengan lease, dan setiap item mendapat hasilnya sendiri.
 * Penulisan dihitung ulang terhadap data terkini, jadi batch yang dibuka lagi
 * beberapa jam kemudian tidak menulis keputusan yang sudah basi.
 */

export type BatchKind = "specs" | "offers";
/** csv/scrape = dibuat admin; schedule = pemeriksaan harga harian otomatis. */
export type BatchOrigin = "csv" | "scrape" | "schedule";
export type { BatchStatus };

/** Harga resmi hasil tarik otomatis yang menunggu spesifikasinya diterapkan. */
type FollowUpOffers = {
  sourceLabel: string;
  defaultObservedAt: string;
  /** Baris templat penawaran; `source_key` diubah jadi slug saat batch harga dibuat. */
  rows: CsvRow[];
};

export type BatchOptions = {
  imageRights?: ImageRights | null;
  defaultObservedAt?: string;
  defaultSellerName?: string;
  followUpOffers?: FollowUpOffers;
  /** Admin yang menekan Terapkan; dipakai worker untuk jejak audit. */
  appliedBy?: { userId: string; email: string };
  /** Sesi tarik otomatis asal batch ini. */
  scrapeSessionId?: string;
  /** Batch spesifikasi induk (untuk batch harga resmi lanjutan). */
  parentBatchId?: string;
  /** Kunci idempoten pemeriksaan harga harian ("<merek>:<tanggal WIB>"), unik di database. */
  refreshKey?: string;
};

export type BatchSummary = {
  id: string;
  kind: BatchKind;
  origin: BatchOrigin;
  sourceLabel: string;
  status: BatchStatus;
  counts: Partial<Record<PlanAction, number>>;
  progress: Progress | null;
  createdAt: string;
  /** Kapan penerapan dimulai. */
  startedAt: string | null;
  /** Batas lease worker yang sedang memegang batch; null bila tidak ada. */
  leaseUntil: string | null;
  appliedAt: string | null;
  createdByEmail: string | null;
};

export type BatchItem = {
  id: string;
  position: number;
  entity: "product" | "offer";
  action: PlanAction;
  label: string;
  reason: string | null;
  view: Record<string, unknown>;
  changes: PlanChange[];
  selected: boolean;
  result: ItemResult | null;
  resultAction: "created" | "updated" | "unchanged" | null;
  resultMessage: string | null;
};

export type BatchDetail = BatchSummary & {
  options: BatchOptions;
  malformedLines: number[];
  report: ImportReport | OfferImportReport | null;
  items: BatchItem[];
  /** Batch harga lanjutan yang dibuat setelah batch spesifikasi ini diterapkan. */
  followUpBatchId: string | null;
};

const SUMMARY_COLUMNS =
  "id, kind, origin, source_label, status, counts, progress, created_at, started_at, lease_until, applied_at, created_by_email";

function readProgress(value: unknown): Progress | null {
  const p = value as Partial<Progress> | null;
  return p && typeof p.total === "number"
    ? { total: p.total, done: p.done ?? 0, failed: p.failed ?? 0, skipped: p.skipped ?? 0 }
    : null;
}

function toSummary(row: Record<string, unknown>): BatchSummary {
  return {
    id: String(row.id),
    kind: row.kind as BatchKind,
    origin: row.origin as BatchSummary["origin"],
    sourceLabel: String(row.source_label),
    status: row.status as BatchStatus,
    counts: (row.counts ?? {}) as BatchSummary["counts"],
    progress: readProgress(row.progress),
    createdAt: String(row.created_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    leaseUntil: row.lease_until ? String(row.lease_until) : null,
    appliedAt: row.applied_at ? String(row.applied_at) : null,
    createdByEmail: row.created_by_email ? String(row.created_by_email) : null,
  };
}

export function readRights(value: unknown): ImageRights | null {
  if (!value || typeof value !== "object") return null;
  const { basis, text } = value as { basis?: unknown; text?: unknown };
  return isImageUsageBasis(basis) && typeof text === "string" && text ? { basis, text } : null;
}

export async function createBatch({
  kind,
  origin,
  sourceLabel,
  options,
  rows,
  malformedLines,
  admin,
}: {
  kind: BatchKind;
  origin: BatchOrigin;
  sourceLabel: string;
  options: BatchOptions;
  rows: readonly CsvRow[];
  malformedLines: number[];
  admin: AdminSession;
}): Promise<{ ok: true; id: string; plan: ImportPlan } | { ok: false; error: string }> {
  let plan: ImportPlan;
  try {
    plan =
      kind === "specs"
        ? await planSpecImport(rows, options.imageRights ?? null)
        : await planOfferImport(rows, {
            defaultObservedAt: options.defaultObservedAt ?? new Date().toISOString(),
            defaultSellerName: options.defaultSellerName ?? "",
            imageRights: options.imageRights ?? null,
          });
  } catch (error) {
    console.error("[pratinjau] gagal membuat rencana impor:", error);
    return { ok: false, error: "Data katalog yang ada gagal dibaca, jadi pratinjau belum bisa dibuat." };
  }

  const db = getInsforgeAdminClient().database;
  const inserted = await db
    .from("import_batches")
    .insert([
      {
        kind,
        origin,
        source_label: sourceLabel.slice(0, 200),
        options,
        rows,
        malformed_lines: malformedLines,
        counts: plan.counts,
        // Pekerjaan terjadwal tidak punya akun pelaku; kolomnya dibiarkan kosong.
        created_by: admin.userId || null,
        created_by_email: admin.email,
      },
    ])
    .select("id");
  const batchId = ((inserted.data ?? [])[0] as { id: string } | undefined)?.id;
  if (inserted.error || !batchId) {
    console.error("[pratinjau] batch gagal disimpan:", inserted.error);
    return { ok: false, error: "Pratinjau gagal disimpan." };
  }

  const itemRows = plan.items.map((item, position) => ({
    batch_id: batchId,
    position,
    entity: item.entity,
    action: item.action,
    label: item.label.slice(0, 300),
    reason: item.reason,
    row_indexes: item.rowIndexes,
    view: item.view,
    changes: item.changes,
  }));
  for (const group of chunk(itemRows, INSERT_CHUNK)) {
    const { error } = await db.from("import_items").insert(group);
    if (error) {
      console.error("[pratinjau] baris batch gagal disimpan:", error);
      await db.from("import_batches").delete().eq("id", batchId);
      return { ok: false, error: "Pratinjau gagal disimpan." };
    }
  }

  await recordAudit(admin, "impor.pratinjau", "import_batch", batchId, {
    jenis: kind,
    asal: origin,
    sumber: sourceLabel,
    ...plan.counts,
  });
  return { ok: true, id: batchId, plan };
}

export async function listBatches(
  limit = 15,
  { excludeScheduled = false }: { excludeScheduled?: boolean } = {}
): Promise<BatchSummary[]> {
  let query = getInsforgeAdminClient().database.from("import_batches").select(SUMMARY_COLUMNS);
  if (excludeScheduled) query = query.neq("origin", "schedule");
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error("Daftar batch impor gagal dibaca.");
  return ((data ?? []) as Record<string, unknown>[]).map(toSummary);
}

/** Ringkasan satu batch (tanpa item), untuk polling progres yang ringan. */
export async function getBatchSummary(id: string): Promise<BatchSummary | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await getInsforgeAdminClient()
    .database.from("import_batches")
    .select(SUMMARY_COLUMNS)
    .eq("id", id)
    .limit(1);
  if (error) throw new Error("Batch impor gagal dibaca.");
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  return row ? toSummary(row) : null;
}

export type ProductLineage = {
  lastSource: "import" | "scrape" | "manual" | null;
  createdBy: { id: string; label: string } | null;
  updatedBy: { id: string; label: string } | null;
};

/** Asal data satu produk: batch yang membuat dan terakhir memperbaruinya (Fase 4). */
export async function getProductLineage(productId: string): Promise<ProductLineage | null> {
  const db = getInsforgeAdminClient().database;
  const { data } = await db
    .from("products")
    .select("last_source, created_by_batch_id, updated_by_batch_id")
    .eq("id", productId)
    .limit(1);
  const row = (data ?? [])[0] as
    | { last_source: ProductLineage["lastSource"]; created_by_batch_id: string | null; updated_by_batch_id: string | null }
    | undefined;
  if (!row) return null;
  const ids = [row.created_by_batch_id, row.updated_by_batch_id].filter((id): id is string => Boolean(id));
  const batches = ids.length
    ? (((await db.from("import_batches").select("id, source_label").in("id", ids)).data ?? []) as { id: string; source_label: string }[])
    : [];
  const label = (id: string | null) => {
    const found = id ? batches.find((batch) => batch.id === id) : undefined;
    return found ? { id: found.id, label: found.source_label } : null;
  };
  return { lastSource: row.last_source, createdBy: label(row.created_by_batch_id), updatedBy: label(row.updated_by_batch_id) };
}

/** ID batch harga resmi lanjutan dari laporan batch spesifikasi, bila ada. */
export async function getFollowUpBatchId(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await getInsforgeAdminClient().database.from("import_batches").select("report").eq("id", id).limit(1);
  const report = ((data ?? [])[0] as { report?: { followUpBatchId?: string } | null } | undefined)?.report;
  return report?.followUpBatchId ?? null;
}

export async function getBatch(id: string): Promise<BatchDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = getInsforgeAdminClient().database;
  const { data, error } = await db
    .from("import_batches")
    .select(`${SUMMARY_COLUMNS}, options, malformed_lines, report`)
    .eq("id", id)
    .limit(1);
  if (error) throw new Error("Batch impor gagal dibaca.");
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const items = await selectWhereIn(
    "import_items",
    "id, position, entity, action, label, reason, view, changes, selected, result, result_action, result_message",
    "batch_id",
    [id],
    { order: [{ column: "position", ascending: true }] }
  );
  const options = (row.options ?? {}) as BatchOptions;
  const report = (row.report ?? null) as (ImportReport | OfferImportReport | null) & {
    followUpBatchId?: string;
  };

  return {
    ...toSummary(row),
    options,
    malformedLines: (row.malformed_lines ?? []) as number[],
    report,
    followUpBatchId: report?.followUpBatchId ?? null,
    items: items
      .map((item) => ({
        id: String(item.id),
        position: Number(item.position),
        entity: item.entity as BatchItem["entity"],
        action: item.action as PlanAction,
        label: String(item.label),
        reason: item.reason ? String(item.reason) : null,
        view: (item.view ?? {}) as Record<string, unknown>,
        changes: (item.changes ?? []) as PlanChange[],
        selected: Boolean(item.selected),
        result: (item.result ?? null) as ItemResult | null,
        resultAction: (item.result_action ?? null) as BatchItem["resultAction"],
        resultMessage: item.result_message ? String(item.result_message) : null,
      }))
      .sort((a, b) => a.position - b.position),
  };
}

export async function discardBatch(id: string, admin: AdminSession): Promise<boolean> {
  const { error } = await getInsforgeAdminClient()
    .database.from("import_batches")
    .update({ status: "discarded" })
    .eq("id", id)
    .eq("status", "draft");
  if (!error) await recordAudit(admin, "impor.batalkan", "import_batch", id);
  return !error;
}

/**
 * Membatalkan draft yang tidak ditinjau lebih dari `DRAFT_TTL_DAYS` hari.
 * Draft basi berbahaya: pratinjaunya dihitung terhadap data lama, dan harga
 * di dalamnya sudah tidak mencerminkan pemeriksaan terkini. `admin` null
 * = dijalankan worker terjadwal (tanpa sesi); alasannya tetap tercatat di
 * laporan batch.
 */
export async function expireStaleDrafts(admin: AdminSession | null): Promise<number> {
  const cutoff = new Date(Date.now() - DRAFT_TTL_DAYS * 86_400_000).toISOString();
  const { data, error } = await getInsforgeAdminClient()
    .database.from("import_batches")
    .update({
      status: "discarded",
      report: { error: `Kedaluwarsa: tidak ditinjau lebih dari ${DRAFT_TTL_DAYS} hari.`, summary: null },
    })
    .eq("status", "draft")
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("[impor] draft kedaluwarsa gagal dibatalkan:", error);
    return 0;
  }
  const expired = (data ?? []) as { id: string }[];
  if (admin) {
    for (const row of expired) await recordAudit(admin, "impor.kedaluwarsa", "import_batch", row.id);
  }
  return expired.length;
}

/** Menandai sekumpulan item dalam kelompok kecil (filter `.in()` masuk URL). */
async function updateItems(ids: readonly string[], values: Record<string, unknown>): Promise<boolean> {
  const db = getInsforgeAdminClient().database;
  for (const group of chunk(ids, 80)) {
    const { error } = await db.from("import_items").update(values).in("id", group);
    if (error) {
      console.error("[impor] item batch gagal diperbarui:", error);
      return false;
    }
  }
  return true;
}

/**
 * Mengantrekan item terpilih untuk diterapkan worker. Tidak menulis katalog.
 *
 * Urutannya disengaja: item ditandai pending LEBIH DULU, baru status batch
 * dipindah `draft → queued` secara atomik. Dengan begitu worker tidak pernah
 * melihat batch antre yang itemnya belum siap, dan klik ganda hanya satu yang
 * berhasil mengklaim.
 */
export async function queueBatch(
  id: string,
  selectedItemIds: readonly string[],
  admin: AdminSession
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getInsforgeAdminClient().database;
  const { data, error } = await db.from("import_batches").select("id, status, options, created_at").eq("id", id).limit(1);
  const batch = (data ?? [])[0] as
    | { id: string; status: BatchStatus; options: BatchOptions; created_at: string }
    | undefined;
  if (error || !batch) return { ok: false, error: "Batch impor tidak ditemukan." };
  if (batch.status !== "draft") return { ok: false, error: "Batch ini sedang atau sudah diterapkan." };
  // Draft basi tidak boleh diterapkan walau job harian belum sempat menandainya:
  // pratinjaunya dihitung terhadap data yang sudah lama berubah.
  if (isExpiredDraft({ status: batch.status, createdAt: batch.created_at }, new Date())) {
    return { ok: false, error: `Pratinjau ini berumur lebih dari ${DRAFT_TTL_DAYS} hari. Buat pratinjau baru dari sumbernya.` };
  }

  const items = await selectWhereIn("import_items", "id, action", "batch_id", [id]);
  const wanted = new Set(selectedItemIds);
  const chosen = items
    .filter((item) => wanted.has(String(item.id)) && item.action !== "skip")
    .map((item) => String(item.id));
  if (chosen.length === 0) return { ok: false, error: "Pilih minimal satu baris untuk diterapkan." };

  const reset = await db
    .from("import_items")
    .update({ selected: false, result: null, result_action: null, result_message: null, entity_id: null, processed_at: null })
    .eq("batch_id", id);
  if (reset.error || !(await updateItems(chosen, { selected: true, result: "pending" }))) {
    return { ok: false, error: "Pilihan baris gagal disimpan. Coba lagi." };
  }

  const claimed = await db
    .from("import_batches")
    .update({
      status: "queued",
      progress: emptyProgress(chosen.length),
      options: { ...batch.options, appliedBy: { userId: admin.userId, email: admin.email } },
      report: null,
      started_at: null,
      applied_at: null,
      lease_until: null,
      attempts: 0,
    })
    .eq("id", id)
    .eq("status", "draft")
    .gt("created_at", new Date(Date.now() - DRAFT_TTL_DAYS * 86_400_000).toISOString())
    .select("id");
  if (claimed.error || (claimed.data ?? []).length === 0) {
    return { ok: false, error: "Batch ini sedang atau sudah diterapkan." };
  }

  await recordAudit(admin, "impor.antrekan", "import_batch", id, { baris: chosen.length });
  return { ok: true };
}

/**
 * Mengantrekan semua baris yang bisa diterapkan dari batch yang baru dibuat
 * tanpa tinjauan manual: harga resmi lanjutan (sudah ditinjau bersama
 * spesifikasinya) dan pemeriksaan harga harian (hanya penawaran yang sudah ada).
 */
export async function queuePlannedItems(
  batchId: string,
  plan: ImportPlan,
  actor: AdminSession
): Promise<{ ok: true; queued: number } | { ok: false; error: string }> {
  const wanted = new Set(
    plan.items.flatMap((item, position) => (item.action === "skip" ? [] : [position]))
  );
  if (wanted.size === 0) return { ok: true, queued: 0 };
  const items = await selectWhereIn("import_items", "id, position", "batch_id", [batchId]);
  const ids = items.filter((row) => wanted.has(Number(row.position))).map((row) => String(row.id));
  const queued = await queueBatch(batchId, ids, actor);
  return queued.ok ? { ok: true, queued: ids.length } : queued;
}

/** Umur batch pemeriksaan harga harian sebelum dihapus (riwayat harganya tetap ada). */
export const SCHEDULED_BATCH_RETENTION_DAYS = 30;

/**
 * Menghapus batch terjadwal yang sudah selesai dan berumur lebih dari
 * `SCHEDULED_BATCH_RETENTION_DAYS`. Tanpa ini, 7 merek x 365 hari menumpuk
 * ribuan batch dan puluhan ribu item. Harga dan pemeriksaannya TIDAK ikut
 * hilang (FK `ON DELETE SET NULL`); yang hilang hanya jejak batch, sehingga
 * batch selama itu juga tidak bisa diurungkan lagi.
 */
export async function purgeScheduledBatches(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SCHEDULED_BATCH_RETENTION_DAYS * 86_400_000).toISOString();
  const { data, error } = await getInsforgeAdminClient()
    .database.from("import_batches")
    .delete()
    .eq("origin", "schedule")
    .in("status", ["applied", "partial", "failed", "discarded", "reverted"])
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("[impor] batch terjadwal lama gagal dihapus:", error);
    return 0;
  }
  return (data ?? []).length;
}

/** Mengantrekan ulang item yang gagal pada batch yang sudah selesai. */
export async function retryFailedItems(
  id: string,
  admin: AdminSession
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getInsforgeAdminClient().database;
  const { data } = await db.from("import_batches").select("status, progress").eq("id", id).limit(1);
  const batch = (data ?? [])[0] as { status: BatchStatus; progress: unknown } | undefined;
  if (!batch || (batch.status !== "partial" && batch.status !== "failed")) {
    return { ok: false, error: "Batch ini tidak punya baris gagal yang bisa dicoba ulang." };
  }
  const failed = await selectWhereIn("import_items", "id, result, selected", "batch_id", [id]);
  const ids = failed.filter((item) => item.selected && item.result === "failed").map((item) => String(item.id));
  if (ids.length === 0) return { ok: false, error: "Tidak ada baris gagal." };
  if (!(await updateItems(ids, { result: "pending", result_message: null, processed_at: null }))) {
    return { ok: false, error: "Baris gagal tidak bisa diantrekan ulang." };
  }

  const progress = readProgress(batch.progress) ?? emptyProgress(ids.length);
  const claimed = await db
    .from("import_batches")
    .update({ status: "queued", progress: { ...progress, failed: 0 }, lease_until: null, applied_at: null })
    .eq("id", id)
    .in("status", ["partial", "failed"])
    .select("id");
  if (claimed.error || (claimed.data ?? []).length === 0) {
    return { ok: false, error: "Batch ini sedang diterapkan." };
  }
  await recordAudit(admin, "impor.coba-ulang", "import_batch", id, { baris: ids.length });
  return { ok: true };
}

/**
 * Baris harga lanjutan membawa `source_key`; slug diambil dari produk yang
 * tersimpan. Hanya produk yang benar-benar diterapkan pada batch spesifikasi
 * (`allowedProductIds`) yang ikut, supaya harga produk yang tidak dicentang
 * tidak menyusup ke pratinjau harga.
 */
export async function resolveFollowUpSlugs(
  rows: CsvRow[],
  allowedProductIds: ReadonlySet<string>
): Promise<CsvRow[]> {
  const keys = [...new Set(rows.map((row) => row.source_key ?? "").filter(Boolean))];
  const products = await selectWhereIn("products", "id, slug, source_key", "source_key", keys);
  const slugByKey = new Map(
    products
      .filter((row) => allowedProductIds.has(String(row.id)))
      .map((row) => [String(row.source_key), String(row.slug)])
  );
  return rows.flatMap((row) => {
    const slug = slugByKey.get(row.source_key ?? "");
    if (!slug) return [];
    const rest: CsvRow = { ...row, slug };
    delete rest.source_key;
    return [rest];
  });
}

/**
 * Penawaran situs resmi (toko yang sama, produk terpilih yang sama) yang tidak
 * muncul di hasil tarik otomatis kali ini mendapat catatan pemeriksaan gagal.
 * Aturan pemilihannya ada di `findMissingOfficialOffers`.
 */
export async function recordMissingOfficialPrices(
  scopeRows: readonly CsvRow[],
  seenRows: readonly CsvRow[],
  attemptedAt: string,
  batchId: string | null = null
): Promise<number> {
  const slugs = [...new Set(scopeRows.map((row) => row.slug ?? "").filter(Boolean))];
  if (slugs.length === 0) return 0;

  const storeFor = await loadStoreResolver();
  const products = await selectWhereIn("products", "id, slug", "slug", slugs);
  const variants = await selectWhereIn(
    "variants",
    "id, product_id, ram_gb, storage_gb",
    "product_id",
    products.map((row) => String(row.id))
  );
  const offers = await selectWhereIn(
    "offers",
    "id, variant_id, url, store_id",
    "variant_id",
    variants.map((row) => String(row.id))
  );

  const missing = findMissingOfficialOffers({
    scopeRows,
    seenRows,
    storeFor,
    products: products.map((row) => ({ id: String(row.id), slug: String(row.slug) })),
    variants: variants.map((row) => ({
      id: String(row.id),
      productId: String(row.product_id),
      ramGb: Number(row.ram_gb),
      storageGb: Number(row.storage_gb),
    })),
    offers: offers.map((row) => ({
      id: String(row.id),
      variantId: String(row.variant_id),
      url: String(row.url),
      storeId: row.store_id ? String(row.store_id) : null,
    })),
  });
  if (missing.length === 0) return 0;

  const { error } = await getInsforgeAdminClient()
    .database.from("price_checks")
    .upsert(
      missing.map((offerId) => ({
        offer_id: offerId,
        attempted_at: attemptedAt,
        outcome: "failure",
        error_summary: "Varian ini tidak lagi tercantum dengan harga di situs resmi saat tarik otomatis.",
        batch_id: batchId,
      })),
      { onConflict: "offer_id,attempted_at,outcome", ignoreDuplicates: true }
    );
  if (error) throw new Error(JSON.stringify(error));
  return missing.length;
}
