import type { CsvRow } from "@/lib/import/csv-parser";
import type { ModelKey } from "@/lib/scrape/parsers";
import type { LineupItem } from "@/lib/scrape/types";

/**
 * Aturan murni pemeriksaan harga harian (PRD §7: "jadwal pemeriksaan harian,
 * hanya jika sumber mendukung").
 *
 * Pemeriksaan otomatis HANYA memperbarui penawaran yang sudah ada. Model atau
 * varian baru tetap lewat tarik otomatis yang ditinjau admin, supaya tidak ada
 * data yang tampil tanpa keputusan manusia.
 *
 * Pencocokan utama memakai URL penawaran yang tersimpan + varian
 * (RAM/penyimpanan), karena URL itulah yang dulu dipilih admin. Bila URL itu
 * tidak tercantum lagi, dicoba kunci nama model yang sama dengan tarik
 * otomatis (satu model, host resmi yang sama); URL tersimpan tetap dipakai. Kolom yang
 * bisa disunting admin (garansi, status terverifikasi) disalin dari penawaran
 * yang tersimpan, sehingga pemeriksaan tidak pernah menimpa suntingan manual.
 *
 * Hasilnya tiga kelompok:
 *   - rows: baris CSV penawaran untuk batch harga (harga dan stok terbaru),
 *   - missing: penawaran yang jelas tidak tercantum lagi (dicatat sebagai
 *     pemeriksaan GAGAL, PRD §7 butir 6, supaya harganya tidak tampak segar),
 *   - ambiguous: model masih tercantum tetapi harganya tidak bisa dipasangkan
 *     ke satu varian dengan yakin. Tidak dicatat berhasil maupun gagal.
 */

export type RefreshOffer = {
  offerId: string;
  url: string;
  slug: string;
  /** "Merek Model" produknya, untuk cadangan pencocokan nama. */
  modelName: string;
  ramGb: number;
  storageGb: number;
  warranty: string | null;
  sellerVerified: boolean;
};

type RefreshSource = { marketplace: string; sellerName: string; host: string };

type RefreshPlan = {
  rows: CsvRow[];
  matchedOfferIds: string[];
  missing: { offerId: string; reason: string }[];
  ambiguous: string[];
  /**
   * Penawaran yang hanya cocok lewat nama model: URL tersimpan tidak tercantum
   * lagi, dan `url` adalah halaman yang tercantum saat ini. Termasuk penawaran
   * ganda (variannya sudah diperbarui lewat penawaran lain di `url`); tetap
   * dicatat gagal dengan DUPLICATE_URL_REASON. Disimpan sebagai usulan untuk
   * admin (PB-06), tidak pernah menimpa atau menghapus secara otomatis.
   */
  urlSuggestions: { offerId: string; url: string }[];
  /** Penawaran yang URL tersimpannya tercantum lagi; usulan lamanya dihapus. */
  urlConfirmed: string[];
};

export const MISSING_MODEL_REASON = "Model ini tidak lagi tercantum di situs resmi saat pemeriksaan harga harian.";
export const MISSING_VARIANT_REASON = "Varian ini tidak lagi tercantum dengan harga di situs resmi saat pemeriksaan harga harian.";
export const DUPLICATE_URL_REASON =
  "URL ini tidak lagi tercantum di situs resmi; varian yang sama sudah diperbarui lewat penawaran lain dari penjual ini.";

/** URL disamakan bentuknya: host huruf kecil, tanpa fragmen, tanpa garis miring di akhir path. */
function normalizeOfferUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return null;
  }
}

function onHost(value: string | undefined | null, host: string): string | null {
  if (!value) return null;
  const normalized = normalizeOfferUrl(value);
  return normalized && new URL(normalized).hostname === host ? normalized : null;
}

export function planPriceRefresh({
  lineup,
  offers,
  source,
  observedAt,
  keyOf,
}: {
  lineup: readonly LineupItem[];
  offers: readonly RefreshOffer[];
  source: RefreshSource;
  observedAt: string;
  /**
   * Kunci nama model (`modelKey` tarik otomatis). Dipakai HANYA bila URL
   * penawaran tidak tercantum lagi: situs seperti Samsung mengganti URL
   * perwakilan model (warna/SKU) dari hari ke hari, padahal modelnya sama.
   */
  keyOf?: (name: string) => ModelKey;
}): RefreshPlan {
  const offersByUrl = new Map<string, RefreshOffer[]>();
  for (const offer of offers) {
    const key = normalizeOfferUrl(offer.url);
    if (!key) continue;
    offersByUrl.set(key, [...(offersByUrl.get(key) ?? []), offer]);
  }

  // Semua URL yang tercantum hari ini (halaman model dan halaman varian).
  const items = lineup.flatMap((item) => {
    const modelUrl = onHost(item.officialUrl, source.host);
    return modelUrl ? [{ item, modelUrl }] : [];
  });
  const listedUrls = new Set<string>();
  for (const { item, modelUrl } of items) {
    listedUrls.add(modelUrl);
    for (const price of [...item.prices, ...item.storageOnlyPrices]) {
      const url = onHost(price.url, source.host);
      if (url) listedUrls.add(url);
    }
  }

  // Cadangan nama: penawaran yang URL-nya hilang dipasangkan ke SATU model
  // dengan nama dasar sama. Label jaringan harus sama, kecuali hanya ada satu
  // model dengan nama dasar itu (situs resmi sering tidak menulis "5G").
  const fallback = new Map<LineupItem, RefreshOffer[]>();
  if (keyOf) {
    const byBase = new Map<string, { item: LineupItem; key: ModelKey }[]>();
    for (const { item } of items) {
      const key = keyOf(item.officialName);
      byBase.set(key.base, [...(byBase.get(key.base) ?? []), { item, key }]);
    }
    for (const offer of offers) {
      const url = normalizeOfferUrl(offer.url);
      if (!url || listedUrls.has(url)) continue;
      const key = keyOf(offer.modelName);
      const sameBase = byBase.get(key.base) ?? [];
      const exact = sameBase.filter((entry) => entry.key.network === key.network);
      const target = exact.length === 1 ? exact[0] : exact.length === 0 && sameBase.length === 1 ? sameBase[0] : null;
      if (target) fallback.set(target.item, [...(fallback.get(target.item) ?? []), offer]);
    }
  }

  const matched = new Map<string, CsvRow>();
  const listedOffers = new Set<string>();
  const ambiguousOffers = new Set<string>();
  const urlSuggestions = new Map<string, string>();
  /** Penawaran ganda: varian yang sama sudah cocok lewat URL yang tercantum. */
  const duplicates = new Set<string>();
  const markDuplicates = (list: readonly RefreshOffer[], url: string) => {
    for (const offer of list) {
      if (matched.has(offer.offerId)) continue;
      duplicates.add(offer.offerId);
      urlSuggestions.set(offer.offerId, url);
    }
  };

  /** `listedAt` diisi bila penawaran cocok lewat nama: URL yang tercantum hari ini. */
  const take = (offer: RefreshOffer, priceIdr: number, inStock: boolean | undefined, listedAt?: string) => {
    if (matched.has(offer.offerId)) return;
    if (listedAt) urlSuggestions.set(offer.offerId, listedAt);
    matched.set(offer.offerId, {
      slug: offer.slug,
      ram_gb: String(offer.ramGb),
      storage_gb: String(offer.storageGb),
      marketplace: source.marketplace,
      seller_name: source.sellerName,
      url: offer.url,
      warranty: offer.warranty ?? "",
      listing_status: inStock === false ? "out-of-stock" : "active",
      seller_verified: offer.sellerVerified ? "ya" : "tidak",
      price_idr: String(priceIdr),
      observed_at: observedAt,
    });
  };
  const unmatched = (list: readonly RefreshOffer[]) => list.filter((offer) => !matched.has(offer.offerId));
  const atUrl = (url: string) => unmatched(offersByUrl.get(url) ?? []);

  for (const { item, modelUrl } of items) {
    const spare = () => unmatched(fallback.get(item) ?? []);
    for (const offer of [...(offersByUrl.get(modelUrl) ?? []), ...(fallback.get(item) ?? [])]) listedOffers.add(offer.offerId);

    for (const price of item.prices) {
      const url = onHost(price.url, source.host) ?? modelUrl;
      for (const offer of offersByUrl.get(url) ?? []) listedOffers.add(offer.offerId);
      const sameVariant = (offer: RefreshOffer) => offer.ramGb === price.ramGb && offer.storageGb === price.storageGb;
      const direct = atUrl(url).filter(sameVariant);
      if (direct.length > 0) {
        for (const offer of direct) take(offer, price.priceIdr, price.inStock);
        markDuplicates(spare().filter(sameVariant), url);
      } else for (const offer of spare().filter(sameVariant)) take(offer, price.priceIdr, price.inStock, url);
    }

    // Harga tanpa RAM (Samsung): dipakai hanya bila tepat satu penawaran cocok penyimpanannya.
    for (const price of item.storageOnlyPrices) {
      const url = onHost(price.url, source.host) ?? modelUrl;
      for (const offer of offersByUrl.get(url) ?? []) listedOffers.add(offer.offerId);
      const sameStorage = (offer: RefreshOffer) => offer.storageGb === price.storageGb;
      const direct = atUrl(url).filter(sameStorage);
      const candidates = direct.length > 0 ? direct : spare().filter(sameStorage);
      if (candidates.length === 1) take(candidates[0], price.priceIdr, price.inStock, direct.length > 0 ? undefined : url);
      if (direct.length === 1) markDuplicates(spare().filter(sameStorage), url);
      else for (const offer of candidates) ambiguousOffers.add(offer.offerId);
    }

    // "Harga mulai" tanpa varian (Infinix): varian dulu dipilih admin. Diulang
    // hanya bila satu harga dan satu penawaran, selain itu terlalu menebak.
    if (item.unassignedPrices.length > 0) {
      const atModel = atUrl(modelUrl);
      const candidates = [...atModel, ...spare()];
      if (item.unassignedPrices.length === 1 && candidates.length === 1) {
        take(candidates[0], item.unassignedPrices[0].priceIdr, undefined, atModel.length > 0 ? undefined : modelUrl);
      } else {
        for (const offer of candidates) ambiguousOffers.add(offer.offerId);
      }
    }
  }

  const missing: RefreshPlan["missing"] = [];
  const ambiguous: string[] = [];
  for (const offer of offers) {
    if (matched.has(offer.offerId)) continue;
    if (ambiguousOffers.has(offer.offerId)) ambiguous.push(offer.offerId);
    else if (duplicates.has(offer.offerId)) missing.push({ offerId: offer.offerId, reason: DUPLICATE_URL_REASON });
    else missing.push({ offerId: offer.offerId, reason: listedOffers.has(offer.offerId) ? MISSING_VARIANT_REASON : MISSING_MODEL_REASON });
  }

  const urlConfirmed = offers.filter((offer) => listedUrls.has(normalizeOfferUrl(offer.url) ?? "")).map((offer) => offer.offerId);

  return {
    rows: [...matched.values()],
    matchedOfferIds: [...matched.keys()],
    missing,
    ambiguous,
    urlSuggestions: [...urlSuggestions].map(([offerId, url]) => ({ offerId, url })),
    urlConfirmed,
  };
}

/**
 * Usulan URL (PB-06) yang masih perlu diputuskan admin: berbeda dari URL
 * penawaran saat ini dan belum pernah ditolak. Bentuk URL disamakan dulu,
 * jadi beda garis miring akhir tidak dianggap URL baru.
 */
export function isPendingUrlSuggestion({
  suggestedUrl,
  dismissedUrl,
  currentUrl,
}: {
  suggestedUrl: string;
  dismissedUrl: string | null;
  currentUrl: string;
}): boolean {
  const suggested = normalizeOfferUrl(suggestedUrl);
  if (!suggested) return false;
  if (suggested === normalizeOfferUrl(currentUrl)) return false;
  return !dismissedUrl || suggested !== normalizeOfferUrl(dismissedUrl);
}

/** Dua URL penawaran sama setelah bentuknya disamakan (garis miring akhir, huruf host). */
export function sameOfferUrl(a: string, b: string): boolean {
  const left = normalizeOfferUrl(a);
  return left !== null && left === normalizeOfferUrl(b);
}

/** Kunci idempoten satu pemeriksaan: satu merek, satu tanggal kalender WIB. */
export function refreshKeyFor(brand: string, at: Date): string {
  const wib = new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  return `${brand}:${wib}`;
}

/* ------------------------------------------- peringatan pemeriksaan harian */

/** Status hasil pemeriksaan per merek yang disimpan di `price_refresh_runs`. */
export type RefreshRunStatus = "queued" | "nothing-to-update" | "no-offers" | "source-error" | "blocked" | "error";

export type RefreshRun = { brand: string; runDate: string; status: RefreshRunStatus; message: string | null };

export type RefreshAlert =
  | { kind: "belum-jalan"; runDate: string }
  | { kind: "antre-lama"; count: number; since: string }
  | { kind: "gagal"; brand: string; status: "source-error" | "blocked" | "error"; message: string | null }
  | { kind: "lama-tidak-berhasil"; brand: string; lastSuccess: string | null };

const SUCCESS: ReadonlySet<RefreshRunStatus> = new Set(["queued", "nothing-to-update"]);
const FAILURE: ReadonlySet<RefreshRunStatus> = new Set(["source-error", "blocked", "error"]);
/** Cron Hobby berjalan antara 06.00 dan 06.59 WIB; setelah 09.00 WIB dianggap terlambat. */
const LATE_HOUR_WIB = 9;
/** Merek yang belum berhasil diperiksa selama ini dianggap bermasalah. */
const STALE_DAYS = 2;

function wibDate(at: Date, offsetDays = 0): string {
  return new Date(at.getTime() + 7 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** Batch harga harian yang antre selama ini dianggap macet (worker belum jalan). */
export const STUCK_BATCH_MINUTES = 60;

/**
 * Peringatan untuk dasbor admin (PB-05). Merek tanpa penawaran resmi
 * (`no-offers`) tidak diperingatkan karena memang tidak ada yang diperiksa.
 * `stuck` = batch pemeriksaan harian yang antre lebih dari STUCK_BATCH_MINUTES:
 * harganya sudah diambil tetapi belum diterapkan, jadi tetap terlihat basi.
 */
export function refreshAlerts(
  runs: readonly RefreshRun[],
  now: Date,
  stuck: { count: number; oldestCreatedAt: string } | null = null
): RefreshAlert[] {
  const today = wibDate(now);
  const alerts: RefreshAlert[] = [];
  if (stuck && stuck.count > 0) alerts.push({ kind: "antre-lama", count: stuck.count, since: stuck.oldestCreatedAt });
  const todayRuns = runs.filter((run) => run.runDate === today);
  const hourWib = new Date(now.getTime() + 7 * 3_600_000).getUTCHours();
  if (todayRuns.length === 0 && hourWib >= LATE_HOUR_WIB) alerts.push({ kind: "belum-jalan", runDate: today });

  const brands = [...new Set(runs.filter((run) => run.status !== "no-offers").map((run) => run.brand))].sort();
  const staleBefore = wibDate(now, -STALE_DAYS);
  for (const brand of brands) {
    const own = runs.filter((run) => run.brand === brand).sort((a, b) => b.runDate.localeCompare(a.runDate));
    const latest = own[0]!;
    if (latest.runDate === today && FAILURE.has(latest.status)) {
      alerts.push({ kind: "gagal", brand, status: latest.status as "source-error" | "blocked" | "error", message: latest.message });
      continue;
    }
    const lastSuccess = own.find((run) => SUCCESS.has(run.status))?.runDate ?? null;
    if (lastSuccess === null || lastSuccess < staleBefore) alerts.push({ kind: "lama-tidak-berhasil", brand, lastSuccess });
  }
  return alerts;
}
