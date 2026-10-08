import "server-only";

import { selectAll, selectWhereIn } from "@/lib/backend/paged-read";
import type { ProductSpecs } from "@/lib/catalog/schema";
import type { CsvRow } from "@/lib/import/csv-parser";
import type { ImageRights } from "@/lib/import/image-rights";
import {
  loadOfferContext,
  prepareOfferRows,
  type PreparedItem,
} from "@/lib/import/offer-runner";
import { prepareSpecRows } from "@/lib/import/spec-runner";

/**
 * Perencana pratinjau impor: menjalankan tahap persiapan yang SAMA dengan
 * penulisan (prepareSpecRows / prepareOfferRows), lalu membandingkan hasilnya
 * dengan data yang ada, TANPA menulis apa pun. Karena tahapnya sama, apa yang
 * tampil di tabel pratinjau adalah apa yang nanti ditulis.
 */

export type PlanAction = "create" | "update" | "unchanged" | "skip";

export type PlanChange = { field: string; before: string | null; after: string | null };

export type PlanItem = {
  entity: "product" | "offer";
  action: PlanAction;
  label: string;
  reason: string | null;
  /** Baris mentah yang membentuk item ini; dipakai ulang saat diterapkan. */
  rowIndexes: number[];
  view: Record<string, string | number | boolean | null | string[]>;
  changes: PlanChange[];
};

export type ImportPlan = {
  items: PlanItem[];
  counts: Record<PlanAction, number>;
};

function finalize(items: PlanItem[]): ImportPlan {
  const sorted = [...items].sort(
    (a, b) => (a.rowIndexes[0] ?? Number.MAX_SAFE_INTEGER) - (b.rowIndexes[0] ?? Number.MAX_SAFE_INTEGER)
  );
  const counts: ImportPlan["counts"] = { create: 0, update: 0, unchanged: 0, skip: 0 };
  for (const item of sorted) counts[item.action] += 1;
  return { items: sorted, counts };
}

/* ------------------------------------------------------------ spesifikasi */

const SPEC_LABELS: Record<keyof ProductSpecs, string> = {
  displayInches: "Layar (inci)",
  displayTechnology: "Panel layar",
  refreshRateHz: "Refresh rate (Hz)",
  chipset: "Chipset",
  batteryMah: "Baterai (mAh)",
  chargingWatt: "Pengisian (W)",
  mainCameraMp: "Kamera utama (MP)",
  cameraLensCount: "Jumlah lensa",
  cameraHasUltrawide: "Ultrawide",
  cameraHasTelephoto: "Telefoto",
  cameraOpticalZoomX: "Zoom optik",
  weightGrams: "Bobot (g)",
  releaseYear: "Tahun rilis",
  is5G: "5G",
  hasNfc: "NFC",
  ipRating: "IP rating",
  has35mmJack: "Jack 3.5mm",
  osVersion: "Sistem operasi",
  colorOptions: "Pilihan warna",
};

function display(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  return String(value);
}

const variantLabel = (ramGb: number, storageGb: number) => `${ramGb}/${storageGb} GB`;

export async function planSpecImport(
  rows: readonly CsvRow[],
  defaultImageRights: ImageRights | null
): Promise<ImportPlan> {
  const prepared = prepareSpecRows(rows);
  const valid = [...prepared.validByKey.values()];
  const items: PlanItem[] = prepared.skipped.map((skip) => ({
    entity: "product",
    action: "skip",
    label: skip.label,
    reason: skip.reason,
    rowIndexes: [skip.rowIndex],
    view: {},
    changes: [],
  }));

  const [existing, slugOwners, exclusions] = await Promise.all([
    selectWhereIn(
      "products",
      "id, source_key, slug, brand, model, specs, status",
      "source_key",
      valid.map((entry) => entry.candidate.sourceKey)
    ),
    selectWhereIn("products", "id, slug, source_key", "slug", valid.map((entry) => entry.candidate.slug)),
    selectWhereIn("catalog_exclusions", "source_key, reason", "source_key", valid.map((entry) => entry.candidate.sourceKey), {
      uniqueKey: ["source_key"],
    }),
  ]);
  const excludedReason = new Map(exclusions.map((row) => [String(row.source_key), String(row.reason)]));
  const existingByKey = new Map(existing.map((row) => [String(row.source_key), row]));
  const existingIds = existing.map((row) => String(row.id));
  const [variants, photos] = await Promise.all([
    selectWhereIn("variants", "id, product_id, ram_gb, storage_gb", "product_id", existingIds),
    selectWhereIn("product_assets", "id, product_id, kind, original_url", "product_id", existingIds),
  ]);

  for (const { candidate, specs, rowIndex } of valid) {
    const photoRights = candidate.image?.rights ?? defaultImageRights;
    const photo = candidate.image
      ? photoRights
        ? "Diantrekan: diunduh dan dibersihkan latarnya setelah diterapkan"
        : "Dilewati: dasar hak pakai foto belum dipilih"
      : (candidate.imageIssue ?? "Tanpa foto di sumber");
    const view = {
      // Kunci sumber dipakai halaman batch untuk menampilkan harga resmi
      // hasil tarik otomatis di baris produk yang sama.
      sourceKey: candidate.sourceKey,
      brand: candidate.brand,
      model: candidate.model,
      variants: candidate.variants.map((v) => variantLabel(v.ramGb, v.storageGb)),
      chipset: specs.chipset,
      releaseYear: specs.releaseYear,
      photo,
      source: candidate.specsSourceUrl,
    };
    const label = `${candidate.brand} ${candidate.model}`;
    const current = existingByKey.get(candidate.sourceKey);

    // Model yang sengaja dibuang dari katalog tidak boleh kembali lewat impor.
    const excluded = excludedReason.get(candidate.sourceKey);
    if (excluded) {
      items.push({
        entity: "product",
        action: "skip",
        label,
        reason: `Dikecualikan dari katalog: ${excluded}`,
        rowIndexes: [rowIndex],
        view,
        changes: [],
      });
      continue;
    }

    if (!current) {
      const owner = slugOwners.find((row) => row.slug === candidate.slug);
      if (owner) {
        items.push({
          entity: "product",
          action: "skip",
          label,
          reason: `Slug "${candidate.slug}" sudah dipakai produk lain dengan kunci sumber berbeda.`,
          rowIndexes: [rowIndex],
          view: { ...view, slug: candidate.slug },
          changes: [],
        });
        continue;
      }
      items.push({
        entity: "product",
        action: "create",
        label,
        reason: null,
        rowIndexes: [rowIndex],
        view: { ...view, slug: candidate.slug, status: "draft" },
        changes: [],
      });
      continue;
    }

    const changes: PlanChange[] = [];
    if (current.brand !== candidate.brand) {
      changes.push({ field: "Merek", before: String(current.brand), after: candidate.brand });
    }
    if (current.model !== candidate.model) {
      changes.push({ field: "Model", before: String(current.model), after: candidate.model });
    }
    const oldSpecs = (current.specs ?? {}) as Partial<ProductSpecs>;
    for (const key of Object.keys(SPEC_LABELS) as (keyof ProductSpecs)[]) {
      const before = display(oldSpecs[key]);
      const after = display(specs[key]);
      if (before !== after) changes.push({ field: SPEC_LABELS[key], before, after });
    }
    const productId = String(current.id);
    const known = new Set(
      variants
        .filter((row) => row.product_id === productId)
        .map((row) => variantLabel(Number(row.ram_gb), Number(row.storage_gb)))
    );
    const added = view.variants.filter((label) => !known.has(label));
    if (added.length > 0) {
      changes.push({ field: "Varian baru", before: null, after: added.join(", ") });
    }
    if (candidate.image && photoRights) {
      const productPhotos = photos.filter((row) => row.product_id === productId && row.kind === "photo");
      if (!productPhotos.some((row) => row.original_url === candidate.image!.imageUrl)) {
        changes.push({
          field: "Foto utama",
          before: productPhotos.length > 0 ? "Foto lama" : null,
          after: "Foto dari sumber",
        });
      }
    }

    items.push({
      entity: "product",
      action: changes.length > 0 ? "update" : "unchanged",
      label,
      reason: null,
      rowIndexes: [rowIndex],
      view: { ...view, slug: String(current.slug), status: String(current.status) },
      changes,
    });
  }

  return finalize(items);
}

/* -------------------------------------------------------------- penawaran */

const LISTING_STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  "out-of-stock": "Stok habis",
  ambiguous: "Ambigu",
  inactive: "Tidak aktif",
};

const rupiah = (value: number | null) =>
  value === null ? null : `Rp${value.toLocaleString("id-ID")}`;

export async function planOfferImport(
  rows: readonly CsvRow[],
  {
    defaultObservedAt,
    defaultSellerName,
    imageRights,
  }: { defaultObservedAt: string; defaultSellerName: string; imageRights: ImageRights | null }
): Promise<ImportPlan> {
  const context = await loadOfferContext();
  if (!context) throw new Error("Katalog produk atau varian gagal dibaca untuk pencocokan harga.");
  const prepared = prepareOfferRows(rows, context, {
    defaultObservedAt,
    defaultSellerName,
    uploadedAt: new Date(),
  });

  const items: PlanItem[] = prepared.skipped.map((skip) => ({
    entity: "offer",
    action: "skip",
    label: skip.label,
    reason: skip.reason,
    rowIndexes: skip.rowIndex === undefined ? [] : [skip.rowIndex],
    view: {},
    changes: [],
  }));

  // Baris ganda untuk penawaran yang sama: yang terakhir di berkas menang.
  const latest = new Map<string, PreparedItem>();
  for (const item of prepared.items) {
    const earlier = latest.get(item.offerKey);
    if (earlier) {
      items.push({
        entity: "offer",
        action: "skip",
        label: earlier.label,
        reason: "Baris ganda untuk penawaran yang sama; yang dipakai baris terakhir di berkas.",
        rowIndexes: [earlier.rowIndex],
        view: {},
        changes: [],
      });
    }
    latest.set(item.offerKey, item);
  }

  const mergedRows = new Map<string, number[]>();
  for (const { item, intoOfferKey } of prepared.merged) {
    mergedRows.set(intoOfferKey, [...(mergedRows.get(intoOfferKey) ?? []), item.rowIndex]);
    const keeper = latest.get(intoOfferKey);
    items.push({
      entity: "offer",
      action: "skip",
      label: item.label,
      reason: `Warna lain dari varian yang sama; digabung ke listing ${keeper?.url ?? "termurah"} (harga termurah dipakai).`,
      rowIndexes: [],
      view: { url: item.url, price: rupiah(item.priceIdr) },
      changes: [],
    });
  }

  const offerItems = [...latest.values()];
  const [existingOffers, stores] = await Promise.all([
    selectWhereIn(
      "offers",
      "id, variant_id, url, marketplace, seller_name, warranty, listing_status, seller_verified, store_id",
      "variant_id",
      offerItems.map((item) => item.variantId)
    ),
    selectAll("stores", "id, name"),
  ]);
  const storeName = new Map(stores.map((row) => [String(row.id), String(row.name)]));
  const existingByKey = new Map(existingOffers.map((row) => [`${row.variant_id}|${row.url}`, row]));
  const observations = await selectWhereIn(
    "price_observations",
    "offer_id, price_idr, observed_at",
    "offer_id",
    existingOffers.map((row) => String(row.id)),
    { order: [{ column: "observed_at", ascending: false }] }
  );
  const latestObservation = new Map<string, { price: number; observedAt: string }>();
  for (const row of observations) {
    const offerId = String(row.offer_id);
    if (!latestObservation.has(offerId)) {
      latestObservation.set(offerId, { price: Number(row.price_idr), observedAt: String(row.observed_at) });
    }
  }

  const productByVariant = new Map<string, { name: string; variant: string }>();
  for (const product of context.catalogProducts) {
    for (const variant of product.variants) {
      productByVariant.set(variant.id, {
        name: `${product.brand} ${product.model}`,
        variant: variantLabel(variant.ramGb, variant.storageGb),
      });
    }
  }

  for (const item of offerItems) {
    const product = productByVariant.get(item.variantId);
    const rowIndexes = [item.rowIndex, ...(mergedRows.get(item.offerKey) ?? [])];
    const photos = prepared.listingImages.filter((image) => rowIndexes.includes(image.rowIndex)).length;
    const view = {
      product: product?.name ?? item.label,
      variant: product?.variant ?? null,
      marketplace: item.payload.marketplace,
      seller: item.payload.seller_name,
      store: item.payload.store_id ? (storeName.get(item.payload.store_id) ?? null) : null,
      price: rupiah(item.priceIdr),
      observedAt: item.observedAt,
      status: LISTING_STATUS_LABEL[item.payload.listing_status] ?? item.payload.listing_status,
      url: item.url,
      photos: photos === 0 ? null : imageRights ? `${photos} foto` : `${photos} foto dilewati (hak pakai)`,
    };
    const label = product ? `${product.name} ${product.variant}` : item.label;

    // Penawaran Erafone lama untuk varian yang sama dipindah ke URL warna baru
    // (lihat runOfferImport); di pratinjau diperlakukan sebagai perubahan URL.
    let current = existingByKey.get(item.offerKey);
    let movedFrom: string | null = null;
    if (!current && item.format === "erafone-scrape") {
      current = existingOffers.find(
        (row) =>
          row.variant_id === item.variantId &&
          row.marketplace === "Erafone" &&
          row.seller_name === "Erafone" &&
          !latest.has(`${item.variantId}|${row.url}`)
      );
      movedFrom = current ? String(current.url) : null;
    }

    if (!current) {
      items.push({ entity: "offer", action: "create", label, reason: null, rowIndexes, view, changes: [] });
      continue;
    }

    const changes: PlanChange[] = [];
    if (movedFrom) changes.push({ field: "URL listing", before: movedFrom, after: item.url });
    const compare = (field: string, before: unknown, after: unknown) => {
      const a = display(before);
      const b = display(after);
      if (a !== b) changes.push({ field, before: a, after: b });
    };
    compare("Marketplace", current.marketplace, item.payload.marketplace);
    compare("Penjual", current.seller_name, item.payload.seller_name);
    compare("Garansi", current.warranty, item.payload.warranty);
    compare(
      "Status listing",
      LISTING_STATUS_LABEL[String(current.listing_status)] ?? current.listing_status,
      view.status
    );
    compare("Penjual terverifikasi", current.seller_verified, item.payload.seller_verified);
    compare(
      "Toko",
      current.store_id ? storeName.get(String(current.store_id)) : null,
      view.store
    );

    const observed = latestObservation.get(String(current.id));
    if (item.priceIdr !== null && item.observedAt) {
      if (!observed || observed.price !== item.priceIdr) {
        changes.push({ field: "Harga", before: rupiah(observed?.price ?? null), after: rupiah(item.priceIdr) });
      } else if (new Date(item.observedAt).getTime() > new Date(observed.observedAt).getTime()) {
        // Harga sama, tetapi pemeriksaan baru membuat harganya kembali segar.
        changes.push({ field: "Waktu pemeriksaan", before: observed.observedAt, after: item.observedAt });
      }
    }

    items.push({
      entity: "offer",
      action: changes.length > 0 ? "update" : "unchanged",
      label,
      reason: null,
      rowIndexes,
      view,
      changes,
    });
  }

  return finalize(items);
}
