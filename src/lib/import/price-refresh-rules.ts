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

export type RefreshSource = { marketplace: string; sellerName: string; host: string };

export type RefreshPlan = {
  rows: CsvRow[];
  matchedOfferIds: string[];
  missing: { offerId: string; reason: string }[];
  ambiguous: string[];
};

export const MISSING_MODEL_REASON = "Model ini tidak lagi tercantum di situs resmi saat pemeriksaan harga harian.";
export const MISSING_VARIANT_REASON = "Varian ini tidak lagi tercantum dengan harga di situs resmi saat pemeriksaan harga harian.";

/** URL disamakan bentuknya: host huruf kecil, tanpa fragmen, tanpa garis miring di akhir path. */
export function normalizeOfferUrl(value: string): string | null {
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

  const take = (offer: RefreshOffer, priceIdr: number, inStock: boolean | undefined) => {
    if (matched.has(offer.offerId)) return;
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
      for (const offer of direct.length > 0 ? direct : spare().filter(sameVariant)) take(offer, price.priceIdr, price.inStock);
    }

    // Harga tanpa RAM (Samsung): dipakai hanya bila tepat satu penawaran cocok penyimpanannya.
    for (const price of item.storageOnlyPrices) {
      const url = onHost(price.url, source.host) ?? modelUrl;
      for (const offer of offersByUrl.get(url) ?? []) listedOffers.add(offer.offerId);
      const sameStorage = (offer: RefreshOffer) => offer.storageGb === price.storageGb;
      const direct = atUrl(url).filter(sameStorage);
      const candidates = direct.length > 0 ? direct : spare().filter(sameStorage);
      if (candidates.length === 1) take(candidates[0], price.priceIdr, price.inStock);
      else for (const offer of candidates) ambiguousOffers.add(offer.offerId);
    }

    // "Harga mulai" tanpa varian (Infinix): varian dulu dipilih admin. Diulang
    // hanya bila satu harga dan satu penawaran, selain itu terlalu menebak.
    if (item.unassignedPrices.length > 0) {
      const candidates = [...atUrl(modelUrl), ...spare()];
      if (item.unassignedPrices.length === 1 && candidates.length === 1) {
        take(candidates[0], item.unassignedPrices[0].priceIdr, undefined);
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
    else missing.push({ offerId: offer.offerId, reason: listedOffers.has(offer.offerId) ? MISSING_VARIANT_REASON : MISSING_MODEL_REASON });
  }

  return { rows: [...matched.values()], matchedOfferIds: [...matched.keys()], missing, ambiguous };
}

/** Kunci idempoten satu pemeriksaan: satu merek, satu tanggal kalender WIB. */
export function refreshKeyFor(brand: string, at: Date): string {
  const wib = new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  return `${brand}:${wib}`;
}
