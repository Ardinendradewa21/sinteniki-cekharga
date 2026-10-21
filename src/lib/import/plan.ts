import "server-only";

import { selectAll, selectWhereIn } from "@/lib/backend/paged-read";
import type { ProductSpecs } from "@/lib/catalog/schema";
import type { CsvRow } from "@/lib/import/csv-parser";
import { sameColors } from "@/lib/import/colors";
import type { ImageRights } from "@/lib/import/image-rights";
import {
  loadOfferContext,
  prepareOfferRows,
  type PreparedItem,
} from "@/lib/import/offer-runner";
import { findRelocatedOffer } from "@/lib/import/offer-relocation";
import { isNewVariantKey } from "@/lib/import/variant-rules";
import { placeholderSourceKey } from "@/lib/import/gsmarena";
import { applyKeepExisting, mergeSpecs, specsPatch } from "@/lib/import/patch-rules";
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
  entity: "product" | "offer" | "photo";
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
    // Produk yang dihapus lunak ikut dibaca: kunci sumber dan slug-nya tetap
    // terpakai, dan impor ulang memulihkannya (lihat spec-runner).
    selectWhereIn(
      "products",
      "id, source_key, slug, brand, model, specs, status, deleted_at",
      "source_key",
      valid.map((entry) => entry.candidate.sourceKey),
      { includeDeleted: true }
    ),
    selectWhereIn("products", "id, slug, source_key", "slug", valid.map((entry) => entry.candidate.slug), {
      includeDeleted: true,
    }),
    selectWhereIn("catalog_exclusions", "source_key, reason", "source_key", valid.map((entry) => entry.candidate.sourceKey), {
      uniqueKey: ["source_key"],
    }),
  ]);
  const excludedReason = new Map(exclusions.map((row) => [String(row.source_key), String(row.reason)]));
  const existingByKey = new Map(existing.map((row) => [String(row.source_key), row]));
  // Produk tanpa halaman GSMArena (kunci placeholder) diadopsi kandidat
  // GSMArena dengan slug sama; spec-runner melakukan hal yang sama saat menulis.
  const adoptable = valid.filter(
    (entry) => !existingByKey.has(entry.candidate.sourceKey) && entry.candidate.sourceKey !== placeholderSourceKey(entry.candidate.slug)
  );
  const placeholders = adoptable.length
    ? await selectWhereIn(
        "products",
        "id, source_key, slug, brand, model, specs, status, deleted_at",
        "source_key",
        adoptable.map((entry) => placeholderSourceKey(entry.candidate.slug)),
        { includeDeleted: true }
      )
    : [];
  const adoptedKeys = new Set<string>();
  for (const entry of adoptable) {
    const row = placeholders.find((p) => p.source_key === placeholderSourceKey(entry.candidate.slug));
    if (row) {
      existingByKey.set(entry.candidate.sourceKey, row);
      adoptedKeys.add(entry.candidate.sourceKey);
      existing.push(row);
    }
  }
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
    if (adoptedKeys.has(candidate.sourceKey)) {
      changes.push({ field: "Sumber spesifikasi", before: "Situs resmi (belum ada di GSMArena)", after: "GSMArena" });
    }
    if (current.deleted_at) {
      changes.push({ field: "Status data", before: "Terhapus", after: "Dipulihkan sebagai draft" });
    }
    if (current.brand !== candidate.brand) {
      changes.push({ field: "Merek", before: String(current.brand), after: candidate.brand });
    }
    if (current.model !== candidate.model) {
      changes.push({ field: "Model", before: String(current.model), after: candidate.model });
    }
    // Pratinjau memakai penggabungan yang sama dengan penulisan
    // (`specs || patch`): sel kosong tidak tampil sebagai "dihapus".
    const oldSpecs = (current.specs ?? {}) as Partial<ProductSpecs>;
    const newSpecs = mergeSpecs(oldSpecs, specsPatch(specs, candidate.clearedSpecs));
    for (const key of Object.keys(SPEC_LABELS) as (keyof ProductSpecs)[]) {
      const before = display(oldSpecs[key]);
      const after = display(newSpecs[key]);
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

  // Baris ganda untuk penawaran yang sama (mis. satu baris per warna): data
  // baris terakhir di berkas yang dipakai. Baris sebelumnya ikut ke penawaran
  // pemenang supaya fotonya (foto tiap warna) tetap masuk galeri; penulis
  // penawaran menggabungkan baris ganda dengan aturan yang sama.
  const latest = new Map<string, PreparedItem>();
  const mergedRows = new Map<string, number[]>();
  // Catatan tinjau dari baris ganda: harga berbeda untuk listing yang sama
  // (mis. satu listing Shopee berisi model 4G dan 5G) tidak boleh tertimpa diam-diam.
  const duplicateNotes = new Map<string, string[]>();
  for (const item of prepared.items) {
    const earlier = latest.get(item.offerKey);
    if (earlier) {
      const notes = duplicateNotes.get(item.offerKey) ?? [];
      if (earlier.reviewNote) notes.push(earlier.reviewNote);
      if (earlier.priceIdr !== null && item.priceIdr !== null && earlier.priceIdr !== item.priceIdr) {
        notes.push(
          `Baris lain untuk listing dan varian yang sama memberi harga berbeda (${rupiah(earlier.priceIdr)}); yang dipakai ${rupiah(item.priceIdr)}. Periksa apakah listing ini memuat model lain.`
        );
      }
      duplicateNotes.set(item.offerKey, notes);
      // Tidak dibuat kartu "Dilewati" tersendiri: baris per warna untuk listing
      // yang sama memang satu penawaran. Jumlahnya ditampilkan di penawaran itu.
      mergedRows.set(item.offerKey, [...(mergedRows.get(item.offerKey) ?? []), earlier.rowIndex]);
    }
    latest.set(item.offerKey, item);
  }

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
    // Penawaran yang dihapus lunak ikut dibaca: impor memulihkannya.
    selectWhereIn(
      "offers",
      "id, variant_id, url, marketplace, seller_name, warranty, listing_status, seller_verified, store_id, colors, deleted_at",
      "variant_id",
      // Varian yang baru diusulkan belum punya ID, jadi belum punya penawaran.
      offerItems.map((item) => item.variantId).filter((id) => !isNewVariantKey(id)),
      { includeDeleted: true }
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

  const productNameById = new Map(context.catalogProducts.map((product) => [product.id, `${product.brand} ${product.model}`]));
  for (const item of offerItems) {
    if (item.newVariant) {
      productByVariant.set(item.variantId, {
        name: productNameById.get(item.newVariant.productId) ?? item.label,
        variant: variantLabel(item.newVariant.ramGb, item.newVariant.storageGb),
      });
    }
  }

  for (const item of offerItems) {
    const product = productByVariant.get(item.variantId);
    const rowIndexes = [item.rowIndex, ...(mergedRows.get(item.offerKey) ?? [])];
    const images = [
      ...new Map(
        prepared.listingImages.filter((image) => rowIndexes.includes(image.rowIndex)).map((image) => [image.url, image])
      ).values(),
    ];
    const usable = images.filter((image) => image.rights ?? imageRights).length;
    const imageIssue = prepared.imageIssues.find((issue) => rowIndexes.includes(issue.rowIndex));
    const photos = [
      usable > 0 ? `${usable} foto` : null,
      images.length > usable ? `${images.length - usable} foto dilewati (hak pakai)` : null,
      imageIssue ? `foto dilewati: ${imageIssue.reason}` : null,
    ].filter(Boolean).join("; ");
    const reviewNotes = [...new Set([item.reviewNote, ...(duplicateNotes.get(item.offerKey) ?? [])].filter((note): note is string => Boolean(note)))];
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
      photos: photos || null,
      colors: item.colors.length > 0 ? item.colors.join(", ") : null,
      merged: rowIndexes.length > 1 ? `${rowIndexes.length} baris digabung (satu listing)` : null,
      // Judul toko tanpa memori: varian dasar disimpulkan importer, jadi ditandai "Perlu tinjau".
      inferredVariant: item.inferred ? true : null,
      // Nama cocok tetapi ada model saudara 4G/5G, atau baris ganda berbeda harga: "Perlu tinjau".
      productReview: reviewNotes.length > 0 ? true : null,
    };
    const label = product ? `${product.name} ${product.variant}` : item.label;

    // Penawaran Erafone atau penjual resmi yang URL-nya berganti dipindah ke
    // URL baru (findRelocatedOffer); di pratinjau tampil sebagai perubahan URL.
    let current = existingByKey.get(item.offerKey);
    let movedFrom: string | null = null;
    if (!current) {
      current = findRelocatedOffer(item, existingOffers, latest);
      movedFrom = current ? String(current.url) : null;
    }

    const inferredNote =
      [
        item.inferred
          ? "Judul listing tidak menyebut RAM/penyimpanan; varian dasar disimpulkan. Periksa listingnya sebelum menerapkan."
          : null,
        ...reviewNotes,
      ]
        .filter(Boolean)
        .join(" ") || null;
    if (!current) {
      const variantChange = item.newVariant
        ? [{ field: "Varian baru", before: null, after: variantLabel(item.newVariant.ramGb, item.newVariant.storageGb) }]
        : [];
      items.push({ entity: "offer", action: "create", label, reason: inferredNote, rowIndexes, view, changes: variantChange });
      continue;
    }

    const changes: PlanChange[] = [];
    if (current.deleted_at) changes.push({ field: "Status data", before: "Terhapus", after: "Dipulihkan" });
    if (movedFrom) changes.push({ field: "URL listing", before: movedFrom, after: item.url });
    // Sel kosong mempertahankan suntingan admin, sama seperti saat ditulis.
    const payload = applyKeepExisting(item.payload, current, item.keepExisting);
    const compare = (field: string, before: unknown, after: unknown) => {
      const a = display(before);
      const b = display(after);
      if (a !== b) changes.push({ field, before: a, after: b });
    };
    compare("Marketplace", current.marketplace, payload.marketplace);
    compare("Penjual", current.seller_name, payload.seller_name);
    compare("Garansi", current.warranty, payload.warranty);
    compare(
      "Status listing",
      LISTING_STATUS_LABEL[String(current.listing_status)] ?? current.listing_status,
      LISTING_STATUS_LABEL[String(payload.listing_status)] ?? payload.listing_status
    );
    compare("Penjual terverifikasi", current.seller_verified, payload.seller_verified);
    compare(
      "Toko",
      current.store_id ? storeName.get(String(current.store_id)) : null,
      view.store
    );
    // Warna kosong di berkas tidak mengubah warna yang tercatat.
    const currentColors = (current.colors as string[] | null) ?? [];
    if (item.colors.length > 0 && !sameColors(item.colors, currentColors)) {
      changes.push({ field: "Warna", before: currentColors.join(", ") || null, after: item.colors.join(", ") });
    }

    const observed = latestObservation.get(String(current.id));
    // Harga yang lebih tua dari harga terakhir hanya masuk riwayat: katalog
    // selalu menampilkan pengamatan terbaru, jadi harga tampil tidak berubah.
    const stale =
      item.priceIdr !== null &&
      item.observedAt !== null &&
      observed !== undefined &&
      new Date(item.observedAt).getTime() < new Date(observed.observedAt).getTime();
    if (stale && item.priceIdr !== null && item.observedAt) {
      changes.push({ field: "Riwayat harga", before: null, after: `${rupiah(item.priceIdr)} (${item.observedAt})` });
    } else if (item.priceIdr !== null && item.observedAt) {
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
      reason: stale
        ? `Harga ini lebih lama dari harga terakhir (${rupiah(observed!.price)}, ${observed!.observedAt}); disimpan sebagai riwayat dan tidak mengganti harga yang tampil.`
        : inferredNote,
      rowIndexes,
      view: stale ? { ...view, priceStale: true } : view,
      changes,
    });
  }

  return finalize(items);
}
