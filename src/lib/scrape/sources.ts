import "server-only";

import {
  effectiveOfficialPrices,
  isBotChallenge,
  looksLikeAccessory,
  looksLikeNonPhone,
  modelKey,
  parseBrandListPage,
  parseDigimapProducts,
  parseInfinixProducts,
  parseOfficialPrices,
  parseOppoPriceResponse,
  parseOppoProductCodes,
  parseSamsungFinderResponse,
  parseSpecPage,
  parseXiaomiProductList,
  pickGsmarenaCandidate,
  type GsmarenaListItem,
  type ModelKey,
  type OfficialProductRaw,
} from "@/lib/scrape/parsers";
import type { LineupItem, ScrapeBrand } from "@/lib/scrape/types";

/**
 * Pengambilan data untuk fitur tarik data otomatis.
 *
 * Aturan sopan yang dipegang, karena kita tamu di situs orang lain:
 *
 * - User-Agent jujur menyebut diri bot CekHarga, tidak menyamar jadi browser.
 * - Jeda minimum per host dan permintaan diantrikan satu per satu. GSMArena
 *   diberi jeda paling panjang karena halamannya berat dan dilindungi anti-bot.
 * - Halaman tantangan anti-bot (Cloudflare Turnstile) TIDAK ditembus. Begitu
 *   terdeteksi, proses berhenti dengan pesan jelas. Pencarian GSMArena
 *   (`results.php3`) sudah dilindungi Turnstile, jadi pencocokan nama memakai
 *   halaman daftar merek yang terbuka untuk umum.
 * - Hanya host yang ada di daftar izin yang boleh dihubungi, dan path GSMArena
 *   divalidasi polanya, supaya aksi admin ini tidak bisa dipakai untuk
 *   meminta URL sembarang (SSRF).
 */

const USER_AGENT = "Mozilla/5.0 (compatible; CekHargaBot/1.0; admin-triggered catalog import)";
const TIMEOUT_MS = 20_000;

const MIN_INTERVAL_MS: Record<string, number> = {
  "www.gsmarena.com": 3_000,
  "www.vivo.com": 1_000,
  "www.iqoo.com": 1_000,
  "www.oppo.com": 1_000,
  "opsg-gateway-sg.oppo.com": 1_000,
  "searchapi.samsung.com": 1_000,
  "go.buy.mi.co.id": 1_000,
  "www.digimap.co.id": 1_000,
  "id.infinixmobility.com": 1_000,
};

export class ScrapeBlockedError extends Error {}
export class ScrapeSourceError extends Error {}

/** Antrean per host: permintaan berikutnya menunggu jeda dari yang sebelumnya. */
const hostQueues = new Map<string, Promise<number>>();

async function politeFetch(url: URL, init: RequestInit = {}): Promise<string> {
  const minInterval = MIN_INTERVAL_MS[url.hostname];
  if (minInterval === undefined) {
    throw new ScrapeSourceError(`Host ${url.hostname} tidak ada di daftar izin.`);
  }

  const previous = hostQueues.get(url.hostname) ?? Promise.resolve(0);
  const turn = previous.then(async (lastAt) => {
    const wait = lastAt + minInterval - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    return Date.now();
  });
  // Rantai antrean tidak boleh putus walau satu permintaan gagal.
  hostQueues.set(url.hostname, turn.catch(() => Date.now()));
  await turn;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[scrape] permintaan gagal:", url.href, error);
    throw new ScrapeSourceError(`Tidak bisa menghubungi ${url.hostname}.`);
  }

  const body = await response.text();
  if (response.status === 429 || response.status === 403 || isBotChallenge(body)) {
    throw new ScrapeBlockedError(
      `${url.hostname} meminta verifikasi anti-bot atau membatasi akses. Proses dihentikan; coba lagi nanti, jangan dipaksa.`
    );
  }
  if (!response.ok) {
    throw new ScrapeSourceError(`${url.hostname} membalas HTTP ${response.status}.`);
  }
  return body;
}

async function politeJson(url: URL, init: RequestInit, label: string): Promise<unknown> {
  const body = await politeFetch(url, init);
  try {
    return JSON.parse(body);
  } catch {
    throw new ScrapeSourceError(`Respons ${label} bukan JSON; formatnya mungkin berubah.`);
  }
}

/* ------------------------------------------------------ konfigurasi */

type BrandConfig = {
  /** Nama merek seperti di GSMArena; menjadi kolom `brand` di CSV. */
  gsmarenaBrand: string;
  gsmarenaListPage: string;
  /** Kata merek yang dibuang saat mencocokkan nama antar-sumber. */
  brandWords: readonly string[];
  /** Awalan nama di GSMArena yang tidak ditulis situs resmi ("iqoo"). */
  namePrefix?: string;
  /** Nama sumber harga yang berbeda total dari nama GSMArena (bukan sekadar spasi/merek). */
  nameAliases?: Record<string, string>;
  official: {
    label: string;
    /** Host yang sah untuk tautan produk resmi (dicek ulang saat menyimpan). */
    productHost: string;
    marketplace: string;
    sellerName: string;
    fetchProducts: () => Promise<OfficialProductRaw[]>;
  } | null;
};

/** vivo & iQOO: satu platform, `POST /id/product/productFilter`. */
function vivoPlatform(host: string, categories: number[], label: string) {
  return async (): Promise<OfficialProductRaw[]> => {
    const products: OfficialProductRaw[] = [];
    for (const categoryId of categories) {
      const json = (await politeJson(
        new URL(`https://${host}/id/product/productFilter`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            Referer: `https://${host}/id/products`,
          },
          body: new URLSearchParams({ categoryId: String(categoryId), rows: "200", page: "1" }).toString(),
        },
        `daftar produk ${label}`
      )) as { success?: boolean; data?: { products?: { id: number; name: string; productUrl: string; marketPrice?: string | null; promotionPrice?: string | null }[] } };

      if (!json.success || !Array.isArray(json.data?.products)) {
        throw new ScrapeSourceError(`Daftar produk ${label} tidak bisa dibaca; formatnya mungkin berubah.`);
      }
      for (const product of json.data.products) {
        if (looksLikeAccessory(product.name)) continue;
        const market = parseOfficialPrices(product.marketPrice);
        const promotion = parseOfficialPrices(product.promotionPrice);
        products.push({
          id: String(product.id),
          name: product.name.trim(),
          url: new URL(product.productUrl, `https://${host}`).href,
          prices: effectiveOfficialPrices(market, promotion),
          storageOnlyPrices: [],
          unassignedPrices: [],
          priceIssues: [...market.issues, ...promotion.issues],
        });
      }
    }
    return products;
  };
}

async function fetchOppo(): Promise<OfficialProductRaw[]> {
  const html = await politeFetch(new URL("https://www.oppo.com/id/smartphones/"));
  const codes = parseOppoProductCodes(html);
  if (codes.length === 0) {
    throw new ScrapeSourceError("Kode produk OPPO tidak ditemukan; format halaman mungkin berubah.");
  }
  const products: OfficialProductRaw[] = [];
  for (let i = 0; i < codes.length; i += 30) {
    const json = await politeJson(
      new URL("https://opsg-gateway-sg.oppo.com/v2/api/rest/mall/product/page/list/price"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://www.oppo.com", Referer: "https://www.oppo.com/" },
        body: JSON.stringify({ productCodes: codes.slice(i, i + 30), storeViewCode: "id", countryCode: "ID", deviceType: 4, needPre: true }),
      },
      "harga OPPO"
    );
    products.push(...parseOppoPriceResponse(json));
  }
  return products;
}

async function fetchSamsung(): Promise<OfficialProductRaw[]> {
  const products: OfficialProductRaw[] = [];
  for (let start = 1, page = 0; page < 5; start += 100, page += 1) {
    const url = new URL("https://searchapi.samsung.com/v6/front/b2c/product/finder/newhybris");
    url.search = new URLSearchParams({
      type: "01010000", // kategori smartphone
      siteCode: "id",
      start: String(start),
      num: "100",
      sort: "newest",
      onlyFilterInfoYN: "N",
      keySummaryYN: "N",
    }).toString();
    const json = await politeJson(url, { headers: { Origin: "https://www.samsung.com", Referer: "https://www.samsung.com/" } }, "katalog Samsung");
    const batch = parseSamsungFinderResponse(json);
    products.push(...batch);
    if (batch.length < 100) break;
  }
  return products;
}

async function fetchXiaomi(): Promise<OfficialProductRaw[]> {
  const products: OfficialProductRaw[] = [];
  for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
    const url = new URL("https://go.buy.mi.co.id/id/search/product-list");
    url.search = new URLSearchParams({
      version: "v4",
      cacheable: "1",
      page_size: "20",
      type: "2",
      category_tag: "phone",
      page_index: String(pageIndex),
      from: "tablet",
    }).toString();
    const json = await politeJson(url, { headers: { Origin: "https://www.mi.co.id", Referer: "https://www.mi.co.id/id/product-list/phone/" } }, "katalog Xiaomi");
    const { products: batch, total } = parseXiaomiProductList(json);
    products.push(...batch);
    if (batch.length === 0 || products.length >= total) break;
  }
  return products;
}

/**
 * Digimap (Shopify). `robots.txt`-nya mengizinkan halaman produk dirayapi,
 * dan `products.json` adalah endpoint publik Shopify. Dibaca per 250 produk
 * sampai habis, dengan batas halaman supaya tidak berjalan tanpa akhir bila
 * formatnya berubah.
 */
async function fetchDigimap(): Promise<OfficialProductRaw[]> {
  const products: unknown[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const url = new URL("https://www.digimap.co.id/products.json");
    url.search = new URLSearchParams({ limit: "250", page: String(page) }).toString();
    const json = (await politeJson(url, {}, "katalog Digimap")) as { products?: unknown[] };
    if (!Array.isArray(json.products)) {
      throw new ScrapeSourceError("Katalog Digimap tidak bisa dibaca; formatnya mungkin berubah.");
    }
    if (json.products.length === 0) break;
    products.push(...json.products);
  }
  return parseDigimapProducts(products);
}

/**
 * Infinix Indonesia. Kategori ponsel: 22 Latest, 8 NOTE, 9 HOT, 10 SMART,
 * 16 GT (aksesori, tablet, dan laptop punya kategori sendiri dan tidak
 * diminta). Satu model bisa muncul di beberapa kategori, jadi didedupe.
 */
async function fetchInfinix(): Promise<OfficialProductRaw[]> {
  const products: OfficialProductRaw[] = [];
  const seen = new Set<string>();

  for (const categoryId of [22, 8, 9, 10, 16]) {
    const url = new URL("https://id.infinixmobility.com/api/V1/xpark-app/app-products");
    url.search = new URLSearchParams({ categoryId: String(categoryId), page: "1", pageSize: "100" }).toString();
    const json = await politeJson(url, { headers: { Referer: "https://id.infinixmobility.com/" } }, "katalog Infinix");
    for (const product of parseInfinixProducts(json)) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      products.push(product);
    }
  }
  return products;
}

const BRANDS: Record<ScrapeBrand, BrandConfig> = {
  vivo: {
    gsmarenaBrand: "vivo",
    gsmarenaListPage: "vivo-phones-98.php",
    brandWords: ["vivo"],
    official: {
      label: "vivo",
      productHost: "www.vivo.com",
      marketplace: "Situs resmi vivo Indonesia",
      sellerName: "vivo Indonesia",
      // ID seri dari tab www.vivo.com/id/products: X, V, T, Y, S, Z.
      fetchProducts: vivoPlatform("www.vivo.com", [182, 2, 271, 3, 78, 88], "vivo"),
    },
  },
  iqoo: {
    gsmarenaBrand: "vivo",
    gsmarenaListPage: "vivo-phones-98.php",
    brandWords: ["vivo"],
    namePrefix: "iqoo",
    official: {
      label: "iQOO",
      productHost: "www.iqoo.com",
      marketplace: "Situs resmi iQOO Indonesia",
      sellerName: "iQOO Indonesia",
      fetchProducts: vivoPlatform("www.iqoo.com", [-1], "iQOO"),
    },
  },
  oppo: {
    gsmarenaBrand: "Oppo",
    gsmarenaListPage: "oppo-phones-82.php",
    brandWords: ["oppo"],
    official: {
      label: "OPPO",
      productHost: "www.oppo.com",
      marketplace: "Situs resmi OPPO Indonesia",
      sellerName: "OPPO Indonesia",
      fetchProducts: fetchOppo,
    },
  },
  samsung: {
    gsmarenaBrand: "Samsung",
    gsmarenaListPage: "samsung-phones-9.php",
    brandWords: ["samsung"],
    official: {
      label: "Samsung",
      productHost: "www.samsung.com",
      marketplace: "Situs resmi Samsung Indonesia",
      sellerName: "Samsung Indonesia",
      fetchProducts: fetchSamsung,
    },
  },
  xiaomi: {
    gsmarenaBrand: "Xiaomi",
    gsmarenaListPage: "xiaomi-phones-80.php",
    brandWords: ["xiaomi"],
    official: {
      label: "Xiaomi",
      productHost: "www.mi.co.id",
      marketplace: "Situs resmi Xiaomi Indonesia",
      sellerName: "Xiaomi Indonesia",
      fetchProducts: fetchXiaomi,
    },
  },
  apple: {
    gsmarenaBrand: "Apple",
    gsmarenaListPage: "apple-phones-48.php",
    brandWords: ["apple"],
    nameAliases: { "iPhone SE (3rd generation)": "iPhone SE (2022)" },
    // Apple tidak punya toko online Indonesia; harga dari Digimap sebagai
    // penjual, dicatat dengan nama penjualnya, tanpa badge terverifikasi.
    official: {
      label: "Digimap",
      productHost: "www.digimap.co.id",
      marketplace: "Digimap",
      sellerName: "Digimap",
      fetchProducts: fetchDigimap,
    },
  },
  infinix: {
    gsmarenaBrand: "Infinix",
    gsmarenaListPage: "infinix-phones-119.php",
    brandWords: ["infinix"],
    official: {
      label: "Infinix",
      // Tautan produk mengarah ke toko resminya (Magento), bukan ke situs utama.
      productHost: "id.pro.infinixmobility.com",
      marketplace: "Situs resmi Infinix Indonesia",
      sellerName: "Infinix Indonesia",
      fetchProducts: fetchInfinix,
    },
  },
  itel: { gsmarenaBrand: "itel", gsmarenaListPage: "itel-phones-131.php", brandWords: ["itel"], official: null },
  motorola: { gsmarenaBrand: "Motorola", gsmarenaListPage: "motorola-phones-4.php", brandWords: ["motorola", "moto"], official: null },
};

export function officialSourceFor(brand: ScrapeBrand) {
  const official = BRANDS[brand].official;
  return official ? { marketplace: official.marketplace, sellerName: official.sellerName, host: official.productHost } : null;
}

/* --------------------------------------------------------- daftar model */

/** Halaman daftar merek GSMArena yang dipakai sebagai daftar model merek tanpa harga resmi. */
const GSMARENA_LINEUP_PAGES = 2;

export async function fetchLineup(brand: ScrapeBrand): Promise<LineupItem[]> {
  const config = BRANDS[brand];

  if (!config.official) {
    // Merek tanpa harga resmi online: daftar model terbaru dari GSMArena.
    const index = await loadBrandIndex(brand, GSMARENA_LINEUP_PAGES);
    return index.items
      .filter((item) => !looksLikeNonPhone(item.name))
      .map((item) => ({
        officialId: item.path.replace(/\.php$/, ""),
        brand,
        officialName: item.name,
        officialUrl: null,
        prices: [],
        storageOnlyPrices: [],
        unassignedPrices: [],
        priceIssues: [],
        siblingHas5g: false,
        gsmarenaPath: item.path,
      }));
  }

  const products = (await config.official.fetchProducts()).filter(
    (product) => !looksLikeNonPhone(product.name) && !looksLikeAccessory(product.name)
  );
  const keyOf = (name: string) => modelKey(name, { brandWords: config.brandWords, prefix: config.namePrefix });
  const fiveGBases = new Set(products.map((p) => keyOf(p.name)).filter((k) => k.network === "5g").map((k) => k.base));

  const seen = new Set<string>();
  return products
    .filter((product) => (seen.has(product.id) ? false : (seen.add(product.id), true)))
    .map((product) => {
      const key = keyOf(product.name);
      let officialUrl: string | null = null;
      try {
        const url = new URL(product.url);
        officialUrl = url.hostname === config.official!.productHost ? url.href : null;
      } catch {
        officialUrl = null;
      }
      return {
        officialId: product.id,
        brand,
        officialName: product.name,
        officialUrl,
        prices: product.prices,
        storageOnlyPrices: product.storageOnlyPrices,
        unassignedPrices: product.unassignedPrices,
        priceIssues: officialUrl ? product.priceIssues : [...product.priceIssues, "Tautan produk resmi tidak valid; harga tidak akan dicatat."],
        siblingHas5g: key.network !== "5g" && fiveGBases.has(key.base),
        gsmarenaPath: null,
      };
    });
}

/* ------------------------------------------------------------ GSMArena */

const GSMARENA = "https://www.gsmarena.com/";
const INDEX_TTL_MS = 30 * 60_000;
/** Tanda kurung ikut diizinkan: GSMArena menulis model bertahun sebagai "..._(2022)-11410.php". */
export const GSMARENA_PATH = /^[a-z0-9_()]+-\d+\.php$/;

type BrandIndex = {
  items: (GsmarenaListItem & { key: ModelKey })[];
  pending: string[];
  pagesLoaded: number;
  loadedAt: number;
};

/** Indeks per halaman daftar merek GSMArena (vivo dan iQOO berbagi satu). */
const brandIndexes = new Map<string, BrandIndex>();

function indexFor(brand: ScrapeBrand): BrandIndex {
  const page = BRANDS[brand].gsmarenaListPage;
  const existing = brandIndexes.get(page);
  if (existing && Date.now() - existing.loadedAt <= INDEX_TTL_MS) return existing;
  const fresh: BrandIndex = { items: [], pending: [page], pagesLoaded: 0, loadedAt: Date.now() };
  brandIndexes.set(page, fresh);
  return fresh;
}

async function loadNextIndexPage(brand: ScrapeBrand, index: BrandIndex): Promise<boolean> {
  const page = index.pending.shift();
  if (!page) return false;
  const config = BRANDS[brand];
  const html = await politeFetch(new URL(page, GSMARENA));
  const parsed = parseBrandListPage(html);
  const known = new Set(index.items.map((item) => item.path));
  for (const item of parsed.items) {
    if (!known.has(item.path)) {
      index.items.push({ ...item, key: modelKey(item.name, { brandWords: config.brandWords }) });
    }
  }
  if (index.pagesLoaded === 0) index.pending.push(...parsed.nextPages);
  index.pagesLoaded += 1;
  return true;
}

async function loadBrandIndex(brand: ScrapeBrand, minPages: number): Promise<BrandIndex> {
  const index = indexFor(brand);
  while (index.pagesLoaded < minPages && (await loadNextIndexPage(brand, index))) {
    // lanjut memuat
  }
  return index;
}

/**
 * Mencari halaman GSMArena untuk satu nama di situs resmi. Halaman daftar
 * merek dimuat bertahap (terbaru dulu) dan disimpan 30 menit, sehingga model
 * baru biasanya ketemu di halaman pertama dan halaman lama hanya dimuat bila
 * memang diperlukan.
 */
export async function findGsmarenaPage(
  brand: ScrapeBrand,
  officialName: string,
  siblingHas5g: boolean
): Promise<{ chosen: GsmarenaListItem | null; alternatives: GsmarenaListItem[] }> {
  const config = BRANDS[brand];
  const index = indexFor(brand);
  const lookupName = config.nameAliases?.[officialName] ?? officialName;
  const official = modelKey(lookupName, { brandWords: config.brandWords, prefix: config.namePrefix });

  for (;;) {
    const result = pickGsmarenaCandidate(official, index.items, siblingHas5g);
    if (result.chosen) return result;
    if (!(await loadNextIndexPage(brand, index))) return result;
  }
}

export async function fetchGsmarenaSpec(brand: ScrapeBrand, path: string) {
  if (!GSMARENA_PATH.test(path)) {
    throw new ScrapeSourceError("Alamat halaman GSMArena tidak valid.");
  }
  const html = await politeFetch(new URL(path, GSMARENA));
  return parseSpecPage(html, path, BRANDS[brand].gsmarenaBrand);
}
