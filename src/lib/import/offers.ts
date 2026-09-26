import { z } from "zod";

import type { CsvRow } from "@/lib/import/csv-parser";

/**
 * Penerjemah baris CSV penawaran (PRD §3, §7, FR-05).
 *
 * PRD §3 menyatakan penawaran didaftarkan admin secara manual, dan pembaruan
 * harga manual tetap jalur yang sah. Berkas ini membuat pekerjaan itu bisa
 * dilakukan sekaligus, bukan satu per satu lewat form.
 *
 * Yang TIDAK boleh dilakukan importer ini, dan semuanya disengaja:
 *
 * - Membuat produk atau varian baru. Kalau slug atau kombinasi RAM/penyimpanan
 *   tidak ditemukan, barisnya dilewati beserta alasannya. PRD §6 melarang
 *   membuat kombinasi yang tidak tercantum, dan sebuah salah ketik di berkas
 *   tidak boleh berubah menjadi varian karangan di katalog.
 * - Menerbitkan produk. Penawaran boleh masuk ke produk draft; yang
 *   memutuskan terbit tetap manusia.
 * - Menandai penjual terverifikasi tanpa diminta. Kolomnya ada, tetapi
 *   defaultnya false, sebab FR-05 mensyaratkan badge itu punya bukti.
 */

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

export const offerRowSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Kolom slug kosong")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug tidak berbentuk kebab-case"),
  ramGb: z.coerce.number().int().positive("RAM harus angka lebih dari 0"),
  storageGb: z.coerce.number().int().positive("Penyimpanan harus angka lebih dari 0"),
  marketplace: z.string().trim().min(1, "Marketplace wajib diisi"),
  sellerName: z.string().trim().min(1, "Nama penjual wajib diisi"),
  url: z.httpUrl("URL listing harus http atau https"),
  warranty: z.preprocess(emptyToNull, z.string().trim().min(1).nullable()),
  listingStatus: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : "active"),
    z.enum(["active", "out-of-stock", "ambiguous", "inactive"])
  ),
  sellerVerified: z.preprocess((v) => {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "ya" || s === "true" || s === "1" || s === "yes";
  }, z.boolean()),
  /**
   * Harga boleh kosong: kadang penawarannya sudah diketahui tetapi harganya
   * belum sempat diperiksa. Kosong berarti penawaran tercatat tanpa harga,
   * bukan harga nol.
   */
  priceIdr: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const bersih = v.replace(/[.\s]/g, "").replace(/^Rp/i, "");
      return bersih === "" ? null : bersih;
    },
    z.coerce
      .number()
      .int("Harga harus bilangan bulat Rupiah")
      .positive("Harga harus lebih dari 0 Rupiah")
      .max(500_000_000, "Harga di luar batas wajar, periksa lagi angkanya")
      .nullable()
  ),
  observedAt: z.preprocess(
    (v) => {
      const value = String(v ?? "").trim();
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
    },
    z
      .string()
      .datetime({ offset: true, message: "Waktu pengamatan harga tidak valid" })
      .nullable()
  ),
});

export type OfferRow = z.infer<typeof offerRowSchema>;

export type OfferOutcome =
  | { ok: true; row: OfferRow }
  | { ok: false; label: string; reason: string };

export type OfferCatalogProduct = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  /** Dari spesifikasi; dipakai hanya untuk mencocokkan judul berakhiran 4G/5G. */
  is5G?: boolean | null;
  variants: { id: string; ramGb: number; storageGb: number }[];
};

export type OfferSourceFormat = "template" | "shopee-scrape" | "erafone-scrape";

export type PreparedOfferOutcome =
  | {
      ok: true;
      row: OfferRow;
      format: OfferSourceFormat;
      origin: "manual" | "automatic";
      /** True bila judul tidak menyebut memori dan varian dasar disimpulkan. */
      inferredBaseVariant: boolean;
      /** Foto listing untuk galeri produk; host-nya tetap diperiksa importer gambar. */
      image: { url: string; productId: string } | null;
    }
  | { ok: false; label: string; reason: string; format: OfferSourceFormat };

/** Nama kolom yang diterima, ditulis apa adanya di templat unduhan. */
export const OFFER_COLUMNS = [
  "slug",
  "ram_gb",
  "storage_gb",
  "marketplace",
  "seller_name",
  "url",
  "warranty",
  "listing_status",
  "seller_verified",
  "price_idr",
  "observed_at",
] as const;

export function mapOfferRow(row: CsvRow): OfferOutcome {
  const get = (k: string) => (row[k] ?? "").trim();
  const label =
    [get("slug"), get("ram_gb") && `${get("ram_gb")}/${get("storage_gb")}`]
      .filter(Boolean)
      .join(" ") || "(baris tanpa slug)";

  const parsed = offerRowSchema.safeParse({
    slug: get("slug"),
    ramGb: get("ram_gb"),
    storageGb: get("storage_gb"),
    marketplace: get("marketplace"),
    sellerName: get("seller_name"),
    url: get("url"),
    warranty: get("warranty"),
    listingStatus: get("listing_status"),
    sellerVerified: get("seller_verified"),
    priceIdr: get("price_idr"),
    observedAt: get("observed_at"),
  });

  if (!parsed.success) {
    return { ok: false, label, reason: parsed.error.issues[0]?.message ?? "Baris tidak valid" };
  }

  return { ok: true, row: parsed.data };
}

const RAW_URL_COLUMNS = [
  "listing_url",
  "product_url",
  "url",
  "contents href",
  "contents_href",
];
const RAW_TITLE_COLUMNS = ["title", "product_name", "name", "whitespace-normal"];
const RAW_PRICE_COLUMNS = ["price_idr", "price", "font-medium 2"];
const RAW_SELLER_COLUMNS = ["seller_name", "shop_name", "store_name"];
const RAW_OBSERVED_COLUMNS = ["observed_at", "scraped_at", "crawled_at", "retrieved_at"];

function normalizedColumnName(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function valueFrom(row: CsvRow, aliases: readonly string[]): string {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizedColumnName(key), value])
  );
  for (const alias of aliases) {
    const value = normalized.get(normalizedColumnName(alias))?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeProductName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\+/g, " plus ")
    .replace(/[®™©]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    // "Neo10" dan "Neo 10" adalah nama yang sama; toko dan GSMArena tidak
    // konsisten memberi spasi sebelum angka seri.
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Hanya pola pasangan memori yang eksplisit. Angka seperti 6000mAh, 120Hz,
// atau 33W tidak boleh salah dibaca sebagai varian. "16/1TB" dibaca 1024 GB.
const MEMORY_PAIR =
  /\(?\s*(\d{1,2})\s*(?:gb)?\s*(?:\/|\+)\s*(?:(\d{2,4})\s*gb|(\d)\s*tb)\s*\)?/gi;

function memoryPairs(title: string): { ramGb: number; storageGb: number }[] {
  const pairs = [...title.matchAll(MEMORY_PAIR)].map((match) => ({
    ramGb: Number(match[1]),
    storageGb: match[2] ? Number(match[2]) : Number(match[3]) * 1024,
  }));
  return [...new Map(pairs.map((pair) => [`${pair.ramGb}|${pair.storageGb}`, pair])).values()];
}

function listingIdentity(title: string): string {
  const firstPart = title.split("|")[0] ?? title;
  const memoryIndex = firstPart.search(MEMORY_PAIR);
  const withoutMemory = memoryIndex >= 0 ? firstPart.slice(0, memoryIndex) : firstPart;
  return normalizeProductName(
    withoutMemory
      .replace(/^\s*\[?\s*(?:new|baru)\s*\]?\s*/i, "")
      .replace(/\[\s*(?:official|offical)[^\]]*\]\s*$/i, "")
  );
}

function productAliases(product: OfferCatalogProduct): string[] {
  const brandModel = normalizeProductName(`${product.brand} ${product.model}`);
  const model = normalizeProductName(product.model);
  const aliases = new Set([brandModel, model]);
  const brand = normalizeProductName(product.brand);

  // Beberapa katalog menaruh Redmi/POCO sebagai brand, sedangkan judul toko
  // resmi menambahkan induk merek Xiaomi di depannya.
  if (brand === "redmi" || brand === "poco") aliases.add(`xiaomi ${brandModel}`);
  // iQOO berdiri sebagai merek sendiri, tetapi toko masih sering menulis
  // "vivo iQOO Z10".
  if (brand === "iqoo") aliases.add(`vivo ${brandModel}`);
  return [...aliases].filter(Boolean);
}

function matchCatalogProduct(
  title: string,
  products: readonly OfferCatalogProduct[]
): OfferCatalogProduct | null | "ambiguous" {
  const identity = listingIdentity(title);
  if (!identity) return null;
  const matches = products.filter((product) => productAliases(product).includes(identity));
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) return "ambiguous";

  // Toko sering menulis "Galaxy S23 5G" atau "Note 40 Pro 4G", sedangkan nama
  // GSMArena tanpa akhiran jaringan bila modelnya hanya satu versi. Akhiran
  // boleh dibuang hanya bila spesifikasi katalog menyatakan jaringan yang sama;
  // tanpa data jaringan, judul tetap dianggap tidak cocok.
  const network = identity.match(/ ([45])g$/)?.[1];
  if (!network) return null;
  const base = identity.slice(0, -3);
  const wants5G = network === "5";
  const fallback = products.filter(
    (product) => product.is5G === wants5G && productAliases(product).includes(base)
  );
  if (fallback.length === 1) return fallback[0]!;
  return fallback.length > 1 ? "ambiguous" : null;
}

/**
 * Memilih varian dasar hanya saat kesimpulannya tunggal dan konservatif.
 *
 * Listing seperti "Apple iPhone 17 Pro" biasanya menampilkan harga varian
 * penyimpanan terkecil. Inferensi ini hanya aman bila semua varian katalog
 * mempunyai RAM yang sama dan tepat satu varian memakai penyimpanan terkecil.
 * Produk dengan RAM campuran atau duplikat varian dasar tetap harus ditolak.
 */
function inferBaseVariant(
  product: OfferCatalogProduct
): OfferCatalogProduct["variants"][number] | undefined {
  if (product.variants.length < 2) return undefined;

  const ramOptions = new Set(product.variants.map((variant) => variant.ramGb));
  if (ramOptions.size !== 1) return undefined;

  const minimumStorage = Math.min(
    ...product.variants.map((variant) => variant.storageGb)
  );
  const candidates = product.variants.filter(
    (variant) => variant.storageGb === minimumStorage
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

type ResolvedListing =
  | {
      ok: true;
      product: OfferCatalogProduct;
      variant: OfferCatalogProduct["variants"][number];
      inferred: boolean;
    }
  | { ok: false; reason: string };

/** Judul listing → produk + varian katalog, atau alasan penolakan yang jelas. */
function resolveListingVariant(
  title: string,
  products: readonly OfferCatalogProduct[],
  { inferBase = true }: { inferBase?: boolean } = {}
): ResolvedListing {
  const product = matchCatalogProduct(title, products);
  if (product === "ambiguous") {
    return { ok: false, reason: "Nama produk cocok ke lebih dari satu produk katalog." };
  }
  if (!product) {
    return {
      ok: false,
      reason: "Model tidak cocok tepat dengan katalog; impor spesifikasi produknya lebih dulu atau tinjau nama model.",
    };
  }

  const pairs = memoryPairs(title);
  if (pairs.length > 1) {
    return {
      ok: false,
      reason: "Listing memuat beberapa varian; harga yang tampil tidak boleh ditebak untuk salah satunya.",
    };
  }

  const inferredBaseVariant =
    inferBase && pairs.length === 0 && product.variants.length > 1
      ? inferBaseVariant(product)
      : undefined;
  const variant =
    pairs.length === 1
      ? product.variants.find(
          (candidate) =>
            candidate.ramGb === pairs[0]!.ramGb &&
            candidate.storageGb === pairs[0]!.storageGb
        )
      : product.variants.length === 1
        ? product.variants[0]
        : inferredBaseVariant;

  if (!variant) {
    return {
      ok: false,
      reason:
        pairs.length === 0
          ? "Varian RAM/penyimpanan tidak disebutkan dan varian dasar tidak dapat ditentukan dengan aman."
          : `Varian ${pairs[0]!.ramGb}/${pairs[0]!.storageGb} GB tidak ada di katalog.`,
    };
  }
  return {
    ok: true,
    product,
    variant,
    inferred: inferredBaseVariant !== undefined && inferredBaseVariant.id === variant.id,
  };
}

function canonicalShopeeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      (hostname !== "shopee.co.id" && !hostname.endsWith(".shopee.co.id"))
    ) {
      return null;
    }
    url.hash = "";
    url.search = "";
    return url.href;
  } catch {
    return null;
  }
}

function inferredOfficialSeller(title: string, product: OfferCatalogProduct): string {
  if (!/(?:official|offical)\s*store/i.test(title)) return "";
  const model = normalizeProductName(product.model);
  if (model.startsWith("poco ") || normalizeProductName(product.brand) === "poco") {
    return "POCO Official Store";
  }
  return `${product.brand} Official Store`;
}

/** Label netral ketika scraper lama tidak menyimpan nama toko. */
function sellerFromShopeeUrl(value: string): string {
  try {
    const pathname = new URL(value).pathname;
    const legacyMatch = pathname.match(/-i\.(\d+)\.\d+\/?$/i);
    const productMatch = pathname.match(/\/product\/(\d+)\/\d+\/?$/i);
    const shopId = legacyMatch?.[1] ?? productMatch?.[1];
    return shopId ? `Toko Shopee ${shopId}` : "";
  } catch {
    return "";
  }
}

/**
 * Menormalkan dua format sekaligus:
 * - templat internal yang sudah mempunyai slug dan varian;
 * - ekspor mentah scraper Shopee, termasuk nama kolom CSS pada berkas lama.
 *
 * Pencocokan mentah sengaja exact dan konservatif. Harga listing multi-varian
 * tidak pernah disalin ke semua varian. Bila judul tidak menyebut memori,
 * importer hanya boleh memilih varian penyimpanan terkecil saat RAM semua
 * varian seragam dan kandidatnya tepat satu.
 */
export function prepareOfferRow(
  row: CsvRow,
  products: readonly OfferCatalogProduct[],
  defaults: { observedAt: string; sellerName?: string }
): PreparedOfferOutcome {
  if (Object.keys(row).some((key) => normalizedColumnName(key) === "slug")) {
    const withObservedAt = {
      ...row,
      observed_at: valueFrom(row, RAW_OBSERVED_COLUMNS) || defaults.observedAt,
    };
    const mapped = mapOfferRow(withObservedAt);
    return mapped.ok
      ? {
          ...mapped,
          format: "template",
          origin: "manual",
          inferredBaseVariant: false,
          image: null,
        }
      : { ...mapped, format: "template" };
  }

  const erafone = readErafoneListing(row);
  if (erafone) return prepareErafoneRow(erafone, products, defaults);

  const format = "shopee-scrape" as const;
  const title = valueFrom(row, RAW_TITLE_COLUMNS);
  const rawUrl = valueFrom(row, RAW_URL_COLUMNS);
  const label = title || rawUrl || "(baris Shopee tanpa judul)";
  if (!title) return { ok: false, label, reason: "Judul produk tidak ditemukan.", format };

  const url = canonicalShopeeUrl(rawUrl);
  if (!url) {
    return { ok: false, label, reason: "URL listing Shopee tidak valid atau bukan HTTPS.", format };
  }

  const resolved = resolveListingVariant(title, products);
  if (!resolved.ok) return { ok: false, label, reason: resolved.reason, format };
  const { product, variant: selectedVariant, inferred } = resolved;

  const sellerName =
    valueFrom(row, RAW_SELLER_COLUMNS) ||
    defaults.sellerName?.trim() ||
    inferredOfficialSeller(title, product) ||
    sellerFromShopeeUrl(url);
  if (!sellerName) {
    return {
      ok: false,
      label,
      reason: "Nama toko tidak tersedia. Tambahkan kolom seller_name atau isi nama toko default.",
      format,
    };
  }

  const parsed = offerRowSchema.safeParse({
    slug: product.slug,
    ramGb: selectedVariant.ramGb,
    storageGb: selectedVariant.storageGb,
    marketplace: "Shopee",
    sellerName,
    url,
    warranty: "",
    listingStatus: "active",
    // Tulisan Official Store pada judul belum cukup sebagai bukti verifikasi.
    sellerVerified: false,
    priceIdr: valueFrom(row, RAW_PRICE_COLUMNS),
    observedAt: valueFrom(row, RAW_OBSERVED_COLUMNS) || defaults.observedAt,
  });

  if (!parsed.success) {
    return {
      ok: false,
      label,
      reason: parsed.error.issues[0]?.message ?? "Baris Shopee tidak valid",
      format,
    };
  }
  return {
    ok: true,
    row: parsed.data,
    format,
    origin: "automatic",
    inferredBaseVariant: inferred,
    image: null,
  };
}

/**
 * Ekspor ekstensi browser dari halaman kategori erafone.com.
 *
 * Header-nya nama class CSS ("w-full href", "tracking-[0 2", ...) dan isinya
 * bergeser satu kolom ketika kartu produk tidak punya label promo. Karena itu
 * sel dibaca menurut ISI, bukan nama kolom: URL listing dan foto dikenali dari
 * host-nya, harga dari pola "Rp1.234.000", dan judul selalu sel tepat sebelum
 * harga. Harga coret, persen diskon, rating, dan label promo sengaja diabaikan:
 * yang dicatat hanya harga jual yang tampil.
 */
export type ErafoneListing = {
  url: string;
  imageUrl: string | null;
  /** Judul apa adanya, termasuk warna; dipakai sebagai label laporan. */
  title: string;
  /** Judul tanpa akhiran warna ("… 8/256GB - Black" → "… 8/256GB"). */
  matchTitle: string;
  priceText: string;
};

const ERAFONE_LISTING = /^https:\/\/(?:www\.)?erafone\.com\/produk\/[a-z0-9-]+\/?$/i;
const ERAFONE_IMAGE = /^https:\/\/cdnpro\.eraspace\.com\/media\/catalog\/product\//i;
const ERAFONE_PRICE = /^Rp\s?\d{1,3}(?:\.\d{3})+$/;

export function readErafoneListing(row: CsvRow): ErafoneListing | null {
  const cells = Object.values(row).map((value) => value.trim());
  const rawUrl = cells.find((value) => ERAFONE_LISTING.test(value));
  if (!rawUrl) return null;

  const priceIndex = cells.findIndex((value) => ERAFONE_PRICE.test(value));
  const before = priceIndex > 0 ? cells[priceIndex - 1]! : "";
  const title = /^https?:/i.test(before) ? "" : before;
  const url = new URL(rawUrl);
  url.hostname = "erafone.com";
  url.hash = "";
  url.search = "";

  return {
    url: url.href.replace(/\/$/, ""),
    imageUrl: cells.find((value) => ERAFONE_IMAGE.test(value)) ?? null,
    title,
    matchTitle: title.replace(/\s+-\s+.*$/, "").trim(),
    priceText: priceIndex >= 0 ? cells[priceIndex]! : "",
  };
}

function prepareErafoneRow(
  listing: ErafoneListing,
  products: readonly OfferCatalogProduct[],
  defaults: { observedAt: string }
): PreparedOfferOutcome {
  const format = "erafone-scrape" as const;
  const label = listing.title || listing.url;
  if (!listing.matchTitle) {
    return { ok: false, label, reason: "Judul produk Erafone tidak ditemukan di baris ini.", format };
  }
  if (!listing.priceText) {
    return { ok: false, label, reason: "Harga jual Erafone tidak ditemukan di baris ini.", format };
  }

  // Kartu Erafone tanpa RAM/penyimpanan tidak selalu menampilkan varian
  // termurah (contoh 2026-09-23: "iPhone 15 Pro" Rp20,99 jt, di atas
  // "iPhone 16 Pro" Rp17,49 jt), jadi varian dasar tidak disimpulkan.
  const resolved = resolveListingVariant(listing.matchTitle, products, { inferBase: false });
  if (!resolved.ok) {
    const noMemory = !memoryPairs(listing.matchTitle).length;
    return {
      ok: false,
      label,
      reason:
        noMemory && resolved.reason.startsWith("Varian RAM")
          ? "Judul Erafone tidak menyebut RAM/penyimpanan, dan harga kartunya belum tentu varian terkecil. Scrape halaman produknya per varian."
          : resolved.reason,
      format,
    };
  }

  const parsed = offerRowSchema.safeParse({
    slug: resolved.product.slug,
    ramGb: resolved.variant.ramGb,
    storageGb: resolved.variant.storageGb,
    marketplace: "Erafone",
    sellerName: "Erafone",
    url: listing.url,
    warranty: "",
    listingStatus: "active",
    // Erafone memang peritel resmi, tetapi badge terverifikasi tetap butuh
    // bukti yang dicatat admin (FR-05), bukan kesimpulan importer.
    sellerVerified: false,
    priceIdr: listing.priceText,
    observedAt: defaults.observedAt,
  });
  if (!parsed.success) {
    return {
      ok: false,
      label,
      reason: parsed.error.issues[0]?.message ?? "Baris Erafone tidak valid",
      format,
    };
  }

  return {
    ok: true,
    row: parsed.data,
    format,
    origin: "automatic",
    inferredBaseVariant: resolved.inferred,
    image: listing.imageUrl
      ? { url: listing.imageUrl, productId: resolved.product.id }
      : null,
  };
}

/** Isi templat CSV, dipakai tombol unduh di halaman impor. */
export function templatePenawaran(): string {
  const contoh = [
    "oppo-reno16-pro,12,256,Blibli,Toko Contoh,https://www.blibli.com/p/contoh,Garansi resmi Indonesia,active,tidak,7999000,2026-09-17T10:00:00+07:00",
    "oppo-reno16-pro,12,512,Blibli,Toko Contoh,https://www.blibli.com/p/contoh-512,Garansi resmi Indonesia,active,tidak,8999000,2026-09-17T10:00:00+07:00",
    "oppo-a6c,4,128,Tokopedia,Toko Lain,https://www.tokopedia.com/contoh,,active,tidak,,2026-09-17T10:00:00+07:00",
  ];
  return [OFFER_COLUMNS.join(","), ...contoh].join("\n") + "\n";
}

/** Header stabil yang sebaiknya dihasilkan scraper baru; kolom rating, sold,
 * dan image tetap boleh disimpan untuk audit, tetapi belum masuk model harga. */
export function templateShopeeScrape(): string {
  const columns = [
    "listing_url",
    "image_url",
    "title",
    "price_idr",
    "rating",
    "sold_text",
    "seller_name",
    "scraped_at",
  ];
  const example = [
    "https://shopee.co.id/contoh-i.123.456",
    "https://down-id.img.susercontent.com/file/contoh",
    '"Xiaomi Redmi Note 14 Pro 5G (8/256GB) | Official Store"',
    "4999000",
    "4.9",
    '"1RB+ terjual"',
    "Xiaomi Official Store",
    "2026-09-17T10:00:00+07:00",
  ];
  return `${columns.join(",")}\n${example.join(",")}\n`;
}
