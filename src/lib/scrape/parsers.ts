/**
 * Parser murni untuk fitur tarik data otomatis di admin.
 *
 * Tidak ada akses jaringan dan tidak ada import alias di modul ini, supaya
 * seluruh aturan penguraian bisa diuji langsung terhadap HTML/JSON asli.
 * Pengambilan datanya ada di `sources.ts`.
 *
 * Prinsip yang sama dengan importer CSV: yang tidak terbaca dengan yakin
 * dilaporkan sebagai temuan, bukan ditebak. Layar pratinjau admin menampilkan
 * setiap temuan sebelum apa pun disimpan.
 */

/* ------------------------------------------------------------ util teks */

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&thinsp;": " ",
  "&#36;": "$",
  "&#8364;": "€",
  "&#8377;": "₹",
  "&#163;": "£",
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

/** Isi sel HTML menjadi teks satu baris: `<br>` jadi spasi, tag dibuang. */
export function cellText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------- harga situs resmi */

export type OfficialPrice = {
  ramGb: number;
  storageGb: number;
  priceIdr: number;
};

export type OfficialPriceReading = {
  prices: OfficialPrice[];
  /** Potongan teks yang tidak bisa dipasangkan dengan yakin ke satu varian. */
  issues: string[];
};

const MIN_PRICE_IDR = 100_000;
const MAX_PRICE_IDR = 100_000_000;

/**
 * Harga di situs resmi vivo/iQOO berupa teks bebas yang ditulis manual, dan
 * formatnya tidak seragam antarproduk. Contoh nyata (2026-09-22):
 *
 *   "Rp2.799.000 (4+64)</br>Rp3.299.000 (4+128)"
 *   "Rp25.999.000 (16GB + 512GB)<br/>Rp29.999.000 (16GB + 1TB)"
 *   "4+64GB Rp1.599.000  /  4+128GB Rp1.799.000"   (urutan terbalik)
 *   "Rp17,999,000 (16+512)"   "Rp.3.499.000 (8+128)"   "3.699.000 (8+128)"
 *   "From Rp3.999.000 8+128/256"   (satu harga untuk dua varian: ambigu)
 *   "Rp4.299.000(128GB)"           (RAM tidak disebut)
 *
 * Setiap potongan menghasilkan paling banyak satu harga untuk satu varian.
 * Yang ambigu masuk `issues`, tidak dipaksakan.
 */
export function parseOfficialPrices(text: string | null | undefined): OfficialPriceReading {
  const prices: OfficialPrice[] = [];
  const issues: string[] = [];
  if (!text || !text.trim()) return { prices, issues };

  const segments = decodeEntities(text)
    .replace(/<\/?br\s*\/?>|<\/?a[^>]*>/gi, "|")
    .split(/\||\s\/\s/)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter((segment) => /\d/.test(segment));

  const seen = new Set<string>();
  for (const segment of segments) {
    const amount = segment.match(/(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+)(?!\d)/i);
    const priceIdr = amount ? Number(amount[1].replace(/[.,]/g, "")) : NaN;
    if (!Number.isFinite(priceIdr) || priceIdr < MIN_PRICE_IDR || priceIdr > MAX_PRICE_IDR) {
      issues.push(`Harga tidak terbaca: "${segment}"`);
      continue;
    }

    if (/\+\s*\d+\s*(?:GB)?\s*\/\s*\d+/i.test(segment)) {
      issues.push(`Satu harga untuk beberapa varian, tidak dipasangkan: "${segment}"`);
      continue;
    }

    const variant = segment.match(/(\d{1,2})\s*(?:GB)?\s*\+\s*(\d{1,4})\s*(GB|TB)?/i);
    if (!variant) {
      issues.push(`Varian RAM/penyimpanan tidak disebut: "${segment}"`);
      continue;
    }

    const ramGb = Number(variant[1]);
    const storageRaw = Number(variant[2]);
    const storageGb =
      variant[3]?.toUpperCase() === "TB" || storageRaw <= 2 ? storageRaw * 1024 : storageRaw;

    const key = `${ramGb}+${storageGb}`;
    if (seen.has(key)) {
      issues.push(`Varian ${key} muncul lebih dari sekali; hanya yang pertama dipakai.`);
      continue;
    }
    seen.add(key);
    prices.push({ ramGb, storageGb, priceIdr });
  }

  return { prices, issues };
}

/**
 * Harga yang benar-benar dipakai per varian: harga promo yang tertera
 * langsung di situs (tanpa syarat personal, PRD §7 butir 4) bila ada untuk
 * varian itu, selain itu harga normal.
 */
export function effectiveOfficialPrices(
  market: OfficialPriceReading,
  promotion: OfficialPriceReading
): (OfficialPrice & { isPromotion: boolean })[] {
  const promoByVariant = new Map(
    promotion.prices.map((price) => [`${price.ramGb}+${price.storageGb}`, price.priceIdr])
  );
  const variants = new Map<string, OfficialPrice & { isPromotion: boolean }>();
  for (const price of market.prices) {
    const key = `${price.ramGb}+${price.storageGb}`;
    const promo = promoByVariant.get(key);
    variants.set(key, {
      ...price,
      priceIdr: promo !== undefined && promo < price.priceIdr ? promo : price.priceIdr,
      isPromotion: promo !== undefined && promo < price.priceIdr,
    });
  }
  // Varian yang hanya muncul di harga promo tetap dicatat.
  for (const price of promotion.prices) {
    const key = `${price.ramGb}+${price.storageGb}`;
    if (!variants.has(key)) variants.set(key, { ...price, isPromotion: true });
  }
  return [...variants.values()];
}

/**
 * Aksesori, voucher, dan perangkat non-ponsel di daftar situs resmi. Diuji
 * terhadap daftar asli (2026-09-22): OPPO memuat "Enco Air5", Xiaomi memuat
 * "33W Power Bank", Samsung memuat "Pre-Registration eVoucher".
 */
export function looksLikeAccessory(name: string): boolean {
  return /\b(buds?|earbuds|enco|tws|watch|cooler|clip|sleeve|wireless|vision|x?pad|charger|cable|case|band|earphones?|headphones?|power\s?bank|speaker|voucher|e-?voucher|reservation|pre-?registration|router|monitor|scale|vacuum|scooter|tv)\b/i.test(
    name
  );
}

/* ------------------------------------------------ pencocokan nama model */

export type NetworkTag = "4g" | "5g" | null;

export type ModelKey = { base: string; network: NetworkTag };

/**
 * Kunci pencocokan nama antar-sumber. Situs resmi menulis "Y19sGT 5G" dan
 * "Z11" (di situs iQOO), GSMArena menulis "Y19s GT" dan "iQOO Z11". Kunci
 * dasarnya dibuat tanpa spasi, tanpa kata merek, dan tanpa label jaringan;
 * label jaringan disimpan terpisah karena "V60 Lite" dan "V60 Lite 5G" memang
 * dua produk berbeda.
 */
export function modelKey(
  name: string,
  options: { brandWords?: readonly string[]; prefix?: string } = {}
): ModelKey {
  const lower = decodeEntities(name).toLowerCase();
  const network: NetworkTag = /\b5g\b/.test(lower) ? "5g" : /\b4g\b/.test(lower) ? "4g" : null;
  // "+" adalah bagian nama model ("Galaxy S26+" bukan "Galaxy S26"), jadi
  // disamakan dengan kata "plus" sebelum tanda baca dibuang.
  let base = lower.replace(/\+/g, " plus ").replace(/\b[45]g\b/g, " ");
  for (const word of options.brandWords ?? []) {
    base = base.replace(new RegExp(`\\b${word}\\b`, "g"), " ");
  }
  base = base.replace(/[^a-z0-9]+/g, "");
  // Situs iQOO menulis "Z11", GSMArena menulis "iQOO Z11".
  if (options.prefix && !base.startsWith(options.prefix)) base = `${options.prefix}${base}`;
  return { base, network };
}

/** Perangkat non-ponsel di daftar GSMArena atau situs resmi. */
export function looksLikeNonPhone(name: string): boolean {
  // "Xpad 30 Pro" (Infinix) dan "iPad" sama-sama tablet.
  return /\b([ix]?pad|tab|watch|band|buds?|vision|tv|laptop|book)\b/i.test(name);
}

/* ------------------------------------------ adapter harga situs resmi */

/** Produk mentah dari situs resmi, sebelum diubah menjadi LineupItem. */
export type OfficialProductRaw = {
  id: string;
  name: string;
  url: string;
  prices: (OfficialPrice & { isPromotion: boolean; inStock?: boolean; url?: string })[];
  /** Harga yang penyimpanannya diketahui tetapi RAM-nya tidak (Samsung, Apple). */
  storageOnlyPrices: { storageGb: number; priceIdr: number; isPromotion: boolean; inStock?: boolean; url?: string }[];
  /**
   * "Harga mulai" yang tidak menyebut varian sama sekali (Infinix). Tidak
   * pernah dipasangkan otomatis: admin yang memilih variannya di pratinjau,
   * atau harganya tidak disimpan.
   */
  unassignedPrices: { priceIdr: number; isPromotion: boolean; url?: string }[];
  priceIssues: string[];
};

type ShopifyProduct = {
  handle: string;
  title: string;
  product_type?: string | null;
  variants?: { title?: string; option1?: string | null; option2?: string | null; option3?: string | null; price?: string; compare_at_price?: string | null; available?: boolean }[];
};

/**
 * Produk iPhone di Digimap (Shopify, `products.json`). Setiap kombinasi warna x
 * kapasitas adalah produk tersendiri berjudul "iPhone 17 Pro 256GB Cosmic
 * Orange" atau "iPhone 17e" dengan opsi `size: 512GB`.
 *
 * - RAM tidak pernah disebut (Apple tidak mempublikasikannya), jadi semua harga
 *   masuk `storageOnlyPrices` dan dipasangkan ke varian GSMArena nanti.
 * - Beda warna bisa beda harga: dipakai harga terendah dari warna yang
 *   TERSEDIA; bila semua warna habis, harga terendahnya dicatat dengan
 *   `inStock: false` sehingga tidak menjadi harga aktif (PRD §7 butir 2).
 * - Aksesori dan AppleCare dilewati.
 */
export function parseDigimapProducts(products: unknown): OfficialProductRaw[] {
  if (!Array.isArray(products)) return [];
  const excluded = /applecare|care\+|case|bumper|wallet|glass|protector|cable|adapter|magsafe|charger|band|strap|film|sleeve|pouch/i;

  type Entry = { storageGb: number; priceIdr: number; isPromotion: boolean; inStock: boolean; url: string };
  const models = new Map<string, Entry[]>();

  for (const product of products as ShopifyProduct[]) {
    if (!/^iphone\b/i.test(product.title ?? "") || excluded.test(`${product.title} ${product.product_type ?? ""}`)) continue;
    const model = product.title.replace(/\s+\d+\s*(GB|TB)\b.*$/i, "").replace(/\s+/g, " ").trim();

    for (const variant of product.variants ?? []) {
      const size = [variant.option1, variant.option2, variant.option3, variant.title, product.title]
        .join(" ")
        .match(/(\d+)\s*(GB|TB)\b/i);
      const price = validPrice(variant.price);
      if (!size || price === null) continue;
      const compareAt = validPrice(variant.compare_at_price);
      const list = models.get(model) ?? [];
      list.push({
        storageGb: Number(size[1]) * (size[2].toUpperCase() === "TB" ? 1024 : 1),
        priceIdr: price,
        isPromotion: compareAt !== null && price < compareAt,
        inStock: variant.available === true,
        url: `https://www.digimap.co.id/products/${encodeURIComponent(product.handle)}`,
      });
      models.set(model, list);
    }
  }

  return [...models.entries()].map(([name, entries]) => {
    const byStorage = new Map<number, Entry>();
    for (const entry of entries) {
      const current = byStorage.get(entry.storageGb);
      // Yang tersedia selalu menang atas yang habis; di antara yang setara, termurah.
      const better =
        !current ||
        (entry.inStock && !current.inStock) ||
        (entry.inStock === current.inStock && entry.priceIdr < current.priceIdr);
      if (better) byStorage.set(entry.storageGb, entry);
    }
    return {
      id: `digimap:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      url: "https://www.digimap.co.id/pages/view-all-iphone",
      prices: [],
      storageOnlyPrices: [...byStorage.values()].sort((a, b) => a.storageGb - b.storageGb),
      unassignedPrices: [],
      priceIssues: [],
    };
  });
}

/** Harga terendah per varian lintas warna; varian sama beda warna = satu varian. */
function collapseByVariant<T extends { priceIdr: number }>(entries: { key: string; value: T }[]): T[] {
  const best = new Map<string, T>();
  for (const { key, value } of entries) {
    const current = best.get(key);
    if (!current || value.priceIdr < current.priceIdr) best.set(key, value);
  }
  return [...best.values()];
}

function validPrice(value: unknown): number | null {
  const price = Math.round(Number(value));
  return Number.isFinite(price) && price >= MIN_PRICE_IDR && price <= MAX_PRICE_IDR ? price : null;
}

/** "8+256G", "12+1T", "8 GB + 256 GB" -> RAM dan penyimpanan (GB). */
export function parseMemoryPair(text: string): { ramGb: number; storageGb: number } | null {
  const match = text.match(/(\d{1,2})\s*(?:GB?)?\s*\+\s*(\d{1,4})\s*(TB?|GB?)?/i);
  if (!match) return null;
  const storage = Number(match[2]);
  const isTb = /^t/i.test(match[3] ?? "") || storage <= 2;
  return { ramGb: Number(match[1]), storageGb: isTb ? storage * 1024 : storage };
}

/** Kode produk OPPO dari halaman www.oppo.com/id/smartphones/ (HTML statis). */
export function parseOppoProductCodes(html: string): string[] {
  return [...new Set([...html.matchAll(/\.P\.(P\d{6,8})\b/g)].map((match) => match[1]))];
}

type OppoProduct = {
  productCode: string;
  productName: string;
  productDetailUrl: string | null;
  skuList?: { skuName: string; salePrice: number | null; nowPrice: number | null; saleStatus: number }[];
};

/**
 * Respons `mall/product/page/list/price` OPPO. Harga yang dipakai `nowPrice`
 * (harga jual yang tampil, sudah termasuk potongan langsung), dengan
 * `salePrice` sebagai pembanding promo. Paket bundling ("Eco Pack",
 * "(Hadiah ...)") dilewati karena bukan harga ponsel saja.
 */
export function parseOppoPriceResponse(json: unknown): OfficialProductRaw[] {
  const data = (json as { data?: OppoProduct[] })?.data;
  if (!Array.isArray(data)) return [];
  const bundle = /\b(pack|bundle|paket|hadiah|gift)\b/i;
  const seen = new Set<string>();

  return data
    .filter((product) => !bundle.test(product.productName) && !seen.has(product.productCode) && seen.add(product.productCode))
    .map((product) => {
      const issues: string[] = [];
      const entries = (product.skuList ?? [])
        .filter((sku) => sku.saleStatus === 1 && !bundle.test(sku.skuName))
        .flatMap((sku) => {
          const memory = parseMemoryPair(sku.skuName);
          const now = validPrice(sku.nowPrice);
          const sale = validPrice(sku.salePrice);
          const price = now ?? sale;
          if (!memory || price === null) {
            issues.push(`SKU tidak terbaca: "${sku.skuName}"`);
            return [];
          }
          return [{ key: `${memory.ramGb}+${memory.storageGb}`, value: { ...memory, priceIdr: price, isPromotion: sale !== null && price < sale } }];
        });
      return {
        id: product.productCode,
        name: product.productName.trim(),
        url: product.productDetailUrl ?? "https://www.oppo.com/id/smartphones/",
        prices: collapseByVariant(entries),
        storageOnlyPrices: [],
        unassignedPrices: [],
        priceIssues: issues,
      };
    });
}

type SamsungModel = {
  modelCode: string;
  displayName: string;
  pdpUrl?: string | null;
  price?: number | string | null;
  promotionPrice?: number | string | null;
  isComingSoon?: string | null;
  fmyChipList?: { fmyChipName?: string | null; fmyChipType?: string | null }[] | null;
};
type SamsungFamily = { familyId: string | number; fmyMarketingName: string; modelList?: SamsungModel[] };

/**
 * Respons `searchapi.samsung.com/v6/front/b2c/product/finder`. Satu keluarga
 * produk punya banyak model (warna x memori). Chip memori hanya menyebut SATU
 * angka: RAM ("8 GB") atau penyimpanan ("512 GB"). Penyimpanan juga tertulis
 * di URL ("...-256gb-sm-..."). Bila RAM tidak disebut, harganya disimpan
 * sebagai `storageOnlyPrices` dan baru dipasangkan setelah varian GSMArena
 * diketahui.
 */
export function parseSamsungFinderResponse(json: unknown): OfficialProductRaw[] {
  const raw = (json as { response?: { resultData?: { productList?: SamsungFamily[] } } })?.response?.resultData?.productList;
  if (!Array.isArray(raw)) return [];

  // "Galaxy Z Fold8 (Samsung.com only)" adalah warna eksklusif dari ponsel
  // yang sama, bukan model lain. Digabung ke model dasarnya supaya tidak
  // muncul dua kali dan harganya tidak terpecah.
  const exclusive = /\s*\(\s*samsung\.com only\s*\)\s*$/i;
  const grouped = new Map<string, SamsungFamily>();
  for (const family of raw) {
    const name = family.fmyMarketingName.replace(exclusive, "").trim();
    const existing = grouped.get(name);
    if (existing) {
      existing.modelList = [...(existing.modelList ?? []), ...(family.modelList ?? [])];
      if (!exclusive.test(family.fmyMarketingName)) existing.familyId = family.familyId;
    } else {
      grouped.set(name, { ...family, fmyMarketingName: name, modelList: [...(family.modelList ?? [])] });
    }
  }
  const list = [...grouped.values()];

  return list.map((family) => {
    const issues: string[] = [];
    const full: { key: string; value: OfficialPrice & { isPromotion: boolean } }[] = [];
    const storageOnly: { key: string; value: { storageGb: number; priceIdr: number; isPromotion: boolean } }[] = [];
    let url: string | null = null;

    for (const model of family.modelList ?? []) {
      const regular = validPrice(model.price);
      const promo = validPrice(model.promotionPrice);
      const price = promo ?? regular;
      if (price === null) continue; // belum dijual / tanpa harga
      if (!url && model.pdpUrl) url = new URL(model.pdpUrl, "https://www.samsung.com").href;

      const chips = (model.fmyChipList ?? []).map((chip) => chip.fmyChipName ?? "").join(" ");
      const sizes = [...`${chips} ${model.pdpUrl ?? ""}`.matchAll(/(\d{1,4})\s*-?\s*(gb|tb)\b/gi)].map((match) =>
        Number(match[1]) * (match[2].toLowerCase() === "tb" ? 1024 : 1)
      );
      const storageGb = Math.max(0, ...sizes.filter((size) => size >= 32));
      const ramGb = sizes.find((size) => size > 0 && size <= 24) ?? null;
      const isPromotion = promo !== null && regular !== null && promo < regular;

      if (!storageGb) {
        issues.push(`Kapasitas tidak terbaca: ${model.displayName} (${model.modelCode})`);
      } else if (ramGb) {
        full.push({ key: `${ramGb}+${storageGb}`, value: { ramGb, storageGb, priceIdr: price, isPromotion } });
      } else {
        storageOnly.push({ key: String(storageGb), value: { storageGb, priceIdr: price, isPromotion } });
      }
    }

    return {
      id: String(family.familyId),
      name: family.fmyMarketingName.trim(),
      url: url ?? "https://www.samsung.com/id/smartphones/all-smartphones/",
      prices: collapseByVariant(full),
      storageOnlyPrices: collapseByVariant(storageOnly),
      unassignedPrices: [],
      priceIssues: issues,
    };
  });
}

type XiaomiEntry = {
  product: { id: string; name: string; item_link?: string | null };
  commodity?: { name?: string; second_spec_value?: string; sales_price?: string | number; market_price?: string | number; is_sale?: number; is_combo?: number }[];
};

type InfinixItem = {
  id?: number | string;
  sku?: string;
  name?: string;
  product_url?: string;
  is_available?: number;
  prices?: {
    final_price?: { minimal_price?: number | string | null; maximal_price?: number | string | null };
    promotion_price?: { minimal_price?: number | string | null };
    old_price?: { amount?: number | string | null };
  };
};

/**
 * Respons `id.infinixmobility.com/api/V1/xpark-app/app-products`.
 *
 * Situs Infinix Indonesia HANYA menerbitkan "harga mulai" per model:
 * `minimal_price` tanpa rincian RAM/penyimpanan, halaman produknya tidak
 * memuat harga sama sekali, dan GraphQL toko Magento-nya dimatikan (HTTP 404,
 * diperiksa 2026-09-23). Karena itu harganya masuk `unassignedPrices` dan
 * variannya ditentukan admin di pratinjau, bukan ditebak di sini.
 */
export function parseInfinixProducts(json: unknown): OfficialProductRaw[] {
  const items = (json as { data?: { category?: { items?: InfinixItem[] } } })?.data?.category?.items;
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    const name = (item.name ?? "").trim();
    if (!name) return [];
    const price =
      validPrice(item.prices?.final_price?.minimal_price) ??
      validPrice(item.prices?.promotion_price?.minimal_price);
    const oldPrice = validPrice(item.prices?.old_price?.amount);
    const url = item.product_url ?? "";
    return [
      {
        id: String(item.sku ?? item.id ?? name),
        name,
        url,
        prices: [],
        storageOnlyPrices: [],
        unassignedPrices:
          price === null ? [] : [{ priceIdr: price, isPromotion: oldPrice !== null && price < oldPrice, url: url || undefined }],
        priceIssues:
          price === null ? ["Situs Infinix tidak menampilkan harga untuk model ini."] : [],
      },
    ];
  });
}

/** Respons `go.buy.mi.co.id/id/search/product-list` Xiaomi (harga per SKU). */
export function parseXiaomiProductList(json: unknown): { products: OfficialProductRaw[]; total: number } {
  const provider = (json as { data?: { data_provider?: { product_total_count?: number; data?: { product_list?: XiaomiEntry[] } } } })?.data?.data_provider;
  const list = provider?.data?.product_list;
  if (!Array.isArray(list)) return { products: [], total: 0 };

  const products = list.map((entry) => {
    const issues: string[] = [];
    const entries = (entry.commodity ?? [])
      .filter((sku) => sku.is_sale !== 0 && sku.is_combo !== 1)
      .flatMap((sku) => {
        const memory = parseMemoryPair(sku.second_spec_value ?? sku.name ?? "");
        const sale = validPrice(sku.sales_price);
        const market = validPrice(sku.market_price);
        if (!memory || sale === null) {
          issues.push(`SKU tidak terbaca: "${sku.name ?? sku.second_spec_value ?? "?"}"`);
          return [];
        }
        return [{ key: `${memory.ramGb}+${memory.storageGb}`, value: { ...memory, priceIdr: sale, isPromotion: market !== null && sale < market } }];
      });
    return {
      id: entry.product.id,
      name: entry.product.name.trim(),
      url: entry.product.item_link ?? "https://www.mi.co.id/id/product-list/phone/",
      prices: collapseByVariant(entries),
      storageOnlyPrices: [],
      unassignedPrices: [],
      priceIssues: issues,
    };
  });
  return { products, total: provider?.product_total_count ?? products.length };
}

export type GsmarenaListItem = { name: string; path: string };

/** Daftar model di halaman merek GSMArena (`vivo-phones-98.php`, dst.). */
export function parseBrandListPage(html: string): {
  items: GsmarenaListItem[];
  nextPages: string[];
} {
  const items = [
    ...html.matchAll(
      // Tanda kurung sah di path GSMArena: "apple_iphone_se_(2022)-11410.php".
      /<li><a href="([a-z0-9_()]+-\d+\.php)">[\s\S]*?<strong><span>([\s\S]*?)<\/span><\/strong>/g
    ),
  ].map((match) => ({ path: match[1], name: cellText(match[2]) }));

  const nextPages = [
    ...new Set(
      [...html.matchAll(/href="([a-z0-9]+-phones-f-\d+-0-p\d+\.php)"/g)].map((match) => match[1])
    ),
  ];
  return { items, nextPages };
}

/**
 * Memilih kandidat GSMArena untuk satu nama di situs resmi.
 *
 * `siblingHas5g`: situs resmi juga memuat varian "... 5G" dengan nama dasar
 * yang sama. Dalam kasus itu nama tanpa label hampir selalu versi 4G, dan
 * GSMArena menamainya "... 4G".
 */
export function pickGsmarenaCandidate(
  official: ModelKey,
  candidates: (GsmarenaListItem & { key: ModelKey })[],
  siblingHas5g: boolean
): { chosen: GsmarenaListItem | null; alternatives: GsmarenaListItem[] } {
  const same = candidates.filter((candidate) => candidate.key.base === official.base);
  if (same.length === 0) return { chosen: null, alternatives: [] };

  const rank = (candidate: (typeof same)[number]): number => {
    const tag = candidate.key.network;
    if (official.network === "5g") return tag === "5g" ? 0 : tag === null ? 1 : 3;
    if (official.network === "4g") return tag === "4g" ? 0 : tag === null ? 2 : 3;
    if (siblingHas5g) return tag === "4g" ? 0 : tag === null ? 1 : 2;
    return tag === null ? 0 : tag === "5g" ? 1 : 2;
  };

  const sorted = [...same].sort((a, b) => rank(a) - rank(b));
  const strip = ({ name, path }: GsmarenaListItem) => ({ name, path });
  return { chosen: strip(sorted[0]), alternatives: sorted.slice(1).map(strip) };
}

/* ---------------------------------------- halaman spesifikasi GSMArena */

/**
 * Kolom keluaran = kolom CSV GSMArena yang sudah dibaca importer
 * (`mapRow` di src/lib/import/gsmarena.ts), dengan urutan yang sama seperti
 * berkas dataset. Kolom SAR, label energi EU, dan benchmark sengaja tidak
 * diambil (lihat komentar productSpecsSchema).
 */
export const SPEC_COLUMNS = [
  "brand",
  "model_name",
  "url",
  "image_url",
  "device_type",
  "status_raw",
  "announced",
  "network_technology",
  "dimensions_raw",
  "weight_raw",
  "build",
  "sim",
  "ip_rating",
  "display_type_raw",
  "display_size_inches",
  "display_resolution_raw",
  "refresh_rate_hz",
  "display_protection",
  "os",
  "chipset",
  "cpu_raw",
  "gpu",
  "memory_card_slot",
  "memory_variants_raw",
  "memory_variants_summary",
  "main_camera_count",
  "main_camera_raw",
  "selfie_camera_raw",
  "loudspeaker",
  "jack_3_5mm",
  "wlan",
  "bluetooth",
  "gps",
  "nfc",
  "usb",
  "sensors",
  "battery_type_raw",
  "battery_capacity_mah",
  "charging",
  "colors",
  "models_list",
  "price_raw",
] as const;

export type SpecRow = Record<(typeof SPEC_COLUMNS)[number], string>;

function dataSpec(html: string, name: string): string {
  const match = html.match(
    new RegExp(`data-spec="${name}"[^>]*>([\\s\\S]*?)</(?:td|span|div|h1)>`)
  );
  return match ? cellText(match[1]) : "";
}

/** Sel `nfo` tepat setelah label `ttl` tertentu, untuk baris tanpa data-spec. */
function afterLabel(html: string, label: string): string {
  const match = html.match(
    new RegExp(`>${label}</a>\\s*</td>\\s*<td class="nfo">([\\s\\S]*?)</td>`)
  );
  return match ? cellText(match[1]) : "";
}

/** Refresh rate layar, bukan frekuensi PWM ("144Hz, 2160Hz PWM" -> 144). */
export function refreshRate(displayType: string): string {
  const values = [...displayType.matchAll(/(\d{2,3})\s*Hz(?!\s*PWM)/gi)]
    .map((match) => Number(match[1]))
    .filter((hz) => hz >= 30 && hz <= 240);
  return values.length > 0 ? String(Math.max(...values)) : "";
}

/** "256GB 8GB RAM, 1TB 16GB RAM" -> "256GB/8GB; 1024GB/16GB" (format dataset). */
export function variantsSummary(internalMemory: string): string {
  return [...internalMemory.matchAll(/(\d+)\s*(GB|TB)\s+(\d+)\s*GB\s*RAM/gi)]
    .map((match) => {
      const storage = Number(match[1]) * (match[2].toUpperCase() === "TB" ? 1024 : 1);
      return `${storage}GB/${match[3]}GB`;
    })
    .join("; ");
}

export function parseSpecPage(
  html: string,
  path: string,
  /** Nama merek seperti di GSMArena ("Samsung", "Oppo", "vivo"). */
  brand: string
): { row: SpecRow; issues: string[] } {
  const issues: string[] = [];
  const title = html.match(/data-spec="modelname"[^>]*>([\s\S]*?)<\/h1>/);
  const modelName = title ? cellText(title[1]) : "";
  if (!modelName) issues.push("Nama model tidak ditemukan di halaman GSMArena.");

  const displayType = dataSpec(html, "displaytype");
  const internalMemory = dataSpec(html, "internalmemory");
  const battery = dataSpec(html, "batdescription1");
  const image = html.match(/specs-photo-main">\s*<a[^>]*>\s*<img[^>]*src=["']?([^"'\s>]+)/);
  const cameraCount = html.match(
    /<td class="ttl"><a[^>]*>(Single|Dual|Triple|Quad|Penta)<\/a><\/td>\s*<td class="nfo" data-spec="cam1modules"/
  );

  const row: SpecRow = {
    brand,
    model_name: modelName,
    url: path,
    image_url: image ? image[1] : "",
    device_type: looksLikeNonPhone(modelName) ? "tablet" : "phone",
    status_raw: dataSpec(html, "status"),
    announced: dataSpec(html, "year"),
    network_technology: dataSpec(html, "nettech"),
    dimensions_raw: dataSpec(html, "dimensions"),
    weight_raw: dataSpec(html, "weight"),
    build: dataSpec(html, "build"),
    sim: dataSpec(html, "sim"),
    ip_rating: dataSpec(html, "bodyother").match(/\bIP\d{2}K?\b/i)?.[0].toUpperCase() ?? "",
    display_type_raw: displayType,
    display_size_inches: dataSpec(html, "displaysize").match(/^(\d+(?:\.\d+)?)/)?.[1] ?? "",
    display_resolution_raw: dataSpec(html, "displayresolution"),
    refresh_rate_hz: refreshRate(displayType),
    display_protection: dataSpec(html, "displayprotection"),
    os: dataSpec(html, "os"),
    chipset: dataSpec(html, "chipset"),
    cpu_raw: dataSpec(html, "cpu"),
    gpu: dataSpec(html, "gpu"),
    memory_card_slot: dataSpec(html, "memoryslot"),
    memory_variants_raw: internalMemory,
    memory_variants_summary: variantsSummary(internalMemory),
    main_camera_count: cameraCount ? cameraCount[1] : "",
    main_camera_raw: dataSpec(html, "cam1modules"),
    selfie_camera_raw: dataSpec(html, "cam2modules"),
    loudspeaker: afterLabel(html, "Loudspeaker"),
    jack_3_5mm: afterLabel(html, "3.5mm jack"),
    wlan: dataSpec(html, "wlan"),
    bluetooth: dataSpec(html, "bluetooth"),
    gps: dataSpec(html, "gps"),
    nfc: dataSpec(html, "nfc"),
    usb: dataSpec(html, "usb"),
    sensors: dataSpec(html, "sensors"),
    battery_type_raw: battery,
    battery_capacity_mah: battery.match(/(\d{3,5})\s*mAh/i)?.[1] ?? "",
    charging: afterLabel(html, "Charging"),
    colors: dataSpec(html, "colors"),
    models_list: dataSpec(html, "models"),
    price_raw: dataSpec(html, "price"),
  };

  if (!row.memory_variants_summary) {
    issues.push("Kombinasi RAM/penyimpanan tidak terbaca dari GSMArena.");
  }
  if (!row.image_url) issues.push("Foto produk tidak ditemukan di halaman GSMArena.");
  return { row, issues };
}

/** Halaman tantangan anti-bot (Cloudflare Turnstile) yang TIDAK boleh ditembus. */
export function isBotChallenge(html: string): boolean {
  return /Turnstile check|challenges\.cloudflare\.com|cf-chl-|Just a moment\.\.\./i.test(html);
}

/* ---------------------------------------------------------------- CSV */

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV RFC 4180, dibaca parser impor yang sama dengan unggahan manual. */
export function toCsv(columns: readonly string[], rows: Record<string, string | number>[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column] ?? "")).join(","));
  return `${lines.join("\n")}\n`;
}
