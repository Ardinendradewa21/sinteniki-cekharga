import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { getInsforgePublicClient } from "@/lib/backend/insforge";
import {
  mapAssets,
  mapOffers,
  mapPriceChecks,
  mapPriceObservations,
  mapProducts,
  mapReviews,
  mapSlugRedirects,
  mapStores,
  mapVariants,
} from "@/lib/backend/catalog-mapper";
import type { CatalogDataset } from "@/lib/catalog/schema";

/**
 * Pengambilan dataset katalog dari InsForge (PRD §9 Irisan B).
 *
 * Kontrak `CatalogSource` tetap berbentuk "satu dataset utuh", karena seluruh
 * aturan harga di PRD §7 adalah fungsi murni yang bekerja di atas dataset itu.
 * Yang berubah adalah CARA dataset itu disiapkan, supaya tidak menjadi
 * bottleneck ketika data tumbuh:
 *
 * 1. Di-cache lintas request (`unstable_cache`, tag `catalog`). Sebelumnya
 *    setiap render menarik tujuh tabel penuh, dan halaman detail melakukannya
 *    dua kali (metadata + halaman). Seluruh aksi tulis admin/impor memanggil
 *    `invalidateCatalogCache()`, jadi perubahan admin langsung terlihat;
 *    `revalidate` hanya jaring pengaman untuk penulisan yang tidak lewat
 *    aplikasi ini (mis. pemeriksaan harga otomatis dari luar).
 *
 * 2. Riwayat harga diringkas SEBELUM masuk cache. `price_observations` dan
 *    `price_checks` bertambah setiap impor, sedangkan aturan harga hanya butuh
 *    pengamatan terbaru dan pemeriksaan BERHASIL terakhir per penawaran
 *    (lihat `latestObservation` dan `lastSuccessfulCheckAt`). Menyimpan seluruh
 *    riwayat hanya membuat cache dan perhitungan membengkak tanpa mengubah hasil.
 *
 * 3. Dibaca per halaman (`range`), bukan dengan batas keras 1000 baris yang
 *    dulu membuat SELURUH situs gagal begitu tabel harga melewatinya. Batas
 *    `MAX_ROWS_PER_TABLE` tetap ada sebagai kegagalan yang kelihatan: kalau
 *    tersentuh, penyaringan harus dipindahkan ke database (mis. view
 *    `DISTINCT ON (offer_id)`), bukan angkanya dinaikkan.
 *
 * Dibaca memakai anon key, sehingga RLS database yang menjamin hanya data
 * terbit yang terbaca (termasuk varian, penawaran, dan harga milik produk
 * draft). Filter status di query dan `selectPublished()` di lapisan katalog
 * tetap ada sebagai lapis kedua dan ketiga, bukan satu-satunya pengaman.
 */

export const CATALOG_CACHE_TAG = "catalog";

/** Detik sebelum cache dianggap basi walau tidak ada aksi tulis. */
const CATALOG_REVALIDATE_SECONDS = 300;

/** Ukuran satu halaman baca; sama dengan batas bawaan PostgREST. */
const PAGE_SIZE = 1000;

const MAX_ROWS_PER_TABLE = 50_000;

type Row = Record<string, unknown>;

type TableQuery = {
  table: string;
  columns: string;
  /** Urutan wajib deterministik supaya halaman tidak saling tumpang tindih. */
  order: { column: string; ascending: boolean }[];
  filters?: { column: string; value: string }[];
};

async function fetchAllRows({
  table,
  columns,
  order,
  filters = [],
}: TableQuery): Promise<Row[]> {
  const client = getInsforgePublicClient();
  const rows: Row[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.database.from(table).select(columns);
    for (const filter of filters) query = query.eq(filter.column, filter.value);
    for (const { column, ascending } of order) {
      query = query.order(column, { ascending });
    }

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) {
      // Pesan asli dari backend tidak diteruskan mentah-mentah: pemanggil di
      // jalur render membungkusnya, dan pengunjung hanya perlu tahu bahwa
      // sumbernya sedang bermasalah.
      console.error(`[katalog] gagal membaca "${table}":`, error);
      throw new Error(`Gagal membaca tabel "${table}" dari sumber data.`);
    }

    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);

    if (rows.length > MAX_ROWS_PER_TABLE) {
      throw new Error(
        `Tabel "${table}" melebihi ${MAX_ROWS_PER_TABLE} baris. Penyaringan ` +
          "harus dipindahkan ke database sebelum katalog bisa disajikan."
      );
    }
    if (page.length < PAGE_SIZE) return rows;
  }
}

/**
 * Menyisakan baris pertama per `offer_id`. Masukan WAJIB sudah terurut dari
 * yang terbaru, sehingga baris pertama yang ditemui adalah yang terbaru.
 */
function keepLatestPerOffer(rows: Row[]): Row[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const offerId = String(row.offer_id);
    if (seen.has(offerId)) return false;
    seen.add(offerId);
    return true;
  });
}

const byId = [{ column: "id", ascending: true }];

async function fetchCatalogFromBackend(): Promise<CatalogDataset> {
  const [products, variants, assets, reviews, offers, observations, checks, stores, redirects] =
    await Promise.all([
      fetchAllRows({
        table: "products",
        columns:
          "id, slug, brand, model, specs, specs_source, specs_source_url, specs_retrieved_at, status",
        order: byId,
        filters: [{ column: "status", value: "published" }],
      }),
      fetchAllRows({
        table: "variants",
        columns: "id, product_id, ram_gb, storage_gb, region",
        order: byId,
      }),
      fetchAllRows({
        table: "product_assets",
        columns:
          "id, product_id, variant_id, kind, src, alt, source, source_url, retrieved_at, usage_rights",
        order: [
          { column: "created_at", ascending: true },
          ...byId,
        ],
      }),
      fetchAllRows({
        table: "review_summaries",
        columns:
          "id, product_id, variant_id, channel_name, video_url, published_at, timestamp_seconds, aspect, summary, strengths, limitations, test_context, status",
        order: byId,
        filters: [{ column: "status", value: "published" }],
      }),
      fetchAllRows({
        table: "offers",
        columns:
          "id, variant_id, marketplace, seller_name, url, warranty, listing_status, seller_verified, store_id",
        order: byId,
      }),
      fetchAllRows({
        table: "price_observations",
        columns: "id, offer_id, price_idr, observed_at, origin",
        order: [{ column: "observed_at", ascending: false }, ...byId],
      }),
      // Hanya percobaan BERHASIL yang memengaruhi harga publik (PRD §7 butir 6).
      fetchAllRows({
        table: "price_checks",
        columns: "id, offer_id, attempted_at, outcome, error_summary",
        order: [{ column: "attempted_at", ascending: false }, ...byId],
        filters: [{ column: "outcome", value: "success" }],
      }),
      fetchAllRows({
        table: "stores",
        columns: "id, slug, name, kind",
        order: byId,
      }),
      // RLS hanya mengembalikan redirect milik produk terbit.
      fetchAllRows({
        table: "product_slug_redirects",
        columns: "old_slug, product_id",
        order: [{ column: "old_slug", ascending: true }],
      }),
    ]);

  return {
    products: mapProducts(products),
    variants: mapVariants(variants),
    assets: mapAssets(assets),
    reviews: mapReviews(reviews),
    offers: mapOffers(offers),
    priceObservations: mapPriceObservations(keepLatestPerOffer(observations)),
    priceChecks: mapPriceChecks(keepLatestPerOffer(checks)),
    stores: mapStores(stores),
    slugRedirects: mapSlugRedirects(redirects),
  };
}

/**
 * Dataset hasil pemetaan hanya berisi string, angka, boolean, dan array/objek
 * biasa, jadi aman diserialisasi oleh cache Next.js tanpa kehilangan bentuk.
 */
export const loadCatalogFromBackend = unstable_cache(
  fetchCatalogFromBackend,
  ["catalog-dataset", "v4-stores-redirects"],
  { tags: [CATALOG_CACHE_TAG], revalidate: CATALOG_REVALIDATE_SECONDS }
);

/**
 * Dipanggil setiap aksi tulis admin/impor. `expire: 0` berarti request
 * berikutnya menunggu data segar, bukan menyajikan versi lama, sehingga admin
 * langsung melihat perubahannya sendiri.
 */
export function invalidateCatalogCache(): void {
  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
}
