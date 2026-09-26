import "server-only";

import type { AdminSession } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectWhereIn } from "@/lib/backend/paged-read";
import { recordAudit } from "@/lib/admin/audit";
import type { CsvRow } from "@/lib/import/csv-parser";
import { chunk, INSERT_CHUNK } from "@/lib/import/batch";
import { isImageUsageBasis, type ImageRights } from "@/lib/import/image-rights";
import { runOfferImport } from "@/lib/import/offer-runner";
import {
  planOfferImport,
  planSpecImport,
  type ImportPlan,
  type PlanAction,
  type PlanChange,
} from "@/lib/import/plan";
import type { ImportReport, OfferImportReport } from "@/lib/import/report";
import { runSpecImport } from "@/lib/import/spec-runner";
import { loadStoreResolver } from "@/lib/import/stores";

/**
 * Batch pratinjau impor (Pusat Impor): simpan → tinjau → terapkan.
 *
 * Semua fungsi di sini dipanggil dari server action yang sudah menjalankan
 * requireAdmin(); tabelnya sendiri tertutup untuk klien (RLS tanpa policy).
 *
 * Penerapan memakai runner yang sama dengan unggah langsung, dengan baris
 * mentah yang dipilih admin. Hasilnya dihitung ulang terhadap data terkini,
 * jadi batch yang dibuka lagi beberapa jam kemudian tidak menulis keputusan
 * yang sudah basi.
 */

export type BatchKind = "specs" | "offers";
export type BatchStatus = "draft" | "applied" | "discarded";

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
};

export type BatchSummary = {
  id: string;
  kind: BatchKind;
  origin: "csv" | "scrape";
  sourceLabel: string;
  status: BatchStatus;
  counts: Partial<Record<PlanAction, number>>;
  createdAt: string;
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
  "id, kind, origin, source_label, status, counts, created_at, applied_at, created_by_email";

function toSummary(row: Record<string, unknown>): BatchSummary {
  return {
    id: String(row.id),
    kind: row.kind as BatchKind,
    origin: row.origin as BatchSummary["origin"],
    sourceLabel: String(row.source_label),
    status: row.status as BatchStatus,
    counts: (row.counts ?? {}) as BatchSummary["counts"],
    createdAt: String(row.created_at),
    appliedAt: row.applied_at ? String(row.applied_at) : null,
    createdByEmail: row.created_by_email ? String(row.created_by_email) : null,
  };
}

function readRights(value: unknown): ImageRights | null {
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
  origin: "csv" | "scrape";
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
        created_by: admin.userId,
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

export async function listBatches(limit = 15): Promise<BatchSummary[]> {
  const { data, error } = await getInsforgeAdminClient()
    .database.from("import_batches")
    .select(SUMMARY_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Daftar batch impor gagal dibaca.");
  return ((data ?? []) as Record<string, unknown>[]).map(toSummary);
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
    "id, position, entity, action, label, reason, view, changes",
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
 * Menerapkan item terpilih. Hanya item berstatus baru/berubah/sama yang bisa
 * dipilih; item "dilewati" memang tidak punya baris yang sah untuk ditulis.
 */
export async function applyBatch(
  id: string,
  selectedItemIds: readonly string[],
  admin: AdminSession
): Promise<{ ok: true; followUpBatchId: string | null } | { ok: false; error: string }> {
  const db = getInsforgeAdminClient().database;
  const { data, error } = await db
    .from("import_batches")
    .select("id, kind, origin, source_label, status, options, rows, malformed_lines")
    .eq("id", id)
    .limit(1);
  const batch = (data ?? [])[0] as
    | {
        id: string;
        kind: BatchKind;
        origin: "csv" | "scrape";
        source_label: string;
        status: BatchStatus;
        options: BatchOptions;
        rows: CsvRow[];
        malformed_lines: number[];
      }
    | undefined;
  if (error || !batch) return { ok: false, error: "Batch impor tidak ditemukan." };
  if (batch.status !== "draft") return { ok: false, error: "Batch ini sudah diterapkan atau dibatalkan." };

  // Tandai lebih dulu supaya klik ganda tidak menerapkan batch yang sama dua kali.
  const claimed = await db
    .from("import_batches")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  if (claimed.error || (claimed.data ?? []).length === 0) {
    return { ok: false, error: "Batch ini sedang atau sudah diterapkan." };
  }

  const items = await selectWhereIn("import_items", "id, action, row_indexes", "batch_id", [id]);
  const chosen = new Set(selectedItemIds);
  const rowIndexes = new Set<number>();
  for (const item of items) {
    if (!chosen.has(String(item.id)) || item.action === "skip") continue;
    for (const index of (item.row_indexes ?? []) as number[]) rowIndexes.add(index);
  }
  const rows = [...rowIndexes].sort((a, b) => a - b).map((index) => batch.rows[index]!).filter(Boolean);

  const rights = readRights(batch.options.imageRights);
  let report: ImportReport | OfferImportReport;
  try {
    report =
    rows.length === 0
      ? { error: "Tidak ada baris yang dipilih untuk diterapkan.", summary: null }
      : batch.kind === "specs"
        ? await runSpecImport({
            rows,
            fileName: batch.source_label,
            defaultImageRights: rights,
            admin,
            malformedLines: batch.malformed_lines,
          })
        : await runOfferImport({
            rows,
            fileName: batch.source_label,
            defaultObservedAt: batch.options.defaultObservedAt ?? new Date().toISOString(),
            defaultSellerName: batch.options.defaultSellerName ?? "",
            imageRights: rights,
            admin,
            malformedLines: batch.malformed_lines,
          });
  } catch (error) {
    console.error("[impor] penerapan batch gagal:", error);
    await db.from("import_batches").update({ status: "draft", applied_at: null }).eq("id", id);
    return { ok: false, error: "Penerapan gagal di tengah jalan. Batch dikembalikan ke draft; periksa katalog lalu coba lagi." };
  }

  // Tarik otomatis harga resmi: varian yang dulu punya penawaran situs resmi
  // tetapi kini tidak lagi tercantum berharga dicatat sebagai pemeriksaan
  // GAGAL. Waktu "terakhir berhasil diperiksa" tidak maju, jadi harganya menua
  // dengan jujur alih-alih tampak baru dicek.
  if (batch.kind === "offers" && batch.origin === "scrape" && !report.error) {
    try {
      await recordMissingOfficialPrices(rows, batch.options.defaultObservedAt ?? new Date().toISOString());
    } catch (error) {
      console.error("[impor] kegagalan harga resmi gagal dicatat:", error);
    }
  }

  // Harga resmi hasil tarik otomatis: dibuat jadi batch pratinjau sendiri
  // setelah produknya tersimpan, supaya slug produk baru sudah ada.
  let followUpBatchId: string | null = null;
  const followUp = batch.options.followUpOffers;
  if (batch.kind === "specs" && followUp && !report.error) {
    const offerRows = await resolveFollowUpSlugs(followUp.rows);
    if (offerRows.length > 0) {
      const created = await createBatch({
        kind: "offers",
        origin: "scrape",
        sourceLabel: followUp.sourceLabel,
        options: { defaultObservedAt: followUp.defaultObservedAt, imageRights: null },
        rows: offerRows,
        malformedLines: [],
        admin,
      });
      if (created.ok) followUpBatchId = created.id;
    }
  }

  await db
    .from("import_batches")
    .update({
      report: { ...report, ...(followUpBatchId ? { followUpBatchId } : {}) },
      // Penerapan yang gagal total dikembalikan ke draft supaya bisa dicoba lagi.
      ...(report.error ? { status: "draft", applied_at: null } : {}),
    })
    .eq("id", id);

  await recordAudit(admin, "impor.terapkan", "import_batch", id, {
    jenis: batch.kind,
    baris: rows.length,
    galat: report.error,
  });
  return report.error ? { ok: false, error: report.error } : { ok: true, followUpBatchId };
}

/** Baris harga lanjutan membawa `source_key`; slug diambil dari produk yang tersimpan. */
async function resolveFollowUpSlugs(rows: CsvRow[]): Promise<CsvRow[]> {
  const keys = [...new Set(rows.map((row) => row.source_key ?? "").filter(Boolean))];
  const products = await selectWhereIn("products", "slug, source_key", "source_key", keys);
  const slugByKey = new Map(products.map((row) => [String(row.source_key), String(row.slug)]));
  return rows.flatMap((row) => {
    const slug = slugByKey.get(row.source_key ?? "");
    if (!slug) return [];
    const rest: CsvRow = { ...row, slug };
    delete rest.source_key;
    return [rest];
  });
}

/**
 * Penawaran situs resmi (toko yang sama, produk yang sama) yang tidak muncul di
 * hasil tarik otomatis kali ini mendapat catatan pemeriksaan gagal.
 */
async function recordMissingOfficialPrices(rows: readonly CsvRow[], attemptedAt: string): Promise<number> {
  const storeFor = await loadStoreResolver();
  const storeIds = new Set(rows.map((row) => storeFor(row.url ?? "")).filter((id): id is string => Boolean(id)));
  const slugs = [...new Set(rows.map((row) => row.slug ?? "").filter(Boolean))];
  if (storeIds.size === 0 || slugs.length === 0) return 0;

  const products = await selectWhereIn("products", "id, slug", "slug", slugs);
  const variants = await selectWhereIn(
    "variants",
    "id, product_id, ram_gb, storage_gb",
    "product_id",
    products.map((row) => String(row.id))
  );
  const productIdBySlug = new Map(products.map((row) => [String(row.slug), String(row.id)]));
  const variantIdByKey = new Map(
    variants.map((row) => [`${row.product_id}|${row.ram_gb}|${row.storage_gb}`, String(row.id)])
  );
  const seen = new Set(
    rows.flatMap((row) => {
      const variantId = variantIdByKey.get(
        `${productIdBySlug.get(row.slug ?? "")}|${row.ram_gb}|${row.storage_gb}`
      );
      return variantId ? [`${variantId}|${row.url}`] : [];
    })
  );

  const offers = await selectWhereIn(
    "offers",
    "id, variant_id, url, store_id",
    "variant_id",
    variants.map((row) => String(row.id))
  );
  const missing = offers.filter(
    (offer) => storeIds.has(String(offer.store_id)) && !seen.has(`${offer.variant_id}|${offer.url}`)
  );
  if (missing.length === 0) return 0;

  const { error } = await getInsforgeAdminClient()
    .database.from("price_checks")
    .upsert(
      missing.map((offer) => ({
        offer_id: String(offer.id),
        attempted_at: attemptedAt,
        outcome: "failure",
        error_summary: "Varian ini tidak lagi tercantum dengan harga di situs resmi saat tarik otomatis.",
      })),
      { onConflict: "offer_id,attempted_at,outcome", ignoreDuplicates: true }
    );
  if (error) throw new Error(JSON.stringify(error));
  return missing.length;
}
