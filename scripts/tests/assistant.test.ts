// Uji deterministik mesin rekomendasi asisten (PRD FR-06).
// Jalankan: pnpm test:assistant
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildNeedsHref, parseNeeds, type UserNeeds } from "@/lib/assistant/needs";
import { recommendFromCatalog } from "@/lib/assistant/recommend";
import { RESULT_LIMITS, toResultView } from "@/lib/assistant/results";
import { chipsetShortName, chipsetTier } from "@/lib/assistant/chipset-tiers";
import type { CatalogDataset, ProductSpecs } from "@/lib/catalog/schema";

const NOW = new Date("2026-10-02T05:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const BASE_SPECS: ProductSpecs = {
  displayInches: 6.7,
  displayTechnology: "AMOLED",
  refreshRateHz: 120,
  chipset: "Chip Uji",
  batteryMah: 5000,
  chargingWatt: 45,
  mainCameraMp: 50,
  cameraLensCount: 3,
  cameraHasUltrawide: true,
  cameraHasTelephoto: false,
  cameraOpticalZoomX: null,
  weightGrams: 190,
  releaseYear: 2026,
  is5G: true,
  hasNfc: true,
  ipRating: "IP68",
  has35mmJack: false,
  osVersion: "Android 16",
  colorOptions: null,
};

type Spec = {
  brand: string;
  model: string;
  specs?: Partial<ProductSpecs>;
  region?: string | null;
  ramGb?: number;
  storageGb?: number;
  /** Harga dan umur pengamatan dalam jam; null = tanpa penawaran. */
  price: { idr: number; ageHours: number } | null;
};

function catalog(items: Spec[]): CatalogDataset {
  const provenance = { source: "Uji", url: null, retrievedAt: hoursAgo(1) };
  const data: CatalogDataset = {
    products: [],
    variants: [],
    assets: [],
    reviews: [],
    offers: [],
    priceObservations: [],
    priceChecks: [],
    stores: [],
    slugRedirects: [],
  };
  items.forEach((item, index) => {
    const id = `p${index}`;
    data.products.push({
      id,
      slug: `${item.brand}-${item.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      brand: item.brand,
      model: item.model,
      specs: { ...BASE_SPECS, ...item.specs },
      specsProvenance: provenance,
      status: "published",
    });
    data.variants.push({
      id: `${id}-v`,
      productId: id,
      ramGb: item.ramGb ?? 8,
      storageGb: item.storageGb ?? 256,
      region: item.region === undefined ? "Garansi resmi Indonesia" : item.region,
    });
    if (item.price) {
      data.offers.push({
        id: `${id}-o`,
        variantId: `${id}-v`,
        marketplace: "Uji",
        sellerName: "Toko Uji",
        url: "https://example.com/produk",
        condition: "new",
        warranty: null,
        listingStatus: "active",
        sellerVerified: false,
        storeId: null,
      });
      data.priceObservations.push({
        id: `${id}-obs`,
        offerId: `${id}-o`,
        priceIdr: item.price.idr,
        observedAt: hoursAgo(item.price.ageHours),
        origin: "manual",
      });
    }
  });
  return data;
}

function needs(overrides: Partial<UserNeeds> = {}): UserNeeds {
  return {
    budgetIdr: null,
    budgetIsHard: null,
    activities: [],
    requirements: [],
    requirementsAnswered: true,
    priority: null,
    brands: [],
    brandsOnly: false,
    avoidBrands: [],
    ...overrides,
  };
}

const names = (list: { name: string }[]) => list.map((entry) => entry.name);

const TRIO = catalog([
  { brand: "Alpha", model: "Segar", price: { idr: 2_800_000, ageHours: 2 } },
  { brand: "Beta", model: "Lama", specs: { hasNfc: false, is5G: null }, region: null, price: { idr: 2_500_000, ageHours: 5 * 24 } },
  { brand: "Gamma", model: "Usang", specs: { hasNfc: null }, price: { idr: 2_000_000, ageHours: 20 * 24 } },
]);

test("budget keras: harga segar memenuhi syarat, harga lama dipisah, harga usang dikecualikan", () => {
  const result = recommendFromCatalog(TRIO, NOW, needs({ budgetIdr: 3_000_000, budgetIsHard: true }));
  assert.deepEqual(names(result.matches), ["Alpha Segar"]);
  assert.deepEqual(names(result.staleMatches), ["Beta Lama"]);
  assert.deepEqual(names(result.exclusions), ["Gamma Usang"]);
  assert.match(result.exclusions[0].reason, /terlalu lama/);
});

test("budget keras: kelebihan harga masuk alternatif berlabel, bukan memenuhi syarat", () => {
  const result = recommendFromCatalog(TRIO, NOW, needs({ budgetIdr: 2_600_000, budgetIsHard: true }));
  assert.deepEqual(names(result.matches), []);
  assert.deepEqual(names(result.overBudget), ["Alpha Segar"]);
  assert.equal(result.overBudget[0].overBudgetByIdr, 200_000);
  assert.deepEqual(names(result.staleMatches), ["Beta Lama"]);
});

test("budget perkiraan: harga lama tetap tampil dengan kompromi yang jujur", () => {
  const result = recommendFromCatalog(TRIO, NOW, needs({ budgetIdr: 3_000_000, budgetIsHard: false }));
  assert.equal(result.matches.length, 3);
  const beta = result.matches.find((candidate) => candidate.brand === "Beta");
  assert.ok(beta?.tradeOffs.some((tradeOff) => /perlu dicek ulang/.test(tradeOff.text)));
});

test("syarat spesifikasi: tidak terpenuhi dan belum tercatat sama-sama dikecualikan", () => {
  const result = recommendFromCatalog(TRIO, NOW, needs({ requirements: ["nfc"] }));
  assert.deepEqual(names(result.matches), ["Alpha Segar"]);
  const reasons = Object.fromEntries(result.exclusions.map((entry) => [entry.name, entry.reason]));
  assert.match(reasons["Beta Lama"], /Tidak memenuhi/);
  assert.match(reasons["Gamma Usang"], /belum tercatat/);
  assert.ok(result.matches[0].reasons.some((reason) => reason.text === "NFC tercatat ada"));
  assert.ok(result.appliedHardRules.includes("Harus ada NFC"));
});

test("syarat varian: garansi resmi menyaring varian tanpa region", () => {
  const result = recommendFromCatalog(TRIO, NOW, needs({ requirements: ["garansi-resmi"] }));
  assert.ok(!names(result.matches).includes("Beta Lama"));
  assert.ok(names(result.exclusions).includes("Beta Lama"));
});

test("tahan air dan pengisian cepat dibaca dari spesifikasi", () => {
  const data = catalog([
    { brand: "A", model: "IP68", price: { idr: 1, ageHours: 1 } },
    { brand: "B", model: "IP54", specs: { ipRating: "IP54" }, price: { idr: 1, ageHours: 1 } },
    { brand: "C", model: "Lambat", specs: { chargingWatt: 18 }, price: { idr: 1, ageHours: 1 } },
  ]);
  assert.deepEqual(names(recommendFromCatalog(data, NOW, needs({ requirements: ["tahan-air"] })).matches), ["A IP68", "C Lambat"]);
  assert.deepEqual(names(recommendFromCatalog(data, NOW, needs({ requirements: ["charging-cepat"] })).matches), ["A IP68", "B IP54"]);
});

test("merek: hindari, hanya, dan preferensi", () => {
  const avoid = recommendFromCatalog(TRIO, NOW, needs({ avoidBrands: ["alpha"] }));
  assert.ok(!names(avoid.matches).includes("Alpha Segar"));
  assert.ok(avoid.appliedHardRules.some((rule) => rule.startsWith("Bukan merek")));

  const only = recommendFromCatalog(TRIO, NOW, needs({ brands: ["BETA"], brandsOnly: true }));
  assert.deepEqual(names(only.matches), ["Beta Lama"]);

  const prefer = recommendFromCatalog(TRIO, NOW, needs({ brands: ["Gamma", "Zeta"] }));
  assert.equal(prefer.matches[0].brand, "Gamma", "merek yang disukai didahulukan");
  assert.equal(prefer.matches.length, 3, "preferensi tidak membuang merek lain");
  assert.deepEqual(prefer.notes, ["Merek Zeta belum ada di katalog CekHarga."]);
});

test("tampilan dibatasi dan sisanya diarahkan ke katalog dengan filter setara", () => {
  const many = catalog(
    Array.from({ length: 8 }, (_, index) => ({ brand: "Alpha", model: `M${index}`, price: { idr: 1_000_000 + index, ageHours: 1 } }))
  );
  const userNeeds = needs({ budgetIdr: 2_000_000, budgetIsHard: true, brands: ["Alpha"], brandsOnly: true });
  const view = toResultView(recommendFromCatalog(many, NOW, userNeeds), userNeeds);
  assert.equal(view.matches.length, RESULT_LIMITS.matches);
  assert.equal(view.totals.matches, 8);
  assert.equal(view.catalogHref, "/products?harga_max=2000000&merek=Alpha");
  assert.ok(view.shareHref.startsWith("/assistant?tanya=form&"));
});

test("budget sekitar: lebih dari +30% pindah ke alternatif berlabel, +15–30% turun dan dicatat", () => {
  const data = catalog([
    { brand: "Mahal", model: "Lipat", price: { idr: 32_500_000, ageHours: 2 } },
    { brand: "Pas", model: "Satu", price: { idr: 2_900_000, ageHours: 2 } },
    { brand: "Lebih", model: "Dikit", price: { idr: 3_600_000, ageHours: 2 } },
  ]);
  const result = recommendFromCatalog(data, NOW, needs({ budgetIdr: 3_000_000, budgetIsHard: false }));
  assert.deepEqual(names(result.matches), ["Pas Satu", "Lebih Dikit"]);
  assert.deepEqual(names(result.overBudget), ["Mahal Lipat"]);
  assert.ok(result.matches[1].tradeOffs.some((tradeOff) => /Melewati budget .*\(20%\)/.test(tradeOff.text)));
  assert.ok(result.matches[0].reasons.some((reason) => /masuk budget/.test(reason.text)));
});

test("kegunaan ikut menentukan urutan: game mendahulukan chipset kelas lebih tinggi", () => {
  const data = catalog([
    { brand: "Entry", model: "G81", specs: { chipset: "Mediatek Helio G81 Ultra (12 nm)" }, price: { idr: 2_500_000, ageHours: 2 } },
    { brand: "Mid", model: "7s", specs: { chipset: "Qualcomm SM7635 Snapdragon 7s Gen 3 (4 nm)" }, price: { idr: 2_900_000, ageHours: 2 } },
  ]);
  const result = recommendFromCatalog(data, NOW, needs({ budgetIdr: 3_000_000, budgetIsHard: false, activities: ["game"] }));
  assert.deepEqual(names(result.matches), ["Mid 7s", "Entry G81"]);
  assert.ok(result.matches[0].reasons.some((reason) => /perkiraan kelas menengah/.test(reason.text)));
});

test("keragaman: satu seri dan paling banyak dua merek yang sama di tiga teratas", () => {
  const data = catalog([
    { brand: "Xiaomi", model: "Redmi Note 17 Pro Max", price: { idr: 1_000_000, ageHours: 2 } },
    { brand: "Xiaomi", model: "Redmi Note 17 Pro", price: { idr: 1_100_000, ageHours: 2 } },
    { brand: "Xiaomi", model: "Redmi 17", price: { idr: 1_200_000, ageHours: 2 } },
    { brand: "Xiaomi", model: "Poco X8", price: { idr: 1_300_000, ageHours: 2 } },
    { brand: "Samsung", model: "Galaxy A17", price: { idr: 1_400_000, ageHours: 2 } },
  ]);
  const top = names(recommendFromCatalog(data, NOW, needs({ priority: "harga" })).matches).slice(0, 3);
  assert.deepEqual(top, ["Xiaomi Redmi Note 17 Pro Max", "Xiaomi Redmi 17", "Samsung Galaxy A17"]);
});

test("kelas chipset: aturan seri dan chipset ganda per wilayah", () => {
  assert.equal(chipsetTier("Qualcomm SM8850-AC Snapdragon 8 Elite Gen 5 (3 nm)"), 5);
  assert.equal(chipsetTier("Mediatek Dimensity 8400 Ultra (4 nm)"), 4);
  assert.equal(chipsetTier("Mediatek Dimensity 7300 Energy (4 nm)"), 3);
  assert.equal(chipsetTier("Mediatek Dimensity 6300 (6 nm)"), 2);
  assert.equal(chipsetTier("Unisoc Tiger T612 (12 nm)"), 1);
  assert.equal(chipsetTier("Qualcomm SM8850-1-AD Snapdragon 8 Elite Gen 5 (3 nm) - US/CA/CN Exynos 2600 (2 nm) - ROW"), 5);
  assert.equal(chipsetTier("Chip Uji"), null);
  assert.equal(chipsetShortName("Qualcomm SM7635-AC Snapdragon 7s Gen 4 (4 nm)"), "Snapdragon 7s Gen 4");
});

test("tautan kebutuhan bolak-balik tanpa kehilangan data", () => {
  const original = needs({
    budgetIdr: 3_500_000,
    budgetIsHard: true,
    activities: ["game", "foto"],
    requirements: ["nfc", "5g"],
    priority: "ringan",
    brands: ["Samsung", "Nothing Phone"],
    brandsOnly: true,
    avoidBrands: ["Infinix"],
  });
  const href = buildNeedsHref(original);
  const params = new URLSearchParams(href.split("?")[1]);
  const raw: Record<string, string[]> = {};
  for (const [key, value] of params) (raw[key] ??= []).push(value);
  assert.deepEqual(parseNeeds(raw), original);
});

test("URL rusak tidak menggagalkan halaman", () => {
  const parsed = parseNeeds({ budget: "abc", wajib: ["nfc", "palsu"], prioritas: "x", merek: ["  ", "A".repeat(80)] });
  assert.equal(parsed.budgetIdr, null);
  assert.deepEqual(parsed.requirements, ["nfc"], "nilai tak dikenal dibuang, bukan diganti");
  assert.equal(parsed.priority, null);
  assert.equal(parsed.brands[0].length, 30);
});

// Kuota harian AI (PB-21): IP tidak pernah tersimpan mentah, dan pesan
// penolakan selalu menunjuk jalur form yang tidak memanggil model.
import { quotaMessage, quotaSubject } from "@/lib/assistant/ai/quota";
import { AI_LIMITS } from "@/lib/assistant/ai/client";

test("kuota AI: subjek adalah HMAC IP yang stabil, bukan IP mentah", () => {
  const a = quotaSubject("203.0.113.7", "rahasia-1");
  assert.equal(a, quotaSubject("203.0.113.7", "rahasia-1"));
  assert.notEqual(a, quotaSubject("203.0.113.8", "rahasia-1"));
  assert.notEqual(a, quotaSubject("203.0.113.7", "rahasia-2"));
  assert.ok(!a.includes("203"), "subjek tidak boleh memuat IP");
  assert.match(a, /^[0-9a-f]{40}$/);
});

test("kuota AI: penolakan menyarankan form, dan batas retry tetap terbatas", () => {
  for (const reason of ["client", "global", "unavailable"] as const) {
    assert.match(quotaMessage(reason), /form/);
  }
  assert.ok(AI_LIMITS.maxRetries >= 1 && AI_LIMITS.maxRetries <= 2);
  assert.ok(AI_LIMITS.dailyPerClient < AI_LIMITS.dailyGlobal);
});
