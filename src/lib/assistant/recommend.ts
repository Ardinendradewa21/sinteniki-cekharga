import "server-only";

import { loadPublishedCatalog } from "@/lib/catalog/queries";
import {
  formatVariantLabel,
  variantKey,
} from "@/lib/catalog/queries";
import { formatIdr, resolveVariantPrice } from "@/lib/catalog/pricing";
import type { PriceResolution } from "@/lib/catalog/pricing";
import type { CatalogDataset, Product, ProductSpecs, Variant } from "@/lib/catalog/schema";
import { PRICING_POLICY } from "@/lib/config";
import {
  REQUIREMENT_LABELS,
  type Requirement,
  type UserNeeds,
} from "@/lib/assistant/needs";
import { CHIPSET_TIER_LABELS, chipsetShortName, chipsetTier } from "@/lib/assistant/chipset-tiers";
import {
  buildScoreContext,
  diversify,
  featureScores,
  featureWeights,
  seriesKey,
  softBudgetFit,
  type Feature,
  type ScoreInput,
} from "@/lib/assistant/scoring";

/**
 * Mesin rekomendasi (PRD FR-06).
 *
 * Ini bagian yang menjawab syarat penerimaan paling penting di FR-06: "syarat
 * wajib disaring melalui logika terstruktur, BUKAN janji prompt saja". Semua
 * penyaringan syarat wajib terjadi di sini, deterministik dan bisa diuji, tanpa
 * melibatkan model bahasa sama sekali.
 *
 * Model bahasa hanya menerjemahkan kalimat pengguna menjadi `UserNeeds`. Model
 * tidak pernah diberi wewenang meloloskan kandidat yang gagal syarat wajib.
 *
 * Aturan lain yang ditegakkan di sini:
 *
 * - Kandidat di luar budget TIDAK dibuang diam-diam. Kalau budgetnya wajib,
 *   mereka dipisahkan sebagai alternatif berlabel, sesuai PRD: "Alternatif di
 *   luar budget harus diberi label dan tidak boleh diam-diam dianggap memenuhi
 *   syarat."
 * - Harga lama (melewati freshness, tetapi masih dalam
 *   `PRICING_POLICY.assistantStaleWindowDays`) tidak dianggap memenuhi budget
 *   wajib. Kandidatnya dipisah ke `staleMatches` dengan tanggal pemeriksaan,
 *   karena harga yang belum dicek ulang bukan bukti masuk budget.
 * - Syarat wajib berbasis spesifikasi yang datanya belum tercatat dianggap
 *   BELUM terpenuhi. Tidak diketahui bukan berarti ada.
 * - Alasan cocok hanya berisi FAKTA yang tercatat (angka spesifikasi, varian,
 *   harga) atau kutipan reviewer. PRD melarang menyimpulkan pengalaman gaming
 *   atau baterai hanya dari angka spesifikasi, jadi kalimatnya tidak pernah
 *   mengklaim rasa pemakaian tanpa sumber.
 * - Jumlah rekomendasi tidak dipaksakan. Kalau hanya satu yang lolos, yang
 *   ditampilkan satu.
 */

export type MatchReason = {
  /** `fact` = angka tercatat, `review` = pernyataan reviewer dengan sumber. */
  kind: "fact" | "review";
  text: string;
  /** Diisi untuk `review`, supaya klaim selalu bisa ditelusuri. */
  source: string | null;
};

export type Candidate = {
  slug: string;
  name: string;
  brand: string;
  model: string;
  variantLabel: string;
  variantKey: string;
  price: PriceResolution;
  detailHref: string;
  image: { src: string; alt: string; isGenericIllustration: boolean };
  /** Kenapa kandidat ini cocok, semuanya berbasis data tercatat. */
  reasons: MatchReason[];
  /** Apa yang dikorbankan. Kosong berarti tidak ada yang tercatat, bukan sempurna. */
  tradeOffs: MatchReason[];
  /** Terisi hanya untuk alternatif di luar budget. */
  overBudgetByIdr: number | null;
};

export type RecommendationResult = {
  /** Kandidat yang memenuhi SEMUA syarat wajib, dengan harga segar bila budget wajib. */
  matches: Candidate[];
  /**
   * Lolos semua syarat lain dan harga terakhirnya masuk budget wajib, tetapi
   * harga itu sudah melewati batas freshness. Bukan kandidat "memenuhi syarat".
   */
  staleMatches: Candidate[];
  /** Kandidat yang gagal HANYA karena melewati budget wajib, diberi label. */
  overBudget: Candidate[];
  /** Alasan kandidat lain tersingkir, dinyatakan terbuka. */
  exclusions: { name: string; reason: string }[];
  /** Syarat wajib yang benar-benar diterapkan sebagai penyaring. */
  appliedHardRules: string[];
  /** Catatan untuk pengguna, mis. merek yang diminta belum ada di katalog. */
  notes: string[];
  totalPublished: number;
};

/** Kandidat yang lolos syarat wajib, menunggu diberi skor setelah semua terkumpul. */
type Pending = {
  candidate: Candidate;
  order: number;
  input: ScoreInput;
  /** Faktor kecocokan budget "sekitar" (1 = pas). */
  fit: number;
  preferredBrand: boolean;
};

type Scored = { candidate: Candidate; score: number; order: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const FAST_CHARGING_WATT = 33;

/**
 * Pemeriksa syarat wajib berbasis spesifikasi produk.
 * `true` = terpenuhi, `false` = tidak, `null` = datanya belum tercatat.
 */
const SPEC_REQUIREMENTS: Partial<Record<Requirement, (specs: ProductSpecs) => boolean | null>> = {
  "5g": (specs) => specs.is5G,
  nfc: (specs) => specs.hasNfc,
  "jack-audio": (specs) => specs.has35mmJack,
  telefoto: (specs) => specs.cameraHasTelephoto,
  "tahan-air": (specs) => (specs.ipRating ? /IP6[789]/i.test(specs.ipRating) : null),
  "charging-cepat": (specs) =>
    specs.chargingWatt === null ? null : specs.chargingWatt >= FAST_CHARGING_WATT,
};

/** Kalimat fakta untuk syarat spesifikasi yang terpenuhi. */
function specRequirementFact(requirement: Requirement, specs: ProductSpecs): string | null {
  switch (requirement) {
    case "5g":
      return "Mendukung 5G (tercatat)";
    case "nfc":
      return "NFC tercatat ada";
    case "jack-audio":
      return "Colokan audio 3,5 mm tercatat ada";
    case "telefoto":
      return specs.cameraOpticalZoomX
        ? `Lensa telefoto tercatat, zoom optik ${specs.cameraOpticalZoomX}x`
        : "Lensa telefoto tercatat ada";
    case "tahan-air":
      return `Ketahanan air dan debu tercatat ${specs.ipRating}`;
    case "charging-cepat":
      return `Pengisian daya tercatat ${specs.chargingWatt} W`;
    default:
      return null;
  }
}

/** Label pendek fitur untuk alasan "belum tercatat". */
const SPEC_FEATURE_NAME: Partial<Record<Requirement, string>> = {
  "5g": "Dukungan 5G",
  nfc: "NFC",
  "jack-audio": "Colokan audio 3,5 mm",
  telefoto: "Lensa telefoto",
  "tahan-air": "Rating ketahanan air (IP)",
  "charging-cepat": "Daya pengisian",
};

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function bestPricedVariant(
  variants: Variant[],
  offers: Parameters<typeof resolveVariantPrice>[0]["offers"],
  observations: Parameters<typeof resolveVariantPrice>[0]["observations"],
  checks: Parameters<typeof resolveVariantPrice>[0]["checks"],
  now: Date
): { variant: Variant; price: PriceResolution } | null {
  let best: { variant: Variant; price: PriceResolution & { priceIdr: number } } | null = null;
  let bestStale: { variant: Variant; price: PriceResolution & { priceIdr: number } } | null = null;
  let fallback: { variant: Variant; price: PriceResolution } | null = null;

  for (const variant of variants) {
    const price = resolveVariantPrice({
      variantId: variant.id,
      offers,
      observations,
      checks,
      now,
    });

    if (price.status === "available") {
      if (!best || price.priceIdr < best.price.priceIdr) best = { variant, price };
    } else if (price.status === "stale") {
      if (!bestStale || price.priceIdr < bestStale.price.priceIdr) bestStale = { variant, price };
    } else if (!fallback) {
      fallback = { variant, price };
    }
  }

  return best ?? bestStale ?? fallback;
}

/**
 * Fakta kamera dari susunan lensa, bukan megapiksel (megapiksel tidak
 * menentukan kualitas foto). Kualitas hasil hanya dari kutipan reviewer.
 */
function cameraFact(specs: ProductSpecs): string {
  const parts: string[] = [];
  if (specs.cameraLensCount) parts.push(`${specs.cameraLensCount} lensa belakang`);
  if (specs.cameraHasUltrawide) parts.push("termasuk ultrawide");
  if (specs.cameraHasTelephoto) {
    parts.push(specs.cameraOpticalZoomX ? `telefoto zoom optik ${specs.cameraOpticalZoomX}x` : "telefoto");
  } else if (specs.cameraHasTelephoto === false) {
    parts.push("tanpa telefoto");
  }
  return parts.length > 0
    ? `Kamera tercatat: ${parts.join(", ")}. Kualitas foto tidak bisa disimpulkan dari spesifikasi`
    : "Susunan kamera belum tercatat";
}

/** Kalimat fakta harga terhadap budget; harga lama disebut "terakhir tercatat". */
function budgetFact(price: Exclude<PriceResolution, { status: "unavailable" }>, budgetIdr: number): string {
  const label = price.status === "available" ? "Harga" : "Harga terakhir tercatat";
  return price.priceIdr <= budgetIdr
    ? `${label} ${formatIdr(price.priceIdr)}, masuk budget ${formatIdr(budgetIdr)}`
    : `${label} ${formatIdr(price.priceIdr)}, masih di kisaran budget ${formatIdr(budgetIdr)}`;
}

function sameBrand(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function recommend(
  now: Date,
  needs: UserNeeds
): Promise<RecommendationResult> {
  return recommendFromCatalog(await loadPublishedCatalog(now), now, needs);
}

/**
 * Inti mesin rekomendasi, murni terhadap katalog yang diberikan. Dipisah dari
 * pemuatan data supaya aturan syarat wajib bisa diuji dengan katalog kecil
 * yang dikendalikan (scripts/tests/assistant.test.ts).
 */
export function recommendFromCatalog(
  catalog: CatalogDataset,
  now: Date,
  needs: UserNeeds
): RecommendationResult {
  const staleWindowMs = PRICING_POLICY.assistantStaleWindowDays * DAY_MS;

  const catalogBrands = [...new Set(catalog.products.map((product) => product.brand))];
  const knownBrand = (brand: string) => catalogBrands.find((known) => sameBrand(known, brand));

  const notes: string[] = [];
  const wantedBrands = needs.brands.map((brand) => knownBrand(brand) ?? brand);
  for (const brand of needs.brands) {
    if (!knownBrand(brand)) notes.push(`Merek ${brand} belum ada di katalog CekHarga.`);
  }
  const brandsOnly = needs.brandsOnly && wantedBrands.length > 0;

  const appliedHardRules: string[] = [];
  if (needs.budgetIdr !== null && needs.budgetIsHard) {
    appliedHardRules.push(
      `Harga tidak boleh melebihi ${needs.budgetIdr.toLocaleString("id-ID")} rupiah`
    );
  }
  for (const requirement of needs.requirements) {
    appliedHardRules.push(REQUIREMENT_LABELS[requirement]);
  }
  if (brandsOnly) appliedHardRules.push(`Hanya merek ${wantedBrands.join(", ")}`);
  if (needs.avoidBrands.length > 0) {
    appliedHardRules.push(`Bukan merek ${needs.avoidBrands.join(", ")}`);
  }

  const matches: Scored[] = [];
  const staleMatches: Scored[] = [];
  const overBudget: Scored[] = [];
  const exclusions: { name: string; reason: string }[] = [];
  const matchPending: Pending[] = [];
  const stalePending: Pending[] = [];

  catalog.products.forEach((product: Product, order: number) => {
    const name = `${product.brand} ${product.model}`;

    // Penyaring merek. Tidak masuk daftar pengecualian satu per satu: daftar
    // itu untuk alasan yang tidak terlihat dari syarat, sedangkan aturan merek
    // sudah tertulis di `appliedHardRules`.
    if (needs.avoidBrands.some((brand) => sameBrand(brand, product.brand))) return;
    if (brandsOnly && !wantedBrands.some((brand) => sameBrand(brand, product.brand))) return;

    // Syarat wajib berbasis spesifikasi. Data kosong = belum terpenuhi.
    const specReasons: MatchReason[] = [];
    for (const requirement of needs.requirements) {
      const check = SPEC_REQUIREMENTS[requirement];
      if (!check) continue;
      const result = check(product.specs);
      if (result === null) {
        exclusions.push({
          name,
          reason: `${SPEC_FEATURE_NAME[requirement]} belum tercatat, jadi belum bisa dipastikan memenuhi syarat "${REQUIREMENT_LABELS[requirement]}".`,
        });
        return;
      }
      if (!result) {
        exclusions.push({ name, reason: `Tidak memenuhi syarat "${REQUIREMENT_LABELS[requirement]}".` });
        return;
      }
      const fact = specRequirementFact(requirement, product.specs);
      if (fact) specReasons.push({ kind: "fact", text: fact, source: null });
    }

    // Syarat wajib pada varian. Kandidat yang tidak punya satu pun varian yang
    // memenuhi syarat memang tidak layak ditawarkan.
    const eligibleVariants = catalog.variants.filter((variant) => {
      if (variant.productId !== product.id) return false;
      if (needs.requirements.includes("garansi-resmi") && variant.region === null) {
        return false;
      }
      if (needs.requirements.includes("ram-8") && variant.ramGb < 8) return false;
      if (needs.requirements.includes("storage-256") && variant.storageGb < 256) {
        return false;
      }
      return true;
    });

    if (eligibleVariants.length === 0) {
      exclusions.push({
        name,
        reason: "Tidak ada varian tercatat yang memenuhi syarat wajibmu.",
      });
      return;
    }

    const picked = bestPricedVariant(
      eligibleVariants,
      catalog.offers,
      catalog.priceObservations,
      catalog.priceChecks,
      now
    );

    if (!picked) {
      exclusions.push({ name, reason: "Belum ada varian yang bisa dinilai." });
      return;
    }

    const { variant, price } = picked;
    const specs = product.specs;

    const reasons: MatchReason[] = [];
    const tradeOffs: MatchReason[] = [];

    const preferredBrand =
      !brandsOnly && wantedBrands.some((brand) => sameBrand(brand, product.brand));
    if (preferredBrand || brandsOnly) {
      reasons.push({ kind: "fact", text: `Merek ${product.brand} sesuai yang kamu sebut`, source: null });
    }

    // Alasan berbasis angka tercatat. Sengaja tidak menyimpulkan rasa pemakaian.
    if (needs.activities.includes("baterai") || needs.priority === "baterai") {
      reasons.push({
        kind: "fact",
        text: specs.batteryMah
          ? `Kapasitas baterai tercatat ${specs.batteryMah} mAh`
          : "Kapasitas baterai belum tercatat, jadi belum bisa dinilai",
        source: null,
      });
    }
    if (needs.activities.includes("foto") || needs.priority === "kamera") {
      reasons.push({ kind: "fact", text: cameraFact(specs), source: null });
    }
    if (needs.activities.includes("game") || needs.activities.includes("kerja") || needs.priority === "performa") {
      const tier = chipsetTier(specs.chipset);
      reasons.push({
        kind: "fact",
        text: specs.chipset
          ? tier
            ? `Chipset ${chipsetShortName(specs.chipset)}, perkiraan kelas ${CHIPSET_TIER_LABELS[tier]} menurut pengelompokan seri chipset CekHarga`
            : `Chipset tercatat: ${chipsetShortName(specs.chipset)}`
          : "Chipset belum tercatat, jadi performanya belum bisa dinilai",
        source: null,
      });
    }
    if (needs.activities.includes("kerja")) {
      reasons.push({
        kind: "fact",
        text: `Varian ini punya RAM ${variant.ramGb} GB dan penyimpanan ${variant.storageGb} GB`,
        source: null,
      });
    }
    if (needs.priority === "ringan") {
      reasons.push({
        kind: "fact",
        text: specs.weightGrams
          ? `Berat tercatat ${specs.weightGrams} gram`
          : "Berat belum tercatat, jadi belum bisa dinilai",
        source: null,
      });
    }
    if (needs.priority === "layar") {
      const parts = [
        specs.displayInches ? `${specs.displayInches} inci` : null,
        specs.refreshRateHz ? `${specs.refreshRateHz} Hz` : null,
        specs.displayTechnology,
      ].filter(Boolean);
      reasons.push({
        kind: "fact",
        text: parts.length > 0 ? `Layar tercatat ${parts.join(", ")}` : "Detail layar belum tercatat",
        source: null,
      });
    }
    reasons.push(...specReasons);

    // Kutipan reviewer dipakai untuk hal yang memang tidak bisa disimpulkan dari
    // angka. Selalu membawa nama channel sebagai sumber.
    for (const review of catalog.reviews) {
      if (review.productId !== product.id) continue;
      const relevant =
        (needs.priority === "baterai" &&
          review.aspect.toLowerCase().includes("baterai")) ||
        (needs.priority === "kamera" &&
          review.aspect.toLowerCase().includes("kamera")) ||
        (needs.priority === "performa" &&
          review.aspect.toLowerCase().includes("performa"));

      if (relevant) {
        reasons.push({
          kind: "review",
          text: review.summary,
          source: review.channelName,
        });
      }
      for (const limitation of review.limitations) {
        tradeOffs.push({
          kind: "review",
          text: limitation,
          source: review.channelName,
        });
      }
    }

    if (price.status === "stale") {
      tradeOffs.push({
        kind: "fact",
        text: `Harga terakhir tercatat ${formatDay(price.observedAt)} dan perlu dicek ulang di toko`,
        source: null,
      });
    } else if (price.status === "unavailable") {
      tradeOffs.push({
        kind: "fact",
        text: "Belum ada penawaran yang memenuhi syarat, jadi harganya belum bisa dipastikan",
        source: null,
      });
    }

    const asset =
      catalog.assets.find((entry) => entry.productId === product.id && entry.kind === "photo") ??
      catalog.assets.find((entry) => entry.productId === product.id);

    const candidate: Candidate = {
      slug: product.slug,
      name,
      brand: product.brand,
      model: product.model,
      variantLabel: formatVariantLabel(variant),
      variantKey: variantKey(variant),
      price,
      detailHref: `/products/${product.slug}?varian=${variantKey(variant)}`,
      image: {
        src: asset?.src ?? "/images/generic-device.svg",
        alt: asset?.alt ?? "Ilustrasi generik perangkat smartphone",
        isGenericIllustration: asset?.kind !== "photo",
      },
      reasons,
      tradeOffs,
      overBudgetByIdr: null,
    };

    const pending: Pending = {
      candidate,
      order,
      input: {
        specs,
        ramGb: variant.ramGb,
        priceIdr: price.status === "unavailable" ? null : price.priceIdr,
        hasCameraReview: catalog.reviews.some(
          (review) => review.productId === product.id && review.aspect.toLowerCase().includes("kamera")
        ),
      },
      fit: 1,
      preferredBrand,
    };

    // Penyaring budget dijalankan paling akhir supaya kandidat yang lolos semua
    // syarat lain tetap bisa ditawarkan sebagai alternatif berlabel.
    if (needs.budgetIdr !== null && needs.budgetIsHard) {
      /*
        Harga yang tidak diketahui bukan berarti murah. Kandidat tanpa harga,
        atau dengan harga yang terlalu lama, tidak boleh lolos batas budget
        keras. Alasannya disebutkan supaya pengguna tahu ia ada.
      */
      if (price.status === "unavailable") {
        exclusions.push({
          name,
          reason:
            "Harganya belum bisa dipastikan, jadi tidak bisa dijamin masuk budget yang kamu tetapkan sebagai batas keras.",
        });
        return;
      }
      if (price.status === "stale" && now.getTime() - new Date(price.observedAt).getTime() > staleWindowMs) {
        exclusions.push({
          name,
          reason: `Harga terakhir tercatat ${formatDay(price.observedAt)}, terlalu lama untuk dibandingkan dengan budgetmu.`,
        });
        return;
      }

      const over = price.priceIdr - needs.budgetIdr;
      if (over > 0) {
        overBudget.push({ candidate: { ...candidate, overBudgetByIdr: over }, score: 0, order });
        return;
      }
      reasons.unshift({ kind: "fact", text: budgetFact(price, needs.budgetIdr), source: null });
      if (price.priceIdr < needs.budgetIdr * 0.5) pending.fit = 0.75;
      if (price.status === "stale") {
        stalePending.push(pending);
        return;
      }
    } else if (needs.budgetIdr !== null) {
      /*
        Budget "sekitar" (rancangan Tanya AI §3.4): sampai +15% masih masuk,
        +15% sampai +30% skornya turun dan dicatat sebagai kompromi, di atas
        +30% dipindah ke alternatif berlabel "di luar budget". Dulu kelebihan
        harga hanya dicatat, sehingga HP Rp32 juta bersaing dengan budget Rp3
        juta.
      */
      const fit = softBudgetFit(pending.input.priceIdr, needs.budgetIdr);
      if (fit.band === "over" && price.status !== "unavailable") {
        overBudget.push({
          candidate: { ...candidate, overBudgetByIdr: price.priceIdr - needs.budgetIdr },
          score: 0,
          order,
        });
        return;
      }
      pending.fit = fit.factor;
      if (fit.band === "stretch" && price.status !== "unavailable") {
        const over = price.priceIdr - needs.budgetIdr;
        tradeOffs.push({
          kind: "fact",
          text: `Melewati budget yang kamu sebut sebesar ${over.toLocaleString("id-ID")} rupiah (${Math.round((fit.ratio - 1) * 100)}%)`,
          source: null,
        });
      } else if (fit.band === "inside" && price.status !== "unavailable") {
        reasons.unshift({ kind: "fact", text: budgetFact(price, needs.budgetIdr), source: null });
      }
    }

    matchPending.push(pending);
  });

  // Skor dihitung setelah semua kandidat terkumpul, karena nilai fitur relatif
  // terhadap kandidat yang sedang dibandingkan. Skor hanya mengurutkan; tidak
  // pernah ditampilkan dan tidak pernah membuang kandidat.
  const priorities = needs.priority ? [needs.priority] : [];
  const weights = featureWeights(priorities, needs.activities);
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + (weight ?? 0), 0) || 1;
  const context = buildScoreContext([...matchPending, ...stalePending].map((entry) => entry.input));
  const toScored = (entry: Pending): Scored => {
    const features = featureScores(entry.input, context);
    let base = 0;
    for (const [feature, weight] of Object.entries(weights) as [Feature, number][]) {
      base += features[feature] * weight;
    }
    const year = context.year && entry.input.specs.releaseYear !== null && context.year.max > context.year.min
      ? (entry.input.specs.releaseYear - context.year.min) / (context.year.max - context.year.min)
      : 0;
    const freshness = entry.candidate.price.status === "available" ? 0.3 : entry.candidate.price.status === "stale" ? 0.1 : 0;
    const score = ((base / totalWeight) * 10 + year * 0.5 + freshness + (entry.preferredBrand ? 3 : 0)) * entry.fit;
    return { candidate: entry.candidate, score, order: entry.order };
  };
  matches.push(...matchPending.map(toScored));
  staleMatches.push(...stalePending.map(toScored));

  const sortByScore = (a: Scored, b: Scored) => b.score - a.score || a.order - b.order;
  const byOverAmount = (a: Scored, b: Scored) =>
    (a.candidate.overBudgetByIdr ?? 0) - (b.candidate.overBudgetByIdr ?? 0) || a.order - b.order;

  // Keragaman di posisi teratas: satu per seri, dua per merek (kecuali pengguna
  // memang meminta merek tertentu saja).
  const varied = (list: Scored[]) =>
    diversify(
      list.sort(sortByScore).map((entry) => entry.candidate),
      (candidate) => ({ series: seriesKey(candidate.brand, candidate.model), brand: candidate.brand.toLowerCase() }),
      { brandLimit: !brandsOnly }
    );

  return {
    matches: varied(matches),
    staleMatches: varied(staleMatches),
    overBudget: overBudget.sort(byOverAmount).map((entry) => entry.candidate),
    exclusions,
    appliedHardRules,
    notes,
    totalPublished: catalog.products.length,
  };
}
