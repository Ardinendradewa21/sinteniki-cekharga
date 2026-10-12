import { z } from "zod";

import type { CsvRow } from "@/lib/import/csv-parser";
import { normalizeColorName } from "@/lib/import/colors";
import { ALLOWED_IMAGE_HOSTS, IMAGE_HOST_ISSUE, safeHttpsImageUrl } from "@/lib/import/image-hosts";
import { readImageRights, type ImageRights } from "@/lib/import/image-rights";
import { CLEAR_TOKEN, OFFER_KEEPABLE_FIELDS } from "@/lib/import/patch-rules";

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
    z.iso.datetime({ offset: true, error: "Waktu pengamatan harga tidak valid" }).nullable()
  ),
  /**
   * Kolom yang selnya kosong. Untuk penawaran yang SUDAH ADA, nilainya tidak
   * ditimpa nilai bawaan (patch-rules.ts): garansi, status, dan badge
   * terverifikasi hasil suntingan admin tetap.
   */
  keepExisting: z.array(z.enum(OFFER_KEEPABLE_FIELDS)).default([]),
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
      image: ListingImageRef | null;
      /** Foto di baris ini tidak dipakai, beserta alasannya (harga tetap diproses). */
      imageIssue?: string;
      /** Warna listing di baris ini, apa adanya dari sumber; null = tidak disebut. */
      color: string | null;
      /**
       * Produknya cocok, tetapi ada alasan untuk memeriksa ulang (mis. nama
       * tanpa label jaringan padahal ada model saudara 4G/5G). Baris tetap
       * bisa diterapkan, tetapi tidak dicentang otomatis.
       */
      reviewNote: string | null;
    }
  | { ok: false; label: string; reason: string; format: OfferSourceFormat };

/**
 * Foto listing. `productId` null berarti produknya baru diketahui saat
 * dicocokkan lewat slug (templat); `rights` null berarti memakai pilihan form.
 */
export type ListingImageRef = {
  url: string;
  productId: string | null;
  rights: ImageRights | null;
  /** Warna yang ditampilkan foto (warna listing barisnya). */
  color: string | null;
};

/** Kolom foto listing di templat penawaran dan templat terpadu (nama dinormalkan). */
const LISTING_IMAGE_COLUMNS = ["image_url", "url_image", "url gambar", "link gambar", "marketplace_image_url", "product_image_url"];

/**
 * Foto listing dari baris templat: opsional, dan tidak pernah membuat baris
 * harga gagal. URL yang tidak diizinkan atau hak pakai yang tidak lengkap
 * hanya membuat fotonya dilewati, dengan alasan.
 */
export function readTemplateListingImage(row: CsvRow): { image: ListingImageRef | null; issue?: string } {
  const raw = valueFrom(row, LISTING_IMAGE_COLUMNS);
  if (!raw) return { image: null };
  const url = safeHttpsImageUrl(raw);
  if (!url) return { image: null, issue: IMAGE_HOST_ISSUE };
  const rights = readImageRights(valueFrom(row, ["image_usage_basis"]), valueFrom(row, ["image_usage_rights"]));
  if (!rights.ok) return { image: null, issue: rights.error };
  return { image: { url: url.href, productId: null, rights: rights.rights, color: readRowColor(row) } };
}

/** Kolom warna listing: `color` atau `warna`. */
export function readRowColor(row: CsvRow): string | null {
  return normalizeColorName(valueFrom(row, ["color", "warna"]));
}

/**
 * Marketplace yang host listing-nya pasti. Baris "Shopee" dengan tautan ke
 * situs lain (mis. tautan gambar yang salah tempel) ditolak, bukan disimpan
 * sebagai penawaran Shopee.
 */
const MARKETPLACE_HOSTS: readonly [RegExp, string, string][] = [
  [/shopee/i, "shopee.co.id", "Shopee"],
  [/tokopedia/i, "tokopedia.com", "Tokopedia"],
  [/lazada/i, "lazada.co.id", "Lazada"],
  [/blibli/i, "blibli.com", "Blibli"],
  [/tiktok/i, "tiktok.com", "TikTok Shop"],
  [/erafone/i, "erafone.com", "Erafone"],
];

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * URL listing templat yang dirapikan dan diperiksa: tautan gambar ditolak,
 * host harus cocok dengan marketplace yang dikenal, dan parameter tampilan
 * Shopee (?extraParams=…) dibuang supaya satu listing tidak tercatat dua kali.
 * URL yang tidak terbaca diteruskan apa adanya; validasi skema menolaknya.
 */
export function checkTemplateListingUrl(rawUrl: string, marketplace: string): { url: string } | { error: string } {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { url: rawUrl };
  }
  const hostname = url.hostname.toLowerCase();
  if (ALLOWED_IMAGE_HOSTS.has(hostname) || /\.(?:jpe?g|png|webp|gif|avif)$/i.test(url.pathname)) {
    return { error: "Kolom URL listing berisi tautan gambar, bukan halaman toko. Pindahkan ke kolom image_url." };
  }
  const expected = MARKETPLACE_HOSTS.find(([pattern]) => pattern.test(marketplace));
  if (expected && !hostMatches(hostname, expected[1])) {
    return { error: `URL listing bukan halaman ${expected[2]} (${hostname}), padahal marketplace-nya ${marketplace}.` };
  }
  if (hostMatches(hostname, "shopee.co.id")) {
    const canonical = canonicalShopeeUrl(url.href);
    if (canonical) return { url: canonical };
  }
  return { url: url.href };
}

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

  // Sel kosong = "tidak diubah" untuk penawaran yang sudah ada; `-` di kolom
  // garansi = "kosongkan" (patch-rules.ts).
  const keepExisting = (
    [
      ["warranty", get("warranty")],
      ["listing_status", get("listing_status")],
      ["seller_verified", get("seller_verified")],
    ] as const
  )
    .filter(([, value]) => value === "")
    .map(([field]) => field);

  const parsed = offerRowSchema.safeParse({
    slug: get("slug"),
    ramGb: get("ram_gb"),
    storageGb: get("storage_gb"),
    marketplace: get("marketplace"),
    sellerName: get("seller_name"),
    url: get("url"),
    warranty: get("warranty") === CLEAR_TOKEN ? "" : get("warranty"),
    listingStatus: get("listing_status"),
    sellerVerified: get("seller_verified"),
    priceIdr: get("price_idr"),
    observedAt: get("observed_at"),
    keepExisting,
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

/** Header berkas punya kolom ini (nama dinormalkan: huruf kecil, _ dan - jadi spasi). */
export function hasColumn(headers: readonly string[], name: string): boolean {
  const wanted = normalizedColumnName(name);
  return headers.some((header) => normalizedColumnName(header) === wanted);
}

/** Header hasil scraper Shopee: ada kolom judul DAN kolom URL listing. */
export function looksLikeShopeeHeaders(headers: readonly string[]): boolean {
  return (
    RAW_TITLE_COLUMNS.some((alias) => hasColumn(headers, alias)) &&
    RAW_URL_COLUMNS.some((alias) => hasColumn(headers, alias))
  );
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

/**
 * Indeks alias -> produk, dibangun sekali per daftar katalog. Tanpa indeks,
 * setiap baris membandingkan judulnya dengan SEMUA produk dan menghitung ulang
 * alias tiap produk: terukur 352 ms untuk 500 baris Shopee dengan 158 produk
 * (2026-10-10), dan tumbuh sebanding baris x produk. Dengan indeks, satu baris
 * cukup satu pencarian Map.
 */
const aliasIndexes = new WeakMap<readonly OfferCatalogProduct[], Map<string, OfferCatalogProduct[]>>();

function aliasIndex(products: readonly OfferCatalogProduct[]): Map<string, OfferCatalogProduct[]> {
  const cached = aliasIndexes.get(products);
  if (cached) return cached;
  const index = new Map<string, OfferCatalogProduct[]>();
  for (const product of products) {
    for (const alias of productAliases(product)) {
      const list = index.get(alias);
      if (list) list.push(product);
      else index.set(alias, [product]);
    }
  }
  aliasIndexes.set(products, index);
  return index;
}

function matchCatalogProduct(
  title: string,
  products: readonly OfferCatalogProduct[]
): OfferCatalogProduct | null | "ambiguous" {
  const identity = listingIdentity(title);
  if (!identity) return null;
  const index = aliasIndex(products);
  const matches = index.get(identity) ?? [];
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
  const fallback = (index.get(base) ?? []).filter((product) => product.is5G === wants5G);
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
      reviewNote: string | null;
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
    reviewNote: networkSiblingNote(title, product, products),
  };
}

/**
 * Nama tanpa label jaringan ("Redmi Note 17") cocok tepat dengan produk
 * katalog, padahal katalog juga punya saudaranya ("Redmi Note 17 4G"). Toko
 * sering membuang label jaringan, jadi listing itu bisa milik salah satunya.
 * Produknya tetap dipasangkan, tetapi diberi catatan untuk ditinjau.
 */
function networkSiblingNote(
  title: string,
  product: OfferCatalogProduct,
  products: readonly OfferCatalogProduct[]
): string | null {
  const identity = listingIdentity(title);
  if (/ [45]g$/.test(identity)) return null;
  const index = aliasIndex(products);
  for (const alias of productAliases(product)) {
    for (const suffix of [" 4g", " 5g"]) {
      const sibling = (index.get(`${alias}${suffix}`) ?? []).find((candidate) => candidate.id !== product.id);
      if (sibling) {
        return `Nama tanpa label jaringan dicocokkan ke ${product.brand} ${product.model}, padahal ada ${sibling.brand} ${sibling.model}. Pastikan listingnya memang model ini.`;
      }
    }
  }
  return null;
}

/**
 * Produk untuk baris templat yang menyebut nama (merek + model), bukan slug.
 * Memakai aturan pencocokan judul toko: akhiran 4G/5G hanya dibuang bila
 * jaringan di katalog sama, dan merek induk (Xiaomi untuk Redmi/POCO) dikenali.
 */
function resolveNamedProduct(
  name: string,
  products: readonly OfferCatalogProduct[]
): { product: OfferCatalogProduct; reviewNote: string | null } | { error: string } | null {
  const product = matchCatalogProduct(name, products);
  if (product === "ambiguous") return { error: `Nama "${name}" cocok ke lebih dari satu produk katalog; isi kolom slug.` };
  if (!product) return null;
  return { product, reviewNote: networkSiblingNote(name, product, products) };
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
    const format = "template" as const;
    const withObservedAt: CsvRow = {
      ...row,
      observed_at: valueFrom(row, RAW_OBSERVED_COLUMNS) || defaults.observedAt,
    };
    // Templat terpadu tanpa slug membawa nama produk; slug bentukan dari
    // nama hanya dipakai bila nama tidak cocok dengan katalog.
    let reviewNote: string | null = null;
    const productName = valueFrom(row, ["product_name"]);
    if (productName) {
      const named = resolveNamedProduct(productName, products);
      if (named && "error" in named) {
        return { ok: false, label: productName, reason: named.error, format };
      }
      if (named) {
        withObservedAt.slug = named.product.slug;
        reviewNote = named.reviewNote;
      }
    }
    const rawUrl = valueFrom(row, ["url"]);
    if (rawUrl) {
      const checked = checkTemplateListingUrl(rawUrl, valueFrom(row, ["marketplace"]));
      if ("error" in checked) {
        return { ok: false, label: productName || valueFrom(row, ["slug"]) || rawUrl, reason: checked.error, format };
      }
      withObservedAt.url = checked.url;
    }
    const mapped = mapOfferRow(withObservedAt);
    if (!mapped.ok) return { ...mapped, format };
    const listingImage = readTemplateListingImage(row);
    return {
      ...mapped,
      format,
      origin: "manual",
      inferredBaseVariant: false,
      image: listingImage.image,
      ...(listingImage.issue ? { imageIssue: listingImage.issue } : {}),
      color: readRowColor(row),
      reviewNote,
    };
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
    // Scraper tidak membawa garansi dan bukti verifikasi; suntingan admin tetap.
    keepExisting: ["warranty", "seller_verified"],
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
    color: readRowColor(row),
    reviewNote: resolved.reviewNote,
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
  /** Akhiran warna judul ("Black"), atau null. */
  color: string | null;
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
    color: normalizeColorName(title.match(/\s+-\s+(.+)$/)?.[1]),
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
    keepExisting: ["warranty", "seller_verified"],
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
      ? { url: listing.imageUrl, productId: resolved.product.id, rights: null, color: listing.color }
      : null,
    color: listing.color,
    reviewNote: resolved.reviewNote,
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
