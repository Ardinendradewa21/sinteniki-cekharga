import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import {
  mapAssets,
  mapOffers,
  mapPriceChecks,
  mapPriceObservations,
  mapProducts,
  mapReviews,
  mapVariants,
} from "@/lib/backend/catalog-mapper";
import type { CatalogDataset } from "@/lib/catalog/schema";

/**
 * Pengambilan dataset katalog dari InsForge (PRD §9 Irisan B).
 *
 * Kenapa mengambil seluruh tabel sekaligus, bukan query per halaman?
 *
 * Karena kontrak `CatalogSource` memang berbentuk "satu dataset utuh", dan
 * seluruh aturan harga di PRD §7 (harga layak, freshness, pemeriksaan gagal
 * yang tidak menggeser waktu berhasil) sudah berupa fungsi murni yang bekerja
 * di atas dataset itu. Menukar sumbernya tanpa menyentuh aturan adalah inti
 * dari desain adapter ini.
 *
 * Ini sah selama katalog masih kecil. Batas `MAX_ROWS` ada supaya kalau suatu
 * hari datanya membengkak, yang terjadi adalah kegagalan yang kelihatan, bukan
 * halaman yang diam-diam menampilkan sebagian katalog seolah itu seluruhnya.
 * Saat batas itu tersentuh, yang benar adalah memindahkan penyaringan ke
 * database, bukan menaikkan angkanya.
 */

const MAX_ROWS = 1000;

const TABLES = [
  "products",
  "variants",
  "product_assets",
  "review_summaries",
  "offers",
  "price_observations",
  "price_checks",
] as const;

type Row = Record<string, unknown>;

async function fetchTable(table: (typeof TABLES)[number]): Promise<Row[]> {
  const client = getInsforgeAdminClient();
  const { data, error } = await client.database
    .from(table)
    .select()
    .limit(MAX_ROWS + 1);

  if (error) {
    // Pesan asli dari backend tidak diteruskan mentah-mentah: pemanggil di
    // jalur render membungkusnya, dan pengunjung hanya perlu tahu bahwa
    // sumbernya sedang bermasalah.
    throw new Error(`Gagal membaca tabel "${table}" dari sumber data.`);
  }

  const rows = (data ?? []) as Row[];

  if (rows.length > MAX_ROWS) {
    throw new Error(
      `Tabel "${table}" melebihi ${MAX_ROWS} baris. Penyaringan harus dipindahkan ` +
        "ke database sebelum katalog bisa disajikan dengan benar."
    );
  }

  return rows;
}

export async function loadCatalogFromBackend(): Promise<CatalogDataset> {
  const [products, variants, assets, reviews, offers, observations, checks] =
    await Promise.all(TABLES.map(fetchTable));

  return {
    products: mapProducts(products),
    variants: mapVariants(variants),
    assets: mapAssets(assets),
    reviews: mapReviews(reviews),
    offers: mapOffers(offers),
    priceObservations: mapPriceObservations(observations),
    priceChecks: mapPriceChecks(checks),
  };
}
