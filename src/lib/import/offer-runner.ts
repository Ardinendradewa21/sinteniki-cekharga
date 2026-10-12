import "server-only";

import { revalidatePath } from "next/cache";

import type { AdminSession } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { recordAudit } from "@/lib/admin/audit";
import type { CsvRow } from "@/lib/import/csv-parser";
import { applyKeepExisting, type OfferKeepableField } from "@/lib/import/patch-rules";
import {
  chunk,
  INSERT_CHUNK,
  mapWithConcurrency,
  selectAll,
  selectWhereIn,
  timeKey,
} from "@/lib/import/batch";
import { colorInOptions, mergeColors, sameColors } from "@/lib/import/colors";
import type { ImageRights } from "@/lib/import/image-rights";
import { offerRowsToCanonical } from "@/lib/import/canonical";
import type { OfferCatalogProduct, OfferSourceFormat } from "@/lib/import/offers";
import { enqueuePhotoJobs } from "@/lib/import/photo-jobs";
import type { OfferImportReport, RowResult } from "@/lib/import/report";
import { loadSlugRedirects, loadStoreResolver, type StoreResolver } from "@/lib/import/stores";

/**
 * Impor penawaran dan harga (PRD §3 dan §7), terpisah dari server action.
 *
 * Modul biasa, bukan "use server": fungsi di sini TIDAK boleh bisa dipanggil
 * langsung dari browser. Pemanggilnya wajib sudah menjalankan requireStaff([]).
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
  /** Kolom yang dipertahankan dari penawaran lama karena selnya kosong. */
  keepExisting: OfferKeepableField[];
  priceIdr: number | null;
  observedAt: string | null;
  origin: "manual" | "automatic";
  inferred: boolean;
  format: OfferSourceFormat;
  /** Warna listing di baris ini. */
  color: string | null;
  /**
   * Semua warna yang tercatat untuk penawaran ini di berkas (gabungan baris
   * ganda dan listing warna lain yang digabung). Kosong = tidak diubah.
   */
  colors: string[];
  /** Alasan baris ini perlu ditinjau walau produknya cocok. */
  reviewNote: string | null;
};

export type ListingImage = {
  productId: string;
  url: string;
  sourceUrl: string;
  marketplace: string;
  rowIndex: number;
  /** Hak pakai dari kolom baris; null = pakai pilihan form. */
  rights: ImageRights | null;
  color: string | null;
};

export type OfferContext = {
  catalogProducts: OfferCatalogProduct[];
  bySlug: Map<string, string>;
  byVariantKey: Map<string, string>;
  storeFor: StoreResolver;
};

/** Katalog untuk pencocokan, dibaca LENGKAP sekali di depan. null bila gagal dibaca. */
export async function loadOfferContext(): Promise<OfferContext | null> {
  let products: { id: string; slug: string; brand: string; model: string; is5G: unknown; colorOptions: unknown }[];
  let variants: { id: string; product_id: string; ram_gb: number; storage_gb: number }[];
  let storeFor: StoreResolver;
  let slugRedirects: Map<string, string>;
  try {
    const [productRows, variantRows, resolver, redirects] = await Promise.all([
      selectAll("products", "id, slug, brand, model, is5G:specs->is5G, colorOptions:specs->colorOptions"),
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
    colorOptions: Array.isArray(product.colorOptions) ? product.colorOptions.filter((c): c is string => typeof c === "string") : null,
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
  /** Foto baris yang tidak dipakai (host tidak diizinkan, hak pakai tidak lengkap). */
  imageIssues: { rowIndex: number; label: string; reason: string }[];
};

/**
 * Warna berkas yang tidak ada di daftar warna spesifikasi produk tetap
 * disimpan apa adanya, tetapi barisnya ditandai Perlu tinjau: bisa salah
 * ketik ("Celestian" vs "Celestial") atau nama pemasaran yang berbeda.
 */
function colorNote(color: string | null, options: readonly string[] | null | undefined): string | null {
  if (!color || colorInOptions(color, options)) return null;
  return `Warna "${color}" tidak ada di daftar warna spesifikasi produk (${options!.join(", ")}). Periksa ejaannya.`;
}

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
  const imageIssues: OfferPreparation["imageIssues"] = [];
  const productById = new Map(catalogProducts.map((product) => [product.id, product]));

  // Tahap 1, tanpa jaringan: adaptor kanonik (canonical.ts) menerjemahkan
  // setiap format penawaran ke bentuk yang sama, lalu dicocokkan di sini.
  const items: PreparedItem[] = [];
  const canonical = offerRowsToCanonical(rows, catalogProducts, {
    observedAt: defaultObservedAt,
    sellerName: defaultSellerName,
  });
  for (const { rowIndex, format, label: rowLabel, offer, issue } of canonical) {
    if (format === "gsmarena-spec") continue;
    sourceFormats.add(format);
    if (format !== "template") preprocessedRows += 1;
    if (!offer) {
      skipped.push({ label: rowLabel, reason: issue ?? "Baris tidak valid", rowIndex });
      continue;
    }
    const outcome = { ...offer, format };
    const row = offer.row;
    const label = `${row.slug} ${row.ramGb}/${row.storageGb}`;
    if (outcome.imageIssue) imageIssues.push({ rowIndex, label: `Foto ${label}`, reason: outcome.imageIssue });
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
    if (outcome.image) {
      listingImages.push({
        productId: outcome.image.productId ?? productId,
        url: outcome.image.url,
        rights: outcome.image.rights,
        color: outcome.image.color,
        sourceUrl: row.url,
        marketplace: row.marketplace,
        rowIndex,
      });
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
      keepExisting: row.keepExisting,
      priceIdr: row.priceIdr,
      observedAt: row.observedAt,
      origin: outcome.origin,
      inferred: outcome.inferredBaseVariant,
      format: outcome.format,
      color: outcome.color,
      colors: [],
      reviewNote: [outcome.reviewNote, colorNote(outcome.color, productById.get(productId)?.colorOptions)]
        .filter(Boolean)
        .join(" ") || null,
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
  // Warna per penawaran: gabungan warna semua baris untuk listing yang sama,
  // termasuk listing warna lain yang digabung ke listing termurah.
  const colorsByOffer = new Map<string, string[]>();
  for (const item of items) {
    if (!item.color) continue;
    const key = mergedInto.get(item) ?? item.offerKey;
    colorsByOffer.set(key, mergeColors(colorsByOffer.get(key) ?? [], [item.color]));
  }
  for (const item of items) item.colors = colorsByOffer.get(item.offerKey) ?? [];

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
    imageIssues,
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
  quiet = false,
  batchId = null,
  context: providedContext,
  source = "import",
}: {
  rows: readonly CsvRow[];
  fileName: string;
  defaultObservedAt: string;
  defaultSellerName: string;
  imageRights: ImageRights | null;
  admin: AdminSession;
  malformedLines?: number[];
  /** Batch asal, dicatat di antrean foto. */
  batchId?: string | null;
  /**
   * Katalog untuk pencocokan yang sudah dibaca pemanggil. Worker memakai ulang
   * satu konteks untuk semua potongan dalam satu langkah, alih-alih membaca
   * ulang seluruh tabel produk dan varian setiap 40 baris.
   */
  context?: OfferContext;
  /** Jenis sumber untuk jejak asal: CSV atau tarik otomatis. */
  source?: "import" | "scrape";
  /** true = satu potongan penerapan bertahap; audit dan revalidasi oleh worker. */
  quiet?: boolean;
}): Promise<OfferImportReport & { rowResults: RowResult[] }> {
  const db = getInsforgeAdminClient().database;
  const uploadedAt = new Date();
  const context = providedContext ?? (await loadOfferContext());
  if (!context) {
    return { error: "Katalog produk atau varian gagal dibaca untuk pencocokan harga.", summary: null, rowResults: [] };
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
  const rowResults: RowResult[] = [
    ...prepared.skipped.flatMap(({ rowIndex, reason }) =>
      rowIndex === undefined ? [] : [{ rowIndex, outcome: "skipped" as const, entityId: null, message: reason }]
    ),
    ...prepared.merged.map(({ item }) => ({
      rowIndex: item.rowIndex,
      outcome: "skipped" as const,
      entityId: null,
      message: "Warna lain dari varian yang sama; digabung ke listing termurah.",
    })),
  ];

  // Tahap 2: penawaran. Baris ganda untuk penawaran yang sama digabung; data
  // baris terakhir yang dipakai, sama seperti hasil akhir impor berurutan.
  const latestItemByOffer = new Map(items.map((item) => [item.offerKey, item]));

  let existingOffers: Awaited<ReturnType<typeof selectWhereIn>>;
  try {
    // Penawaran yang dihapus lunak ikut dibaca: kuncinya (varian + URL) tetap
    // terpakai, dan impor ulang memulihkannya beserta riwayat harganya.
    existingOffers = await selectWhereIn(
      "offers",
      "id, variant_id, url, marketplace, seller_name, warranty, listing_status, seller_verified, store_id, colors, deleted_at",
      "variant_id",
      items.map((item) => item.variantId),
      { includeDeleted: true }
    );
  } catch {
    return {
      error: "Penawaran lama gagal diperiksa, jadi impor dibatalkan sebelum menulis apa pun.",
      summary: null,
      rowResults: [],
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
  // Jejak asal (Fase 4). Sengaja di luar `payload`: perbandingan "isi berubah?"
  // tidak boleh terpicu hanya karena batchnya berbeda.
  const lineage = { updated_by_batch_id: batchId, last_source: source };
  const offerIdByKey = new Map<string, string>();
  const offerFailure = new Map<string, string>();

  const samePayload = (row: Record<string, unknown>, payload: OfferPayload) =>
    (Object.keys(payload) as (keyof OfferPayload)[]).every(
      (key) => (row[key] ?? null) === payload[key]
    );

  // Pembaruan hanya dikirim bila isinya memang berubah, dan dikirim massal
  // lewat RPC `import_update_offers` (dulu satu update per penawaran, N+1).
  const offerUpdates: { item: PreparedItem; offerId: string; payload: OfferPayload }[] = [];
  for (const item of latestItemByOffer.values()) {
    const row = existingByKey.get(item.offerKey);
    if (!row) continue;
    const offerId = String(row.id);
    const payload = applyKeepExisting(item.payload, row, item.keepExisting);
    // Warna kosong di berkas = tidak diubah; warna terisi menggantikan daftar lama.
    const colorsChanged = item.colors.length > 0 && !sameColors(item.colors, (row.colors as string[] | null) ?? []);
    if (!samePayload(row, payload) || colorsChanged || row.deleted_at) offerUpdates.push({ item, offerId, payload });
    else offerIdByKey.set(item.offerKey, offerId);
  }
  for (const group of chunk(offerUpdates, INSERT_CHUNK)) {
    const { data, error } = await db.rpc("import_update_offers", {
      p_rows: group.map(({ item, offerId, payload }) => ({
        id: offerId,
        colors: item.colors.length > 0 ? item.colors : null,
        marketplace: payload.marketplace,
        seller_name: payload.seller_name,
        warranty: payload.warranty,
        listing_status: payload.listing_status,
        seller_verified: payload.seller_verified,
        store_id: payload.store_id,
        url: payload.url ?? null,
        ...lineage,
      })),
    });
    const updated = new Set(((data ?? []) as { id: string }[]).map((row) => row.id));
    for (const { item, offerId } of group) {
      if (!error && updated.has(offerId)) offerIdByKey.set(item.offerKey, offerId);
      else offerFailure.set(item.offerKey, "Gagal memperbarui penawaran.");
    }
    if (error) console.error("[impor-harga] pembaruan penawaran gagal:", error);
  }

  const newOfferRow = (item: PreparedItem) => ({
    ...item.payload,
    ...lineage,
    created_by_batch_id: batchId,
    variant_id: item.variantId,
    url: item.url,
    colors: item.colors,
    condition: "new",
    deleted_at: null,
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
        // Baris yang dibatalkan undo ikut dibaca: kunci uniknya tetap terpakai,
        // dan impor ulang data yang sama memulihkannya, bukan menduplikasi.
        selectWhereIn("price_observations", "id, offer_id, observed_at, price_idr, voided_at", "offer_id", offerIds, {
          range: { column: "observed_at", ...window },
          includeDeleted: true,
        }),
        selectWhereIn("price_checks", "id, offer_id, attempted_at, outcome, voided_at", "offer_id", offerIds, {
          range: { column: "attempted_at", ...window },
          includeDeleted: true,
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
      const successfulChecks = existingChecks.filter((row) => row.outcome === "success");
      const successfulCheckKeys = new Set(
        successfulChecks.map((row) => observationKey(String(row.offer_id), String(row.attempted_at)))
      );
      const voidedCheckIdByKey = new Map(
        successfulChecks
          .filter((row) => row.voided_at)
          .map((row) => [observationKey(String(row.offer_id), String(row.attempted_at)), String(row.id)])
      );

      const observationRow = (key: string, item: PreparedItem) => ({
        offer_id: key.split("|")[0],
        price_idr: item.priceIdr,
        observed_at: item.observedAt,
        origin: item.origin,
        batch_id: batchId,
        voided_at: null,
      });

      const observationsToInsert: [string, PreparedItem][] = [];
      const observationsToUpdate: [string, PreparedItem, string][] = [];
      for (const [key, item] of latestItemByObservation) {
        const existing = existingObservationByKey.get(key);
        if (!existing) observationsToInsert.push([key, item]);
        else if (Number(existing.price_idr) === item.priceIdr && !existing.voided_at) unchangedObservations.add(key);
        else observationsToUpdate.push([key, item, String(existing.id)]);
      }

      // Koreksi harga pada waktu pengamatan yang sama, massal lewat RPC.
      for (const group of chunk(observationsToUpdate, INSERT_CHUNK)) {
        const { data, error } = await db.rpc("import_update_observations", {
          p_rows: group.map(([, item, id]) => ({ id, price_idr: item.priceIdr, origin: item.origin, batch_id: batchId })),
        });
        const updated = new Set(((data ?? []) as { id: string }[]).map((row) => row.id));
        for (const [key, , id] of group) {
          if (error || !updated.has(id)) observationFailure.set(key, "Penawaran tersimpan tetapi harganya gagal dicatat.");
        }
        if (error) console.error("[impor-harga] koreksi harga gagal:", error);
      }

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
        batch_id: batchId,
      });
      const checksToInsert = [...latestItemByObservation].filter(
        ([key]) => !observationFailure.has(key) && !successfulCheckKeys.has(key)
      );
      // Pemeriksaan berhasil yang dibatalkan undo dipulihkan bersama harganya.
      const checksToRestore = [...latestItemByObservation.keys()]
        .filter((key) => !observationFailure.has(key) && voidedCheckIdByKey.has(key))
        .map((key) => voidedCheckIdByKey.get(key)!);
      for (const group of chunk(checksToRestore, INSERT_CHUNK)) {
        const { error } = await db
          .from("price_checks")
          .update({ voided_at: null, batch_id: batchId })
          .in("id", group);
        if (error) console.error("[impor-harga] pemeriksaan batal gagal dipulihkan:", error);
      }
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
      rowResults.push({ rowIndex: item.rowIndex, outcome: "failed", entityId: null, message: failure });
      continue;
    }
    const wasExisting = existingByKey.has(item.offerKey) || seenOffers.has(item.offerKey);
    if (wasExisting) updated += 1;
    else created += 1;
    seenOffers.add(item.offerKey);
    const offerId = offerIdByKey.get(item.offerKey) ?? null;
    const outcome = wasExisting ? ("updated" as const) : ("created" as const);

    if (item.inferred) inferredBaseVariants += 1;

    if (item.priceIdr === null || item.observedAt === null) {
      rowResults.push({ rowIndex: item.rowIndex, outcome, entityId: offerId, message: null });
      continue;
    }
    const key = observationKey(offerIdByKey.get(item.offerKey)!, item.observedAt);
    const priceFailure = observationFailure.get(key);
    if (priceFailure) {
      skipped.push({ label: item.label, reason: priceFailure });
      rowResults.push({ rowIndex: item.rowIndex, outcome: "failed", entityId: offerId, message: priceFailure });
      continue;
    }
    rowResults.push({ rowIndex: item.rowIndex, outcome, entityId: offerId, message: null });
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
  // Foto listing tidak diunduh di sini: diantrekan ke photo_jobs dan
  // dikerjakan worker foto, berurutan per produk karena galeri dibatasi.
  const imageSkipped: { label: string; reason: string }[] = [];
  const imagesAdded = 0;
  const imagesUnchanged = 0;
  let imagesQueued = 0;
  // Hak pakai dari kolom baris didahulukan; tanpa itu dipakai pilihan form.
  const withoutRights = galleryJobs.filter((job) => !(job.rights ?? imageRights)).length;
  if (withoutRights > 0) {
    imageSkipped.push({
      label: `${withoutRights} foto listing`,
      reason: "Dasar hak pakai foto belum dipilih, jadi foto tidak diunduh.",
    });
  }
  if (prepared.imageIssues.length > 0) {
    imageSkipped.push(...prepared.imageIssues.map(({ label, reason }) => ({ label, reason })));
  }
  const queueable = galleryJobs.flatMap((job) => {
    const rights = job.rights ?? imageRights;
    return rights ? [{ job, rights }] : [];
  });
  if (queueable.length > 0) {
    const queued = await enqueuePhotoJobs(
      queueable.map(({ job, rights }) => {
        const product = productById.get(job.productId);
        return {
          productId: job.productId,
          kind: "gallery" as const,
          imageUrl: job.url,
          source: job.marketplace,
          sourceUrl: job.sourceUrl,
          alt: `Foto ${product ? `${product.brand} ${product.model}` : "produk"}`,
          rights,
          color: job.color,
          // Foto di baris penawaran berwarna adalah sampul warna itu (dipasang
          // hanya bila warna itu belum punya sampul).
          isCover: Boolean(job.color),
          sortOrder: 0,
          batchId,
        };
      })
    );
    imagesQueued = queued.queued;
    if (queued.failed > 0) {
      imageSkipped.push({ label: `${queued.failed} foto listing`, reason: "Gagal masuk antrean foto." });
    }
  }

  if (!quiet) await recordAudit(admin, "impor.penawaran", "dataset", null, {
    berkas: fileName,
    baris: rows.length,
    baru: created,
    diperbarui: updated,
    format: [...sourceFormats],
    dipraproses: preprocessedRows,
    listing_digabung: mergedListings,
    foto_diantrekan: imagesQueued,
    foto_dilewati: imageSkipped.length,
    varian_dasar_disimpulkan: inferredBaseVariants,
    harga: pricesRecorded,
    harga_duplikat: duplicatePrices,
    dilewati: skipped.length,
  });

  if (!quiet) {
    invalidateCatalogCache();
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    revalidatePath("/products");
    revalidatePath("/");
  }

  return {
    error: null,
    rowResults,
    summary: {
      totalRows: rows.length,
      preprocessedRows,
      mergedListings,
      inferredBaseVariants,
      sourceFormats: [...sourceFormats],
      imagesAdded,
      imagesUnchanged,
      imagesQueued,
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
