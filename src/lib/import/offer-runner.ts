import "server-only";

import { revalidatePath } from "next/cache";

import type { AdminSession } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { recordAudit } from "@/lib/admin/audit";
import type { CsvRow } from "@/lib/import/csv-parser";
import {
  chunk,
  INSERT_CHUNK,
  mapWithConcurrency,
  selectAll,
  selectWhereIn,
  timeKey,
} from "@/lib/import/batch";
import type { ImageRights } from "@/lib/import/image-rights";
import {
  prepareOfferRow,
  type OfferCatalogProduct,
  type OfferSourceFormat,
} from "@/lib/import/offers";
import { importGalleryImage } from "@/lib/import/product-images";
import type { OfferImportReport } from "@/lib/import/report";
import { loadSlugRedirects, loadStoreResolver, type StoreResolver } from "@/lib/import/stores";

/**
 * Impor penawaran dan harga (PRD §3 dan §7), terpisah dari server action.
 *
 * Modul biasa, bukan "use server": fungsi di sini TIDAK boleh bisa dipanggil
 * langsung dari browser. Pemanggilnya wajib sudah menjalankan requireAdmin().
 *
 * Empat aturan yang dipegang, semuanya sama dengan jalur form manual:
 *
 * 1. Tidak pernah membuat produk atau varian. Slug atau kombinasi
 *    RAM/penyimpanan yang tidak dikenal dilewati beserta alasannya, sebab satu
 *    salah ketik tidak boleh berubah menjadi varian karangan (PRD §6).
 *
 * 2. Penawaran dikenali dari pasangan varian dan URL listing. Mengimpor berkas
 *    yang sama dua kali memperbarui penawaran yang ada, bukan menumpuk
 *    duplikat.
 *
 * 3. Mencatat harga menulis DUA baris: observasi harganya, dan pemeriksaan
 *    berstatus berhasil. Tanpa yang kedua, harga baru akan tampil dengan waktu
 *    pemeriksaan lama (PRD §7 butir 6).
 *
 * 4. Baris yang gagal tidak menjatuhkan baris yang berhasil.
 */

/** Pembaruan baris yang sudah ada berjalan paralel, dibatasi supaya sopan ke backend. */
const UPDATE_CONCURRENCY = 6;
const IMAGE_IMPORT_CONCURRENCY = 4;

export type OfferPayload = {
  marketplace: string;
  seller_name: string;
  warranty: string | null;
  listing_status: string;
  seller_verified: boolean;
  store_id: string | null;
  /** Hanya diisi saat penawaran Erafone lama pindah ke URL warna lain. */
  url?: string;
};

export type PreparedItem = {
  /** Posisi baris di berkas (0-based), untuk batch pratinjau. */
  rowIndex: number;
  label: string;
  offerKey: string;
  variantId: string;
  url: string;
  payload: OfferPayload;
  priceIdr: number | null;
  observedAt: string | null;
  origin: "manual" | "automatic";
  inferred: boolean;
  format: OfferSourceFormat;
};

export type ListingImage = {
  productId: string;
  url: string;
  sourceUrl: string;
  marketplace: string;
  rowIndex: number;
};

export type OfferContext = {
  catalogProducts: OfferCatalogProduct[];
  bySlug: Map<string, string>;
  byVariantKey: Map<string, string>;
  storeFor: StoreResolver;
};

/** Katalog untuk pencocokan, dibaca LENGKAP sekali di depan. null bila gagal dibaca. */
export async function loadOfferContext(): Promise<OfferContext | null> {
  let products: { id: string; slug: string; brand: string; model: string; is5G: unknown }[];
  let variants: { id: string; product_id: string; ram_gb: number; storage_gb: number }[];
  let storeFor: StoreResolver;
  let slugRedirects: Map<string, string>;
  try {
    const [productRows, variantRows, resolver, redirects] = await Promise.all([
      selectAll("products", "id, slug, brand, model, is5G:specs->is5G"),
      selectAll("variants", "id, product_id, ram_gb, storage_gb"),
      loadStoreResolver(),
      loadSlugRedirects(),
    ]);
    products = productRows as typeof products;
    variants = variantRows as typeof variants;
    storeFor = resolver;
    slugRedirects = redirects;
  } catch {
    return null;
  }
  const bySlug = new Map(products.map((p) => [p.slug, p.id]));
  // Berkas lama yang masih memakai slug sebelum diganti tetap cocok, kecuali
  // slug itu kini dipakai produk lain (produk aktif selalu didahulukan).
  for (const [oldSlug, productId] of slugRedirects) {
    if (!bySlug.has(oldSlug)) bySlug.set(oldSlug, productId);
  }
  const byVariantKey = new Map(
    variants.map((v) => [`${v.product_id}|${v.ram_gb}|${v.storage_gb}`, v.id])
  );
  const variantsByProduct = new Map<string, OfferCatalogProduct["variants"]>();
  for (const variant of variants) {
    const list = variantsByProduct.get(variant.product_id) ?? [];
    list.push({ id: variant.id, ramGb: variant.ram_gb, storageGb: variant.storage_gb });
    variantsByProduct.set(variant.product_id, list);
  }
  const catalogProducts: OfferCatalogProduct[] = products.map((product) => ({
    id: product.id,
    slug: product.slug,
    brand: product.brand,
    model: product.model,
    is5G: typeof product.is5G === "boolean" ? product.is5G : null,
    variants: variantsByProduct.get(product.id) ?? [],
  }));


  return { catalogProducts, bySlug, byVariantKey, storeFor };
}

export type OfferPreparation = {
  items: PreparedItem[];
  skipped: { label: string; reason: string; rowIndex?: number }[];
  sourceFormats: Set<OfferSourceFormat>;
  preprocessedRows: number;
  mergedListings: number;
  /** Listing warna lain yang digabung, beserta penawaran yang menampungnya. */
  merged: { item: PreparedItem; intoOfferKey: string }[];
  listingImages: ListingImage[];
};

/** Tahap tanpa tulis: validasi, cocokkan, dan gabungkan listing. Dipakai pratinjau dan penulisan. */
export function prepareOfferRows(
  rows: readonly CsvRow[],
  { catalogProducts, bySlug, byVariantKey, storeFor }: OfferContext,
  {
    defaultObservedAt,
    defaultSellerName,
    uploadedAt,
  }: { defaultObservedAt: string; defaultSellerName: string; uploadedAt: Date }
): OfferPreparation {
  const skipped: OfferPreparation["skipped"] = [];
  const sourceFormats = new Set<OfferSourceFormat>();
  let preprocessedRows = 0;
  let mergedListings = 0;
  const listingImages: ListingImage[] = [];

  // Tahap 1, tanpa jaringan: validasi dan cocokkan seluruh baris.
  const items: PreparedItem[] = [];
  for (const [rowIndex, raw] of rows.entries()) {
    const outcome = prepareOfferRow(raw, catalogProducts, {
      observedAt: defaultObservedAt,
      sellerName: defaultSellerName,
    });
    sourceFormats.add(outcome.format);
    if (outcome.format !== "template") preprocessedRows += 1;
    if (!outcome.ok) {
      skipped.push({ label: outcome.label, reason: outcome.reason, rowIndex });
      continue;
    }
    const row = outcome.row;
    const label = `${row.slug} ${row.ramGb}/${row.storageGb}`;
    if (outcome.image) {
      listingImages.push({ ...outcome.image, sourceUrl: row.url, marketplace: row.marketplace, rowIndex });
    }
    if (
      row.observedAt &&
      new Date(row.observedAt).getTime() > uploadedAt.getTime() + 5 * 60_000
    ) {
      skipped.push({ label, reason: "Waktu pengamatan harga berada di masa depan.", rowIndex });
      continue;
    }

    const productId = bySlug.get(row.slug);
    if (!productId) {
      skipped.push({ label, reason: `Produk dengan slug "${row.slug}" tidak ada di katalog.`, rowIndex });
      continue;
    }

    const variantId = byVariantKey.get(`${productId}|${row.ramGb}|${row.storageGb}`);
    if (!variantId) {
      skipped.push({
        label,
        reason: `Varian ${row.ramGb}/${row.storageGb} GB tidak tercatat untuk produk ini, dan varian tidak boleh dikarang.`,
        rowIndex,
      });
      continue;
    }

    items.push({
      rowIndex,
      label,
      // Penawaran dikenali dari varian + URL listing.
      offerKey: `${variantId}|${row.url}`,
      variantId,
      url: row.url,
      payload: {
        marketplace: row.marketplace,
        seller_name: row.sellerName,
        warranty: row.warranty,
        listing_status: row.listingStatus,
        seller_verified: row.sellerVerified,
        store_id: storeFor(row.url),
      },
      priceIdr: row.priceIdr,
      observedAt: row.observedAt,
      origin: outcome.origin,
      inferred: outcome.inferredBaseVariant,
      format: outcome.format,
    });
  }

  // Erafone memecah satu varian menjadi satu listing per warna. Satu toko untuk
  // satu varian cukup satu penawaran: yang dipakai harga termurah (warna lain
  // bisa sedang tidak diskon), sisanya dicatat sebagai listing digabung.
  const erafoneByVariant = new Map<string, PreparedItem[]>();
  for (const item of items) {
    if (item.format !== "erafone-scrape") continue;
    const list = erafoneByVariant.get(item.variantId) ?? [];
    list.push(item);
    erafoneByVariant.set(item.variantId, list);
  }
  const mergedAway = new Set<PreparedItem>();
  const mergedInto = new Map<PreparedItem, string>();
  for (const list of erafoneByVariant.values()) {
    const [keep, ...rest] = [...list].sort(
      (a, b) =>
        (a.priceIdr ?? Number.MAX_SAFE_INTEGER) - (b.priceIdr ?? Number.MAX_SAFE_INTEGER) ||
        a.url.localeCompare(b.url)
    );
    for (const item of rest) {
      if (item.url !== keep!.url) {
        mergedAway.add(item);
        mergedInto.set(item, keep!.offerKey);
      }
    }
  }
  if (mergedAway.size > 0) {
    mergedListings = mergedAway.size;
    items.splice(0, items.length, ...items.filter((item) => !mergedAway.has(item)));
  }


  return {
    items,
    skipped,
    sourceFormats,
    preprocessedRows,
    mergedListings,
    merged: [...mergedInto].map(([item, intoOfferKey]) => ({ item, intoOfferKey })),
    listingImages,
  };
}

export async function runOfferImport({
  rows,
  fileName,
  defaultObservedAt,
  defaultSellerName,
  imageRights,
  admin,
  malformedLines = [],
}: {
  rows: readonly CsvRow[];
  fileName: string;
  defaultObservedAt: string;
  defaultSellerName: string;
  imageRights: ImageRights | null;
  admin: AdminSession;
  malformedLines?: number[];
}): Promise<OfferImportReport> {
  const db = getInsforgeAdminClient().database;
  const uploadedAt = new Date();
  const context = await loadOfferContext();
  if (!context) {
    return { error: "Katalog produk atau varian gagal dibaca untuk pencocokan harga.", summary: null };
  }
  const { catalogProducts } = context;
  const prepared = prepareOfferRows(rows, context, { defaultObservedAt, defaultSellerName, uploadedAt });
  const { items, sourceFormats, preprocessedRows, mergedListings, listingImages } = prepared;
  const skipped: { label: string; reason: string }[] = prepared.skipped.map(({ label, reason }) => ({ label, reason }));
  let inferredBaseVariants = 0;
  let created = 0;
  let updated = 0;
  let pricesRecorded = 0;
  let duplicatePrices = 0;

  // Tahap 2: penawaran. Baris ganda untuk penawaran yang sama digabung; data
  // baris terakhir yang dipakai, sama seperti hasil akhir impor berurutan.
  const latestItemByOffer = new Map(items.map((item) => [item.offerKey, item]));

  let existingOffers: Awaited<ReturnType<typeof selectWhereIn>>;
  try {
    existingOffers = await selectWhereIn(
      "offers",
      "id, variant_id, url, marketplace, seller_name, warranty, listing_status, seller_verified, store_id",
      "variant_id",
      items.map((item) => item.variantId)
    );
  } catch {
    return {
      error: "Penawaran lama gagal diperiksa, jadi impor dibatalkan sebelum menulis apa pun.",
      summary: null,
    };
  }
  const existingByKey = new Map(
    existingOffers.map((row) => [`${row.variant_id}|${row.url}`, row])
  );

  // Warna termurah Erafone bisa berganti antar-impor. Penawaran lama untuk
  // varian yang sama dipindahkan ke URL baru, bukan diduplikasi, supaya riwayat
  // harga tetap satu dan halaman produk tidak menampilkan Erafone dua kali.
  for (const item of latestItemByOffer.values()) {
    if (item.format !== "erafone-scrape" || existingByKey.has(item.offerKey)) continue;
    const previous = existingOffers.find(
      (row) =>
        row.variant_id === item.variantId &&
        row.marketplace === "Erafone" &&
        row.seller_name === "Erafone"
    );
    if (!previous || latestItemByOffer.has(`${item.variantId}|${previous.url}`)) {
      continue;
    }
    existingByKey.set(item.offerKey, previous);
    item.payload = { ...item.payload, url: item.url };
  }
  const offerIdByKey = new Map<string, string>();
  const offerFailure = new Map<string, string>();

  const samePayload = (row: Record<string, unknown>, payload: OfferPayload) =>
    (Object.keys(payload) as (keyof OfferPayload)[]).every(
      (key) => (row[key] ?? null) === payload[key]
    );

  // Pembaruan hanya dikirim bila isinya memang berubah.
  await mapWithConcurrency(
    [...latestItemByOffer.values()].filter((item) => existingByKey.has(item.offerKey)),
    UPDATE_CONCURRENCY,
    async (item) => {
      const row = existingByKey.get(item.offerKey)!;
      const offerId = String(row.id);
      if (!samePayload(row, item.payload)) {
        const { error } = await db.from("offers").update(item.payload).eq("id", offerId);
        if (error) {
          offerFailure.set(item.offerKey, "Gagal memperbarui penawaran.");
          return;
        }
      }
      offerIdByKey.set(item.offerKey, offerId);
    }
  );

  const newOfferRow = (item: PreparedItem) => ({
    ...item.payload,
    variant_id: item.variantId,
    url: item.url,
    condition: "new",
  });

  const offersToInsert = [...latestItemByOffer.values()].filter(
    (item) => !existingByKey.has(item.offerKey)
  );
  // Upsert pada kunci unik (variant_id, url), bukan insert. Kalau impor lain
  // baru saja menyimpan penawaran yang sama, barisnya digabung alih-alih
  // menggagalkan seluruh kelompok dan memaksa jalur satu per satu.
  for (const group of chunk(offersToInsert, INSERT_CHUNK)) {
    const { data, error } = await db
      .from("offers")
      .upsert(group.map(newOfferRow), { onConflict: "variant_id,url" })
      .select("id, variant_id, url");
    if (!error) {
      for (const row of (data ?? []) as { id: string; variant_id: string; url: string }[]) {
        offerIdByKey.set(`${row.variant_id}|${row.url}`, row.id);
      }
      for (const item of group) {
        if (!offerIdByKey.has(item.offerKey)) {
          offerFailure.set(item.offerKey, "Penawaran tersimpan tetapi tidak bisa dibaca kembali.");
        }
      }
      continue;
    }

    // Satu baris yang melanggar aturan tabel menggagalkan seluruh kelompok;
    // ulangi satu per satu supaya baris yang sah tetap tersimpan.
    await mapWithConcurrency(group, UPDATE_CONCURRENCY, async (item) => {
      const single = await db
        .from("offers")
        .upsert([newOfferRow(item)], { onConflict: "variant_id,url" })
        .select("id");
      const savedRow = (single.data ?? [])[0] as { id: string } | undefined;
      if (!single.error && savedRow) {
        offerIdByKey.set(item.offerKey, savedRow.id);
        return;
      }
      offerFailure.set(item.offerKey, "Gagal menyimpan penawaran baru.");
    });
  }

  // Tahap 3: harga dan pemeriksaan berhasil. Keduanya wajib; tanpa yang kedua,
  // harga baru akan tampil dengan waktu pemeriksaan lama (PRD §7 butir 6).
  const observationKey = (offerId: string, observedAt: string) =>
    `${offerId}|${timeKey(observedAt)}`;
  const pricedItems = items.filter(
    (item) =>
      item.priceIdr !== null &&
      item.observedAt !== null &&
      offerIdByKey.has(item.offerKey)
  );
  const latestItemByObservation = new Map(
    pricedItems.map((item) => [
      observationKey(offerIdByKey.get(item.offerKey)!, item.observedAt!),
      item,
    ])
  );

  const observationFailure = new Map<string, string>();
  const unchangedObservations = new Set<string>();

  if (latestItemByObservation.size > 0) {
    const offerIds = [...new Set(pricedItems.map((item) => offerIdByKey.get(item.offerKey)!))];
    const times = pricedItems
      .map((item) => item.observedAt!)
      .sort((a, b) => timeKey(a) - timeKey(b));
    const window = { gte: times[0], lte: times[times.length - 1] };

    let existingObservations: Awaited<ReturnType<typeof selectWhereIn>> | null = null;
    let existingChecks: Awaited<ReturnType<typeof selectWhereIn>> | null = null;
    try {
      [existingObservations, existingChecks] = await Promise.all([
        selectWhereIn("price_observations", "id, offer_id, observed_at, price_idr", "offer_id", offerIds, {
          range: { column: "observed_at", ...window },
        }),
        selectWhereIn("price_checks", "id, offer_id, attempted_at, outcome", "offer_id", offerIds, {
          range: { column: "attempted_at", ...window },
        }),
      ]);
    } catch {
      for (const key of latestItemByObservation.keys()) {
        observationFailure.set(key, "Penawaran tersimpan tetapi riwayat harganya gagal diperiksa.");
      }
    }

    if (existingObservations && existingChecks) {
      const existingObservationByKey = new Map(
        existingObservations.map((row) => [
          observationKey(String(row.offer_id), String(row.observed_at)),
          row,
        ])
      );
      const successfulCheckKeys = new Set(
        existingChecks
          .filter((row) => row.outcome === "success")
          .map((row) => observationKey(String(row.offer_id), String(row.attempted_at)))
      );

      const observationRow = (key: string, item: PreparedItem) => ({
        offer_id: key.split("|")[0],
        price_idr: item.priceIdr,
        observed_at: item.observedAt,
        origin: item.origin,
      });

      const observationsToInsert: [string, PreparedItem][] = [];
      const observationsToUpdate: [string, PreparedItem, string][] = [];
      for (const [key, item] of latestItemByObservation) {
        const existing = existingObservationByKey.get(key);
        if (!existing) observationsToInsert.push([key, item]);
        else if (Number(existing.price_idr) === item.priceIdr) unchangedObservations.add(key);
        else observationsToUpdate.push([key, item, String(existing.id)]);
      }

      await mapWithConcurrency(observationsToUpdate, UPDATE_CONCURRENCY, async ([key, item, id]) => {
        const { error } = await db
          .from("price_observations")
          .update({ price_idr: item.priceIdr, origin: item.origin })
          .eq("id", id);
        if (error) {
          observationFailure.set(key, "Penawaran tersimpan tetapi harganya gagal dicatat.");
        }
      });

      for (const group of chunk(observationsToInsert, INSERT_CHUNK)) {
        const { error } = await db
          .from("price_observations")
          .upsert(group.map(([key, item]) => observationRow(key, item)), {
            onConflict: "offer_id,observed_at",
          });
        if (!error) continue;
        await mapWithConcurrency(group, UPDATE_CONCURRENCY, async ([key, item]) => {
          const single = await db
            .from("price_observations")
            .upsert([observationRow(key, item)], { onConflict: "offer_id,observed_at" });
          if (single.error) {
            observationFailure.set(key, "Penawaran tersimpan tetapi harganya gagal dicatat.");
          }
        });
      }

      const checkRow = (key: string, item: PreparedItem) => ({
        offer_id: key.split("|")[0],
        attempted_at: item.observedAt,
        outcome: "success",
        error_summary: null,
      });
      const checksToInsert = [...latestItemByObservation].filter(
        ([key]) => !observationFailure.has(key) && !successfulCheckKeys.has(key)
      );
      for (const group of chunk(checksToInsert, INSERT_CHUNK)) {
        const { error } = await db
          .from("price_checks")
          .upsert(group.map(([key, item]) => checkRow(key, item)), {
            onConflict: "offer_id,attempted_at,outcome",
            ignoreDuplicates: true,
          });
        if (!error) continue;
        await mapWithConcurrency(group, UPDATE_CONCURRENCY, async ([key, item]) => {
          const single = await db.from("price_checks").upsert([checkRow(key, item)], {
            onConflict: "offer_id,attempted_at,outcome",
            ignoreDuplicates: true,
          });
          if (single.error) {
            observationFailure.set(
              key,
              "Harga tersimpan tetapi pemeriksaan berhasil gagal dicatat."
            );
          }
        });
      }
    }
  }

  // Tahap 4: laporan per baris, dengan hitungan yang sama seperti impor
  // berurutan: kemunculan kedua penawaran yang sama dihitung "diperbarui", dan
  // harga yang sudah tercatat dengan angka sama dihitung "duplikat".
  const seenOffers = new Set<string>();
  const seenObservations = new Set<string>();
  for (const item of items) {
    const failure = offerFailure.get(item.offerKey);
    if (failure) {
      skipped.push({ label: item.label, reason: failure });
      continue;
    }
    if (existingByKey.has(item.offerKey) || seenOffers.has(item.offerKey)) updated += 1;
    else created += 1;
    seenOffers.add(item.offerKey);

    if (item.inferred) inferredBaseVariants += 1;

    if (item.priceIdr === null || item.observedAt === null) continue;
    const key = observationKey(offerIdByKey.get(item.offerKey)!, item.observedAt);
    const priceFailure = observationFailure.get(key);
    if (priceFailure) {
      skipped.push({ label: item.label, reason: priceFailure });
      continue;
    }
    const recordedPrice = latestItemByObservation.get(key)?.priceIdr;
    const duplicate = seenObservations.has(key)
      ? recordedPrice === item.priceIdr
      : unchangedObservations.has(key);
    if (duplicate) duplicatePrices += 1;
    else pricesRecorded += 1;
    seenObservations.add(key);
  }

  // Tahap 5: foto listing (tiap warna) masuk galeri produk. Hak penggunaan
  // wajib diisi admin (PRD §6); tanpanya foto dilewati, harga tetap tersimpan.
  const productById = new Map(catalogProducts.map((product) => [product.id, product]));
  const galleryJobs = [
    ...new Map(listingImages.map((image) => [`${image.productId}|${image.url}`, image])).values(),
  ];
  const imageSkipped: { label: string; reason: string }[] = [];
  let imagesAdded = 0;
  let imagesUnchanged = 0;
  if (galleryJobs.length > 0 && !imageRights) {
    imageSkipped.push({
      label: `${galleryJobs.length} foto listing`,
      reason: "Dasar hak pakai foto belum dipilih, jadi foto tidak diunduh.",
    });
  } else if (galleryJobs.length > 0 && imageRights) {
    const rights = imageRights;
    const retrievedAt = new Date().toISOString();
    const jobsByProduct = new Map<string, typeof galleryJobs>();
    for (const job of galleryJobs) {
      jobsByProduct.set(job.productId, [...(jobsByProduct.get(job.productId) ?? []), job]);
    }
    // Paralel antar-produk, berurutan di dalam satu produk: batas jumlah foto
    // galeri dihitung dari isi tabel, jadi dua unggahan produk yang sama tidak
    // boleh membaca hitungan yang sama.
    await mapWithConcurrency([...jobsByProduct.values()], IMAGE_IMPORT_CONCURRENCY, async (jobs) => {
      for (const job of jobs) {
        const product = productById.get(job.productId)!;
        const name = `${product.brand} ${product.model}`;
        const result = await importGalleryImage({
          productId: job.productId,
          candidate: {
            imageUrl: job.url,
            source: job.marketplace,
            sourceUrl: job.sourceUrl,
            alt: `Foto ${name}`,
            rights,
          },
          retrievedAt,
        });
        if (!result.ok) imageSkipped.push({ label: name, reason: result.reason });
        else if (result.outcome === "unchanged") imagesUnchanged += 1;
        else imagesAdded += 1;
      }
    });
  }

  await recordAudit(admin, "impor.penawaran", "dataset", null, {
    berkas: fileName,
    baris: rows.length,
    baru: created,
    diperbarui: updated,
    format: [...sourceFormats],
    dipraproses: preprocessedRows,
    listing_digabung: mergedListings,
    foto_baru: imagesAdded,
    foto_dilewati: imageSkipped.length,
    varian_dasar_disimpulkan: inferredBaseVariants,
    harga: pricesRecorded,
    harga_duplikat: duplicatePrices,
    dilewati: skipped.length,
  });

  invalidateCatalogCache();
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");

  return {
    error: null,
    summary: {
      totalRows: rows.length,
      preprocessedRows,
      mergedListings,
      inferredBaseVariants,
      sourceFormats: [...sourceFormats],
      imagesAdded,
      imagesUnchanged,
      imageSkipped,
      created,
      updated,
      pricesRecorded,
      duplicatePrices,
      skipped,
      malformedLines: malformedLines,
    },
  };
}
