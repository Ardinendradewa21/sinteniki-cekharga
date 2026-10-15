import { chipsetTier } from "@/lib/assistant/chipset-tiers";
import type { ACTIVITIES, PRIORITIES } from "@/lib/assistant/needs";
import type { ProductSpecs } from "@/lib/catalog/schema";

/**
 * Skor pengurutan kandidat asisten (rancangan Tanya AI §3.4). Modul murni.
 *
 * Skor hanya MENGURUTKAN kandidat yang sudah lolos syarat wajib. Skor tidak
 * pernah ditampilkan sebagai nilai, tidak pernah membuang kandidat, dan tidak
 * menjadi klaim "terbaik" (PRD §3, FR-02).
 *
 * Setiap fitur dinilai 0..1 relatif terhadap kandidat yang sedang dibandingkan.
 * Data yang belum tercatat mendapat nilai netral rendah, bukan nol mutlak dan
 * bukan nilai tinggi: tidak diketahui bukan berarti bagus.
 */

export type Priority = (typeof PRIORITIES)[number];
export type Activity = (typeof ACTIVITIES)[number];
export type Feature = "performa" | "baterai" | "kamera" | "layar" | "ringan" | "harga" | "memori";

/** Nilai untuk data yang belum tercatat. */
const UNKNOWN = 0.3;

/**
 * Pita budget "sekitar": sampai +15% dianggap masih masuk, +15% sampai +30%
 * skornya turun bertahap, di atas +30% kandidat dipindah ke alternatif
 * berlabel "di luar budget" oleh pemanggil.
 */
export const BUDGET_BAND = { inside: 0.15, stretch: 0.3 } as const;

/** Bobot prioritas berperingkat: pertama 3, kedua 2, ketiga 1. */
const PRIORITY_WEIGHTS = [3, 2, 1] as const;
const ACTIVITY_WEIGHT = 1.5;

const PRIORITY_FEATURES: Record<Priority, Partial<Record<Feature, number>>> = {
  harga: { harga: 1 },
  baterai: { baterai: 1 },
  kamera: { kamera: 1 },
  performa: { performa: 1 },
  ringan: { ringan: 1 },
  layar: { layar: 1 },
};

const ACTIVITY_FEATURES: Record<Activity, Partial<Record<Feature, number>>> = {
  game: { performa: 0.7, layar: 0.3 },
  foto: { kamera: 1 },
  baterai: { baterai: 1 },
  kerja: { memori: 0.5, performa: 0.5 },
  "sosial-media": { harga: 0.5, baterai: 0.5 },
};

export type ScoreInput = {
  specs: ProductSpecs;
  ramGb: number;
  /** Harga yang dipakai mengurutkan (segar atau terakhir tercatat); null = tidak diketahui. */
  priceIdr: number | null;
  /** Ada ringkasan reviewer beraspek kamera untuk produk ini. */
  hasCameraReview: boolean;
};

type Range = { min: number; max: number };

export type ScoreContext = {
  battery: Range | null;
  charging: Range | null;
  weight: Range | null;
  price: Range | null;
  ram: Range | null;
  display: Range | null;
  year: Range | null;
};

function rangeOf(values: (number | null)[]): Range | null {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (known.length === 0) return null;
  return { min: Math.min(...known), max: Math.max(...known) };
}

/** 0..1 di dalam rentang; bila semua kandidat sama, semuanya bernilai 1. */
function normalize(value: number | null, range: Range | null, invert = false): number | null {
  if (value === null || range === null) return null;
  if (range.max === range.min) return 1;
  const ratio = (value - range.min) / (range.max - range.min);
  return invert ? 1 - ratio : ratio;
}

export function buildScoreContext(inputs: readonly ScoreInput[]): ScoreContext {
  return {
    battery: rangeOf(inputs.map((input) => input.specs.batteryMah)),
    charging: rangeOf(inputs.map((input) => input.specs.chargingWatt)),
    weight: rangeOf(inputs.map((input) => input.specs.weightGrams)),
    price: rangeOf(inputs.map((input) => input.priceIdr)),
    ram: rangeOf(inputs.map((input) => input.ramGb)),
    display: rangeOf(inputs.map((input) => input.specs.displayInches)),
    year: rangeOf(inputs.map((input) => input.specs.releaseYear)),
  };
}

export function featureScores(input: ScoreInput, context: ScoreContext): Record<Feature, number> {
  const { specs } = input;
  const tier = chipsetTier(specs.chipset);

  const battery = normalize(specs.batteryMah, context.battery);
  const charging = normalize(specs.chargingWatt, context.charging);
  const baterai = battery === null ? UNKNOWN : battery * 0.8 + (charging ?? UNKNOWN) * 0.2;

  // Kamera: lensa telefoto, zoom optik, ultrawide, dan adanya ulasan kamera.
  // Megapiksel sengaja tidak dipakai karena tidak menentukan kualitas foto.
  const kameraKnown = specs.cameraHasTelephoto !== null || specs.cameraHasUltrawide !== null;
  const kamera = kameraKnown
    ? (specs.cameraHasTelephoto ? 0.45 : 0) +
      ((specs.cameraOpticalZoomX ?? 0) >= 3 ? 0.15 : 0) +
      (specs.cameraHasUltrawide ? 0.15 : 0) +
      (input.hasCameraReview ? 0.15 : 0) +
      (tier !== null ? (tier / 5) * 0.1 : 0)
    : UNKNOWN;

  const refresh = specs.refreshRateHz;
  const layarKnown = refresh !== null || specs.displayTechnology !== null || specs.displayInches !== null;
  const layar = layarKnown
    ? (refresh === null ? 0.15 : refresh >= 120 ? 0.5 : refresh >= 90 ? 0.3 : 0.1) +
      (/oled/i.test(specs.displayTechnology ?? "") ? 0.3 : 0) +
      (normalize(specs.displayInches, context.display) ?? 0.5) * 0.2
    : UNKNOWN;

  return {
    performa: tier === null ? UNKNOWN : tier / 5,
    baterai,
    kamera,
    layar,
    ringan: normalize(specs.weightGrams, context.weight, true) ?? UNKNOWN,
    harga: normalize(input.priceIdr, context.price, true) ?? UNKNOWN,
    memori: normalize(input.ramGb, context.ram) ?? UNKNOWN,
  };
}

/**
 * Bobot fitur dari prioritas berperingkat dan kegunaan. Tanpa keduanya, harga
 * yang lebih rendah dan model yang lebih baru yang didahulukan.
 */
export function featureWeights(
  priorities: readonly Priority[],
  activities: readonly Activity[]
): Partial<Record<Feature, number>> {
  const weights: Partial<Record<Feature, number>> = {};
  const add = (map: Partial<Record<Feature, number>>, factor: number) => {
    for (const [feature, share] of Object.entries(map) as [Feature, number][]) {
      weights[feature] = (weights[feature] ?? 0) + share * factor;
    }
  };
  priorities.slice(0, PRIORITY_WEIGHTS.length).forEach((priority, index) => {
    add(PRIORITY_FEATURES[priority], PRIORITY_WEIGHTS[index]!);
  });
  for (const activity of activities) add(ACTIVITY_FEATURES[activity], ACTIVITY_WEIGHT);
  if (Object.keys(weights).length === 0) weights.harga = 1;
  return weights;
}

export type BudgetFit =
  | { band: "inside" | "stretch"; factor: number; ratio: number }
  | { band: "over"; factor: 0; ratio: number }
  | { band: "unknown"; factor: number; ratio: null };

/**
 * Seberapa pas harga dengan budget "sekitar". Harga jauh di bawah budget sedikit
 * diturunkan karena pengguna biasanya siap membayar mendekati budgetnya.
 */
export function softBudgetFit(priceIdr: number | null, budgetIdr: number): BudgetFit {
  if (priceIdr === null) return { band: "unknown", factor: 0.5, ratio: null };
  const ratio = priceIdr / budgetIdr;
  if (ratio > 1 + BUDGET_BAND.stretch) return { band: "over", factor: 0, ratio };
  if (ratio > 1 + BUDGET_BAND.inside) {
    const into = (ratio - 1 - BUDGET_BAND.inside) / (BUDGET_BAND.stretch - BUDGET_BAND.inside);
    return { band: "stretch", factor: 1 - into * 0.6, ratio };
  }
  return { band: "inside", factor: ratio < 0.5 ? 0.75 : 1, ratio };
}

/** Kunci seri untuk keragaman: "Redmi Note 17 Pro Max" dan "Redmi Note 17" satu seri. */
const SERIES_SUFFIX = new Set(["pro", "max", "plus", "+", "ultra", "lite", "4g", "5g", "fe", "edge", "mini", "neo", "turbo", "prime", "s"]);

export function seriesKey(brand: string, model: string): string {
  const tokens = model.toLowerCase().replace(/\+/g, " + ").split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && SERIES_SUFFIX.has(tokens[tokens.length - 1]!)) tokens.pop();
  return `${brand.toLowerCase()}|${tokens.join(" ")}`;
}

/**
 * Keragaman di posisi teratas: paling banyak satu kandidat per seri dan dua per
 * merek di `top` posisi pertama, kecuali pengguna meminta merek tertentu saja.
 * Kandidat yang tertunda tetap ikut, di belakang, dengan urutan aslinya.
 */
export function diversify<T>(
  sorted: readonly T[],
  keyOf: (item: T) => { series: string; brand: string },
  { top = 3, perBrand = 2, brandLimit = true }: { top?: number; perBrand?: number; brandLimit?: boolean } = {}
): T[] {
  const picked: T[] = [];
  const deferred: T[] = [];
  const series = new Set<string>();
  const brands = new Map<string, number>();
  for (const item of sorted) {
    if (picked.length >= top) {
      deferred.push(item);
      continue;
    }
    const key = keyOf(item);
    const brandCount = brands.get(key.brand) ?? 0;
    if (series.has(key.series) || (brandLimit && brandCount >= perBrand)) {
      deferred.push(item);
      continue;
    }
    picked.push(item);
    series.add(key.series);
    brands.set(key.brand, brandCount + 1);
  }
  return [...picked, ...deferred];
}
