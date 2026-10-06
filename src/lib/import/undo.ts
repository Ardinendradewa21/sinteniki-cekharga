import "server-only";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/admin/audit";
import type { AdminSession } from "@/lib/auth/dal";
import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectWhereIn } from "@/lib/backend/paged-read";
import { chunk } from "@/lib/import/batch";
import { activePhotoJobs, cancelBatchPhotoJobs } from "@/lib/import/photo-jobs";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/import/product-images";
import {
  canUndo,
  classifyProduct,
  offerRemovable,
  type ProductDecision,
} from "@/lib/import/undo-rules";

/**
 * Undo terbatas satu batch impor (rencana kerja impor, Fase 4.2).
 *
 * `planUndo` hanya membaca dan menghitung apa yang akan terjadi, untuk layar
 * konfirmasi. `executeUndo` menghapus dengan perhitungan yang SAMA
 * (`selectRemovable`), dan syarat utamanya ditulis ulang di setiap query hapus
 * (dibuat batch ini, belum disentuh sejak applied_at). Baris yang berubah di
 * antara pratinjau dan konfirmasi tetap aman, dan undo dua kali tidak
 * menghapus lebih banyak.
 *
 * Yang tidak pernah disentuh undo:
 *   - produk yang sudah ada sebelum batch (perubahannya tidak dikembalikan),
 *   - produk yang sudah diterbitkan atau disunting setelah batch,
 *   - penawaran, harga, dan pemeriksaan milik produk TERBIT: menghapusnya
 *     langsung mengubah halaman publik yang sudah diputuskan admin.
 *
 * Batch spesifikasi hasil tarik otomatis ikut membatalkan batch harga resmi
 * lanjutannya, karena keduanya satu keputusan admin.
 *
 * Foto: antrean foto batch yang belum dikerjakan dibatalkan, dan foto yang
 * DIBUAT batch ini (`product_assets.created_by_batch_id`) dihapus dari produk
 * draft. Foto produk terbit tetap, dan foto yang hanya diganti tidak bisa
 * dikembalikan karena isi lamanya sudah tidak ada.
 */

export type UndoPlan = {
  batchId: string;
  kind: "specs" | "offers";
  sourceLabel: string;
  allowed: { ok: true } | { ok: false; reason: string };
  products: { remove: ProductDecision[]; keep: ProductDecision[]; updatedNotReverted: number };
  offers: { remove: number; keepTouched: number; updatedNotReverted: number };
  observations: number;
  checks: number;
  /** Catatan harga/pemeriksaan milik produk terbit yang sengaja tidak dihapus. */
  protectedPrices: number;
  /** Foto buatan batch pada produk yang TIDAK ikut dihapus. */
  photos: { remove: number; protected: number };
  followUp: UndoPlan | null;
};

type BatchRow = {
  id: string;
  kind: "specs" | "offers";
  status: string;
  source_label: string;
  applied_at: string | null;
  report: { followUpBatchId?: string } | null;
};

function db() {
  return getInsforgeAdminClient().database;
}

async function loadBatch(id: string): Promise<BatchRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db()
    .from("import_batches")
    .select("id, kind, status, source_label, applied_at, report")
    .eq("id", id)
    .limit(1);
  return ((data ?? [])[0] as BatchRow | undefined) ?? null;
}

/** Penawaran yang menempel pada produk berstatus terbit. */
async function offersOfPublishedProducts(offerIds: readonly string[]): Promise<Set<string>> {
  if (offerIds.length === 0) return new Set();
  const offers = await selectWhereIn("offers", "id, variant_id", "id", offerIds);
  const variants = await selectWhereIn("variants", "id, product_id", "id", offers.map((row) => String(row.variant_id)));
  const products = await selectWhereIn("products", "id, status", "id", variants.map((row) => String(row.product_id)));
  const published = new Set(products.filter((row) => row.status === "published").map((row) => String(row.id)));
  const productByVariant = new Map(variants.map((row) => [String(row.id), String(row.product_id)]));
  return new Set(
    offers
      .filter((row) => published.has(productByVariant.get(String(row.variant_id)) ?? ""))
      .map((row) => String(row.id))
  );
}

type PriceRow = { id: string; offerId: string };

/**
 * Foto yang dibuat batch ini pada produk yang tetap ada. Foto milik produk
 * yang ikut dihapus hilang lewat cascade (dan objeknya dihapus di langkah
 * produk), jadi tidak dihitung dua kali.
 */
async function batchPhotos(batchId: string, removedProducts: ReadonlySet<string>) {
  const assets = (await selectWhereIn(
    "product_assets",
    "id, product_id, storage_key",
    "created_by_batch_id",
    [batchId]
  )).filter((row) => !removedProducts.has(String(row.product_id)));
  const products = await selectWhereIn("products", "id, status", "id", assets.map((row) => String(row.product_id)));
  const published = new Set(products.filter((row) => row.status === "published").map((row) => String(row.id)));
  return {
    removable: assets
      .filter((row) => !published.has(String(row.product_id)))
      .map((row) => ({ id: String(row.id), storageKey: row.storage_key ? String(row.storage_key) : null })),
    protected: assets.filter((row) => published.has(String(row.product_id))).length,
  };
}

async function priceRows(table: "price_observations" | "price_checks", batchId: string): Promise<PriceRow[]> {
  const rows = await selectWhereIn(table, "id, offer_id", "batch_id", [batchId]);
  return rows.map((row) => ({ id: String(row.id), offerId: String(row.offer_id) }));
}

/** Apa yang boleh dihapus untuk satu batch; dipakai sama persis oleh pratinjau dan eksekusi. */
async function selectRemovable(batchId: string, appliedAt: string) {
  const offersCreated = await selectWhereIn(
    "offers",
    "id, created_by_batch_id, updated_at",
    "created_by_batch_id",
    [batchId]
  );
  const untouched = offersCreated
    .filter((row) =>
      offerRemovable(
        { id: String(row.id), createdByBatchId: String(row.created_by_batch_id), updatedAt: String(row.updated_at) },
        batchId,
        appliedAt
      )
    )
    .map((row) => String(row.id));
  const [observations, checks] = await Promise.all([
    priceRows("price_observations", batchId),
    priceRows("price_checks", batchId),
  ]);
  const protectedOffers = await offersOfPublishedProducts([
    ...new Set([...untouched, ...observations.map((row) => row.offerId), ...checks.map((row) => row.offerId)]),
  ]);
  const removableOffers = untouched.filter((id) => !protectedOffers.has(id));
  const removedOffers = new Set(removableOffers);
  // Harga pada penawaran yang ikut dihapus hilang lewat cascade; harga milik
  // produk terbit dilindungi; sisanya dihapus per baris.
  const removablePrice = (row: PriceRow) => !protectedOffers.has(row.offerId) && !removedOffers.has(row.offerId);
  const cascaded = (row: PriceRow) => removedOffers.has(row.offerId);
  const shielded = (row: PriceRow) => protectedOffers.has(row.offerId);
  return {
    offersCreated: offersCreated.length,
    removableOffers,
    observations: observations.filter(removablePrice).map((row) => row.id),
    checks: checks.filter(removablePrice).map((row) => row.id),
    cascadedObservations: observations.filter(cascaded).length,
    cascadedChecks: checks.filter(cascaded).length,
    protectedPrices: observations.filter(shielded).length + checks.filter(shielded).length,
  };
}

export async function planUndo(batchId: string): Promise<UndoPlan | null> {
  const batch = await loadBatch(batchId);
  if (!batch) return null;
  const allowed = canUndo(batch.status, batch.applied_at);
  const appliedAt = batch.applied_at ?? new Date(0).toISOString();

  const created = (await selectWhereIn(
    "products",
    "id, brand, model, status, created_by_batch_id, updated_at",
    "created_by_batch_id",
    [batchId]
  )) as Record<string, unknown>[];
  const decisions = created.map((row) =>
    classifyProduct(
      {
        id: String(row.id),
        label: `${row.brand} ${row.model}`,
        status: String(row.status),
        createdByBatchId: row.created_by_batch_id ? String(row.created_by_batch_id) : null,
        updatedAt: String(row.updated_at),
      },
      batchId,
      appliedAt
    )
  );
  const productsUpdated = await selectWhereIn("products", "id, created_by_batch_id", "updated_by_batch_id", [batchId]);
  const offersUpdated = await selectWhereIn("offers", "id, created_by_batch_id", "updated_by_batch_id", [batchId]);
  const removable = await selectRemovable(batchId, appliedAt);
  const photos = await batchPhotos(batchId, new Set(decisions.filter((d) => d.remove).map((d) => d.id)));

  const followUpId = batch.report?.followUpBatchId;
  return {
    batchId,
    kind: batch.kind,
    sourceLabel: batch.source_label,
    allowed,
    products: {
      remove: decisions.filter((d) => d.remove),
      keep: decisions.filter((d) => !d.remove),
      updatedNotReverted: productsUpdated.filter((row) => row.created_by_batch_id !== batchId).length,
    },
    offers: {
      remove: removable.removableOffers.length,
      keepTouched: removable.offersCreated - removable.removableOffers.length,
      updatedNotReverted: offersUpdated.filter((row) => row.created_by_batch_id !== batchId).length,
    },
    observations: removable.observations.length + removable.cascadedObservations,
    checks: removable.checks.length + removable.cascadedChecks,
    protectedPrices: removable.protectedPrices,
    photos: { remove: photos.removable.length, protected: photos.protected },
    followUp: followUpId ? await planUndo(followUpId) : null,
  };
}

export type UndoResult = {
  products: number;
  offers: number;
  observations: number;
  checks: number;
  /** Foto buatan batch yang dihapus dari produk yang tetap ada. */
  photos: number;
  storageObjects: number;
};

async function undoOne(batch: BatchRow, admin: AdminSession): Promise<UndoResult | { error: string }> {
  const allowed = canUndo(batch.status, batch.applied_at);
  if (!allowed.ok) return { error: allowed.reason };
  const appliedAt = batch.applied_at!;
  const result: UndoResult = { products: 0, offers: 0, observations: 0, checks: 0, photos: 0, storageObjects: 0 };
  const removable = await selectRemovable(batch.id, appliedAt);

  // 1. Penawaran buatan batch yang belum disentuh dan bukan milik produk terbit.
  for (const group of chunk(removable.removableOffers, 80)) {
    const deleted = await db()
      .from("offers")
      .delete()
      .in("id", group)
      .eq("created_by_batch_id", batch.id)
      .lte("updated_at", appliedAt)
      .select("id");
    if (deleted.error) return { error: "Penawaran gagal dihapus; undo dihentikan sebelum langkah lain." };
    result.offers += (deleted.data ?? []).length;
  }
  result.observations += removable.cascadedObservations;
  result.checks += removable.cascadedChecks;

  // 2. Harga dan pemeriksaan yang ditambahkan batch ini pada penawaran lain.
  const priceTables = [
    { table: "price_observations", ids: removable.observations, key: "observations" },
    { table: "price_checks", ids: removable.checks, key: "checks" },
  ] as const;
  for (const { table, ids, key } of priceTables) {
    for (const group of chunk(ids, 80)) {
      const deleted = await db().from(table).delete().in("id", group).eq("batch_id", batch.id).select("id");
      if (deleted.error) return { error: "Catatan harga gagal dihapus." };
      result[key] += (deleted.data ?? []).length;
    }
  }

  // 3. Produk buatan batch yang masih draft dan belum disentuh.
  const deletedIds = new Set<string>();
  if (batch.kind === "specs") {
    const candidates = await selectWhereIn("products", "id", "created_by_batch_id", [batch.id]);
    const candidateIds = candidates.map((row) => String(row.id));
    const assets = await selectWhereIn("product_assets", "product_id, storage_key", "product_id", candidateIds);
    for (const group of chunk(candidateIds, 80)) {
      const deleted = await db()
        .from("products")
        .delete()
        .in("id", group)
        .eq("created_by_batch_id", batch.id)
        .eq("status", "draft")
        .lte("updated_at", appliedAt)
        .select("id");
      if (deleted.error) return { error: "Produk gagal dihapus." };
      for (const row of (deleted.data ?? []) as { id: string }[]) deletedIds.add(row.id);
    }
    result.products = deletedIds.size;

    // Baris database sudah hilang; objek foto dihapus sesudahnya. Bila gagal,
    // yang tersisa hanya file yatim, bukan referensi ke file yang hilang.
    const bucket = getInsforgeAdminClient().storage.from(PRODUCT_IMAGE_BUCKET);
    for (const asset of assets) {
      if (!deletedIds.has(String(asset.product_id)) || !asset.storage_key) continue;
      const removed = await bucket.remove(String(asset.storage_key));
      if (removed.error) console.error("[undo] objek foto gagal dihapus:", asset.storage_key, removed.error);
      else result.storageObjects += 1;
    }
  }

  // 4. Foto buatan batch pada produk draft yang tetap ada (mis. galeri dari
  //    listing toko pada produk lama). Produk terbit tidak disentuh.
  const photos = await batchPhotos(batch.id, deletedIds);
  const photoBucket = getInsforgeAdminClient().storage.from(PRODUCT_IMAGE_BUCKET);
  for (const group of chunk(photos.removable, 80)) {
    const deleted = await db()
      .from("product_assets")
      .delete()
      .in("id", group.map((photo) => photo.id))
      .eq("created_by_batch_id", batch.id)
      .select("id, storage_key");
    if (deleted.error) return { error: "Foto buatan batch gagal dihapus." };
    for (const row of (deleted.data ?? []) as { id: string; storage_key: string | null }[]) {
      result.photos += 1;
      if (!row.storage_key) continue;
      const removed = await photoBucket.remove(row.storage_key);
      if (removed.error) console.error("[undo] objek foto gagal dihapus:", row.storage_key, removed.error);
      else result.storageObjects += 1;
    }
  }

  const { data: claimed } = await db()
    .from("import_batches")
    .update({
      status: "reverted",
      report: { ...(batch.report ?? {}), undo: { ...result, by: admin.email, at: new Date().toISOString() } },
    })
    .eq("id", batch.id)
    .in("status", ["applied", "partial"])
    .select("id");
  if ((claimed ?? []).length === 0) return { error: "Batch ini sudah dibatalkan oleh permintaan lain." };
  await recordAudit(admin, "impor.undo", "import_batch", batch.id, { ...result });
  return result;
}

export async function executeUndo(batchId: string, admin: AdminSession): Promise<
  { ok: true; result: UndoResult; followUp: UndoResult | null } | { ok: false; error: string }
> {
  const batch = await loadBatch(batchId);
  if (!batch) return { ok: false, error: "Batch tidak ditemukan." };
  const allowed = canUndo(batch.status, batch.applied_at);
  if (!allowed.ok) return { ok: false, error: allowed.reason };

  // Batch harga lanjutan dibatalkan lebih dulu: penawarannya menempel ke produk induk.
  let followUp: UndoResult | null = null;
  const followUpBatch = batch.report?.followUpBatchId ? await loadBatch(batch.report.followUpBatchId) : null;
  // Harga resmi yang masih diterapkan akan menulis ke produk yang sedang
  // dihapus; tunggu sampai selesai supaya tidak tersisa antrean yatim.
  if (followUpBatch && (followUpBatch.status === "queued" || followUpBatch.status === "applying")) {
    return { ok: false, error: "Harga resmi batch ini masih diterapkan. Tunggu sampai selesai, lalu urungkan." };
  }
  // Foto yang sedang diunggah akan muncul setelah undo bila tidak ditunggu.
  const batchIds = [batch.id, ...(followUpBatch ? [followUpBatch.id] : [])];
  if ((await activePhotoJobs(batchIds)) > 0) {
    return { ok: false, error: "Foto batch ini sedang diproses. Tunggu sekitar satu menit, lalu urungkan." };
  }
  await cancelBatchPhotoJobs(batchIds);
  if (followUpBatch && canUndo(followUpBatch.status, followUpBatch.applied_at).ok) {
    const child = await undoOne(followUpBatch, admin);
    if ("error" in child) return { ok: false, error: `Batch harga resmi: ${child.error}` };
    followUp = child;
  }

  const result = await undoOne(batch, admin);
  if ("error" in result) return { ok: false, error: result.error };

  invalidateCatalogCache();
  for (const path of ["/admin", "/admin/products", "/admin/import", `/admin/import/batch/${batchId}`, "/products", "/"]) {
    revalidatePath(path);
  }
  return { ok: true, result, followUp };
}
