// Uji deterministik aturan etalase beranda (src/lib/catalog/showcase.ts).
// Jalankan: pnpm test:catalog
import { test } from "node:test";
import assert from "node:assert/strict";

import { pickComparisonPair, pickComparisonPairs, pickHeroProduct, type ShowcaseCandidate } from "@/lib/catalog/showcase";

const available = (priceIdr: number, checkedAt = "2026-10-07T00:00:00Z") =>
  ({ status: "available", priceIdr, checkedAt, offerId: "o", variantId: "v", origin: "manual" }) as const;
const stale = (priceIdr: number) =>
  ({ status: "stale", priceIdr, observedAt: "2026-09-01T00:00:00Z", offerId: "o", variantId: "v" }) as const;
const item = (slug: string, brand: string, price: ShowcaseCandidate["price"]): ShowcaseCandidate => ({ slug, brand, price });

test("pasangan perbandingan: dua merek berbeda dengan harga segar paling berdekatan", () => {
  const pair = pickComparisonPair([
    item("oppo-a6s", "OPPO", available(4_499_000)),
    item("oppo-a6x", "OPPO", available(4_400_000)), // merek sama: tidak dipasangkan
    item("vivo-y29", "vivo", available(4_700_000)),
    item("samsung-a17", "Samsung", available(5_299_000)),
    item("iphone-17", "Apple", available(20_499_000)),
  ]);
  assert.deepEqual(pair, ["oppo-a6s", "vivo-y29"]);
});

test("pasangan perbandingan: harga basi atau kosong tidak dipakai", () => {
  assert.equal(
    pickComparisonPair([
      item("a", "A", stale(1_000_000)),
      item("b", "B", { status: "unavailable" }),
      item("c", "C", available(2_000_000)),
    ]),
    null,
    "butuh minimal dua merek dengan harga segar"
  );
});

test("pasangan perbandingan: pasangan kedua tidak berbagi produk dengan yang pertama (audit 002 no 4)", () => {
  const candidates = [
    item("oppo-a6s", "OPPO", available(4_499_000)),
    item("vivo-y29", "vivo", available(4_700_000)),
    item("samsung-a17", "Samsung", available(5_299_000)),
    item("xiaomi-15t", "Xiaomi", available(5_399_000)),
  ];
  const pairs = pickComparisonPairs(candidates, 2);
  assert.deepEqual(pairs, [
    ["samsung-a17", "xiaomi-15t"],
    ["oppo-a6s", "vivo-y29"],
  ]);
  assert.deepEqual(pairs[0], pickComparisonPair(candidates), "pasangan pertama sama dengan pilihan tunggal");
  assert.equal(pickComparisonPairs(candidates.slice(0, 3), 2).length, 1, "tiga produk hanya cukup untuk satu pasangan terpisah");
});

test("pasangan perbandingan: deterministik saat selisih seri", () => {
  const candidates = [
    item("b-phone", "B", available(2_000_000)),
    item("a-phone", "A", available(1_000_000)),
    item("c-phone", "C", available(3_000_000)),
  ];
  assert.deepEqual(pickComparisonPair(candidates), pickComparisonPair([...candidates].reverse()));
});

test("produk hero: harga segar terbaru, lalu harga terakhir tercatat, lalu produk pertama", () => {
  const hero = pickHeroProduct([
    item("lama", "A", available(1, "2026-10-05T00:00:00Z")),
    item("baru", "B", available(1, "2026-10-07T08:00:00Z")),
    item("basi", "C", stale(1)),
  ]);
  assert.equal(hero?.slug, "baru");
  // Tanpa harga segar: harga terakhir tercatat didahulukan dari produk tanpa harga (UX-23).
  assert.equal(
    pickHeroProduct([item("kosong", "A", { status: "unavailable" }), item("basi", "B", stale(1))])?.slug,
    "basi"
  );
  assert.equal(pickHeroProduct([item("x", "A", { status: "unavailable" })])?.slug, "x");
  assert.equal(pickHeroProduct([]), null);
});

import robots from "@/app/robots";
import { siteUrl } from "@/lib/site-url";

test("SITE_URL: hanya https yang valid; tanpa nilai, robots menolak semua crawler", () => {
  const original = process.env.SITE_URL;
  try {
    delete process.env.SITE_URL;
    assert.equal(siteUrl(), null);
    assert.deepEqual(robots(), { rules: { userAgent: "*", disallow: "/" } });

    process.env.SITE_URL = "http://cekharga.example";
    assert.equal(siteUrl(), null, "http ditolak");

    process.env.SITE_URL = "https://cekharga.example/jalur/apa/saja";
    assert.equal(siteUrl()?.href, "https://cekharga.example/");
    const rules = robots();
    assert.equal(rules.sitemap, "https://cekharga.example/sitemap.xml");
    assert.deepEqual((rules.rules as { disallow: string[] }).disallow, ["/admin", "/api/", "/style-guide"]);
  } finally {
    if (original === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = original;
  }
});

// PB-34 (2026-10-14): harga seri memakai pemeriksaan terbaru; chip kapasitas memuat harga.
import { resolveVariantPrice, variantPriceNote } from "@/lib/catalog/pricing";

test("harga seri: waktu yang tampil adalah pemeriksaan paling baru, segar maupun lama", () => {
  const offer = (id: string) => ({ id, variantId: "v1", marketplace: id, sellerName: id, url: `https://contoh.id/${id}`, condition: "new" as const, warranty: null, listingStatus: "active" as const, sellerVerified: false, storeId: null });
  const obs = (offerId: string, iso: string) => ({ id: `${offerId}-${iso}`, offerId, priceIdr: 2899000, observedAt: iso, origin: "manual" as const });
  const now = new Date("2026-10-14T12:00:00.000Z");
  const stale = resolveVariantPrice({
    variantId: "v1",
    offers: [offer("resmi"), offer("shopee")],
    observations: [obs("resmi", "2026-10-08T14:16:25.000Z"), obs("shopee", "2026-10-12T02:00:00.000Z")],
    checks: [],
    now,
  });
  assert.equal(stale.status, "stale");
  assert.equal(stale.status === "stale" && stale.observedAt, "2026-10-12T02:00:00.000Z");
  const fresh = resolveVariantPrice({
    variantId: "v1",
    offers: [offer("resmi"), offer("shopee")],
    observations: [obs("resmi", "2026-10-14T01:00:00.000Z"), obs("shopee", "2026-10-14T09:00:00.000Z")],
    checks: [],
    now,
  });
  assert.equal(fresh.status === "available" && fresh.checkedAt, "2026-10-14T09:00:00.000Z");
});

test("chip kapasitas: harga segar, harga lama berlabel, kosong hanya bila tidak ada catatan", () => {
  assert.deepEqual(variantPriceNote({ status: "unavailable" }), { text: "Belum ada harga", tone: "default" });
  const stale = variantPriceNote({ status: "stale", priceIdr: 3299000, observedAt: "2026-10-12T02:00:00.000Z", offerId: "o", variantId: "v" });
  assert.equal(stale.tone, "warning");
  assert.match(stale.text, /^Terakhir Rp\s?3\.299\.000$/);
});

// PB-23 + PB-12 (2026-10-14): judul, deskripsi, dan JSON-LD halaman produk.
import { compactIdr, monthLabel, productDescription, productJsonLd, productTitle, serializeJsonLd } from "@/lib/catalog/product-seo";

const seoBase = {
  name: "Xiaomi Redmi 17", brand: "Xiaomi", model: "Redmi 17", slug: "xiaomi-redmi-17",
  image: { src: "https://cdn.contoh/a.webp", alt: "a", isGenericIllustration: false },
  gallery: [{ src: "https://cdn.contoh/a.webp", alt: "a", source: "Shopee" }],
  variants: [{}, {}, {}] as never[],
  selectedVariant: { label: "4/128 GB" } as never,
};

test("SEO: 'Terbaru' dan 'Mulai' hanya dengan harga segar; bulan dari pemeriksaan, bukan hari ini", () => {
  const fresh = { ...seoBase, price: { status: "unavailable" } as never, freshOfferSummary: { lowPriceIdr: 2899000, highPriceIdr: 3849000, offerCount: 4, storeCount: 2, checkedAt: "2026-09-30T20:00:00.000Z" } };
  assert.equal(productTitle(fresh), "Harga Xiaomi Redmi 17 Terbaru Okt 2026, Mulai Rp2,8 Juta", "20.00 UTC 30 Sep = 1 Okt WIB; harga dibulatkan ke bawah");
  assert.match(productDescription(fresh), /mulai Rp\s?2\.899\.000 di 2 toko, diperiksa 1 Okt 2026/);
  const ld = productJsonLd(fresh, null) as { offers?: { lowPrice: number; offerCount: number }; aggregateRating?: unknown; review?: unknown };
  assert.deepEqual([ld.offers?.lowPrice, ld.offers?.offerCount], [2899000, 4]);
  assert.equal(ld.aggregateRating, undefined);
  assert.equal(ld.review, undefined);

  const stale = { ...seoBase, price: { status: "stale", priceIdr: 2899000, observedAt: "2026-10-12T02:00:00.000Z" } as never, freshOfferSummary: null };
  assert.equal(productTitle(stale), "Harga Xiaomi Redmi 17: Spesifikasi, Varian, dan Penawaran");
  assert.match(productDescription(stale), /^Harga terakhir tercatat Xiaomi Redmi 17 4\/128 GB: Rp\s?2\.899\.000 pada 12 Okt 2026; harga bisa sudah berubah/);
  assert.equal((productJsonLd(stale, null) as { offers?: unknown }).offers, undefined, "harga lama tidak masuk data terstruktur");
  assert.equal(compactIdr(899000), "Rp899 Ribu");
  assert.equal(monthLabel("2026-12-31T18:00:00.000Z"), "Jan 2027");
  assert.ok(!serializeJsonLd({ name: "</script><script>" }).includes("<"));
});

import { publishBlockers } from "@/lib/admin/publish-rules";

test("gerbang terbit (PB-15): wajib varian dan minimal satu penawaran aktif", () => {
  const blockers = publishBlockers(
    ["tanpa-varian", "tanpa-aktif", "siap"],
    [
      { id: "v1", product_id: "tanpa-aktif" },
      { id: "v2", product_id: "siap" },
      { id: "v3", product_id: "siap" },
    ],
    [
      { variant_id: "v1", listing_status: "out-of-stock" },
      { variant_id: "v1", listing_status: "inactive" },
      { variant_id: "v3", listing_status: "active" },
    ]
  );
  assert.equal(blockers.get("tanpa-varian"), "tanpa-varian");
  assert.equal(blockers.get("tanpa-aktif"), "tanpa-penawaran");
  assert.equal(blockers.has("siap"), false);
});

import { isOfficialWarranty, normalizeWarranty } from "@/lib/catalog/warranty";

test("PB-27 teks garansi dibakukan; yang tidak jelas tidak dianggap resmi", () => {
  assert.equal(normalizeWarranty("Resmi SEIN 1 thn"), "Garansi resmi Indonesia, 1 tahun");
  assert.equal(normalizeWarranty("garansi resmi indonesia"), "Garansi resmi Indonesia");
  assert.equal(normalizeWarranty("Inter, bukan resmi"), "Tanpa garansi resmi (internasional)");
  assert.equal(normalizeWarranty("Garansi toko 7 hari"), "Garansi toko, 7 hari");
  assert.equal(normalizeWarranty("Garansi distributor 12 bulan"), "Garansi distributor, 12 bulan");
  assert.equal(normalizeWarranty("ada"), "ada");
  assert.equal(normalizeWarranty("  "), null);
  assert.equal(isOfficialWarranty(normalizeWarranty("Official Samsung")), true);
  assert.equal(isOfficialWarranty("ada"), false);
  assert.equal(isOfficialWarranty(normalizeWarranty("ex-inter")), false);
});

import { findPair, pairPath } from "@/lib/catalog/compare-pair-rules";

test("PB-28 alamat A vs B: slug bertanda hubung, urutan terbalik dikenali", () => {
  const pairs = [{ a: "xiaomi-redmi-note-17-pro", b: "xiaomi-redmi-note-17-pro-max" }];
  assert.equal(pairPath(pairs[0]!), "/bandingkan/xiaomi-redmi-note-17-pro-vs-xiaomi-redmi-note-17-pro-max");
  assert.deepEqual(findPair("xiaomi-redmi-note-17-pro-vs-xiaomi-redmi-note-17-pro-max", pairs), { pair: pairs[0], reversed: false });
  assert.deepEqual(findPair("xiaomi-redmi-note-17-pro-max-vs-xiaomi-redmi-note-17-pro", pairs), { pair: pairs[0], reversed: true });
  assert.equal(findPair("apple-iphone-17-vs-samsung-galaxy-s26", pairs), null, "pasangan yang tidak dipilih admin tidak punya halaman");
});

import { findNeedPage, needPagePath, needPageQualifies, NEED_PAGES } from "@/lib/catalog/need-pages";
import { interpretCatalogNeeds } from "@/lib/catalog/semantic-needs";

test("PB-29 halaman kebutuhan: minimal 3 produk segar, dan kalimatnya dipahami pencarian", () => {
  assert.equal(needPageQualifies(2), false);
  assert.equal(needPageQualifies(3), true);
  assert.equal(needPagePath(findNeedPage("hp-5g-di-bawah-3-juta")!), "/hp/hp-5g-di-bawah-3-juta");
  assert.equal(findNeedPage("tidak-ada"), null);
  assert.equal(new Set(NEED_PAGES.map((page) => page.slug)).size, NEED_PAGES.length, "slug unik");
  for (const page of NEED_PAGES) {
    const needs = interpretCatalogNeeds(page.query);
    assert.ok(needs.maxPriceIdr !== null, `${page.slug}: batas harga terbaca`);
    assert.equal(needs.keywordText.trim(), "", `${page.slug}: tidak ada kata yang tersisa sebagai kata kunci`);
  }
});

import { buildPriceHistory, chartGeometry } from "@/lib/catalog/price-history-rules";

test("PB-36 riwayat harga: ambang 5 titik dalam 7 hari, cek gagal bukan titik, celah >30 jam", () => {
  const now = new Date("2026-10-16T00:00:00Z");
  const day = (d: number) => new Date(Date.UTC(2026, 9, d, 0, 0, 0)).toISOString();
  const history = buildPriceHistory({
    offers: [{ id: "o1", label: "Shopee" }, { id: "o2", label: "Situs resmi" }],
    observations: [
      { offerId: "o1", priceIdr: 3_000_000, observedAt: day(1) },
      { offerId: "o1", priceIdr: 2_900_000, observedAt: day(5) },
      { offerId: "o2", priceIdr: 2_950_000, observedAt: day(2) },
    ],
    checks: [
      { offerId: "o1", attemptedAt: day(2), outcome: "success" },
      { offerId: "o1", attemptedAt: day(3), outcome: "failure" },
      { offerId: "o1", attemptedAt: day(9), outcome: "success" },
    ],
    now,
  });
  assert.equal(history.totalPoints, 5, "4 titik Shopee (2 observasi + 2 cek berhasil) + 1 situs resmi; cek gagal diabaikan");
  assert.equal(history.qualifies, true);
  const shopee = history.series.find((series) => series.label === "Shopee")!;
  assert.deepEqual(shopee.points.map((point) => point.priceIdr), [3_000_000, 3_000_000, 2_900_000, 2_900_000]);
  assert.ok(shopee.gaps.length >= 2, "jarak 3-4 hari ditandai tidak diperiksa");
  assert.equal(history.minPriceIdr, 2_900_000);

  const sedikit = buildPriceHistory({ offers: [{ id: "o1", label: "A" }], observations: [{ offerId: "o1", priceIdr: 1, observedAt: day(14) }], checks: [], now });
  assert.equal(sedikit.qualifies, false);

  const geometry = chartGeometry(history, { width: 360, height: 220 });
  const path = geometry.series.find((series) => series.label === "Shopee")!;
  assert.match(path.dashed, /H[\d.]+ V[\d.]+/, "segmen celah berbentuk tangga putus-putus");
  assert.equal(geometry.yTicks.length, 3);
});

// Baki pilihan bandingkan di katalog (src/lib/catalog/compare-tray-rules.ts).
import { parseTrayItems, toggleTrayItem } from "@/lib/catalog/compare-tray-rules";

const tray = (slug: string) => ({ slug, name: slug.toUpperCase(), image: null });

test("baki bandingkan: tambah, hapus, dan tolak saat penuh tanpa membuang pilihan lama", () => {
  let result = toggleTrayItem([], tray("a"));
  assert.equal(result.outcome, "added");
  result = toggleTrayItem(result.items, tray("b"));
  result = toggleTrayItem(result.items, tray("c"));
  assert.deepEqual(result.items.map((item) => item.slug), ["a", "b", "c"]);
  const full = toggleTrayItem(result.items, tray("d"));
  assert.equal(full.outcome, "full");
  assert.deepEqual(full.items.map((item) => item.slug), ["a", "b", "c"]);
  const removed = toggleTrayItem(result.items, tray("b"));
  assert.equal(removed.outcome, "removed");
  assert.deepEqual(removed.items.map((item) => item.slug), ["a", "c"]);
});

test("baki bandingkan: isi penyimpanan rusak atau asing disaring", () => {
  assert.deepEqual(parseTrayItems(null), []);
  assert.deepEqual(parseTrayItems("{bukan json"), []);
  assert.deepEqual(parseTrayItems(JSON.stringify({ slug: "a" })), []);
  const items = parseTrayItems(
    JSON.stringify([
      { slug: "oppo-a6s", name: "OPPO A6s", image: "https://x/y.png" },
      { slug: "oppo-a6s", name: "dobel", image: null },
      { slug: "../jahat", name: "X", image: null },
      { slug: "vivo-y29", name: "  ", image: null },
      { slug: "vivo-y29", name: "vivo Y29", image: 5 },
      { slug: "c", name: "C" },
      { slug: "d", name: "D" },
    ])
  );
  assert.deepEqual(items, [
    { slug: "oppo-a6s", name: "OPPO A6s", image: "https://x/y.png" },
    { slug: "vivo-y29", name: "vivo Y29", image: null },
    { slug: "c", name: "C", image: null },
  ]);
});

import { resilientFetch } from "@/lib/backend/resilient-fetch";

test("resilientFetch: baca yang macet dicoba ulang sekali di koneksi baru; tulis tidak pernah diulang", async () => {
  const quiet = console.warn;
  console.warn = () => {};
  try {
    const calls: string[] = [];
    // Percobaan pertama macet sampai dibatalkan (soket keep-alive basi), kedua berhasil.
    const flaky: typeof fetch = (input, init) => {
      calls.push(String(init?.method ?? "GET"));
      if (calls.length === 1) {
        return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
      }
      return Promise.resolve(new Response("ok"));
    };
    const read = await resilientFetch(flaky, 20)("https://x.test/api/records/products");
    assert.equal(await read.text(), "ok");
    assert.equal(calls.length, 2, "GET diulang sekali");

    // Dua kali macet: menyerah setelah percobaan kedua, tidak berulang tanpa batas.
    let stuck = 0;
    const alwaysStuck: typeof fetch = (_input, init) => {
      stuck += 1;
      return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    };
    await assert.rejects(resilientFetch(alwaysStuck, 20)("https://x.test/a"), /aborted/);
    assert.equal(stuck, 2);
  } finally {
    console.warn = quiet;
  }
});

test("resilientFetch: tulis diteruskan sekali, galat jaringan dan pembatalan pemanggil tidak diulang", async () => {
  let count = 0;
  const failing: typeof fetch = () => {
    count += 1;
    return Promise.reject(new TypeError("fetch failed"));
  };
  await assert.rejects(resilientFetch(failing, 1000)("https://x.test/a"), /fetch failed/);
  assert.equal(count, 1, "galat bukan timeout diserahkan ke retry SDK, bukan diulang di sini");

  count = 0;
  const writes: typeof fetch = () => {
    count += 1;
    return Promise.resolve(new Response("created", { status: 201 }));
  };
  const res = await resilientFetch(writes, 1000)("https://x.test/a", { method: "PATCH" });
  assert.equal(res.status, 201);
  assert.equal(count, 1);

  count = 0;
  const caller = new AbortController();
  const hanging: typeof fetch = (_input, init) => {
    count += 1;
    return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
  };
  const pending = resilientFetch(hanging, 1000)("https://x.test/a", { signal: caller.signal });
  caller.abort();
  await assert.rejects(pending, /aborted/);
  assert.equal(count, 1, "dibatalkan pemanggil (timeout SDK): tidak diulang");
});

/* ------------------------------------------- harga manual admin (15 Nov 2026) */

import { parseRupiahInput } from "@/lib/admin/rupiah-input";
import { offerInput, priceInput } from "@/lib/admin/schema";

test("harga manual admin: format Indonesia diterima, Rp0 dan salah ketik ditolak", () => {
  const value = (raw: string) => {
    const parsed = parseRupiahInput(raw);
    return parsed.ok ? parsed.value : parsed.error;
  };
  // Dulu "2.849.000" ditolak browser (type=number) dan harga tidak terkirim.
  assert.equal(value("2.849.000"), 2_849_000);
  assert.equal(value("2849000"), 2_849_000);
  assert.equal(value("Rp 2.849.000"), 2_849_000);
  assert.equal(value("Rp2.849.000,00"), 2_849_000);
  assert.equal(value("2,849,000"), 2_849_000);
  assert.equal(value(" 2.849.500 "), 2_849_500, "bukan kelipatan Rp1.000 tetap sah (45 harga seperti ini sudah ada)");
  assert.equal(value("12.999.000"), 12_999_000);

  assert.match(String(value("")), /wajib/);
  assert.match(String(value("0")), /terlalu kecil/, "harga kosong bukan nol (PRD §7)");
  assert.match(String(value("2.849")), /terlalu kecil/, "2.849 hampir pasti salah ketik ribuan");
  assert.match(String(value("2.849.000,50")), /tanpa sen/);
  assert.match(String(value("2.84.9000")), /tidak dikenali/);
  assert.match(String(value("dua juta")), /hanya boleh/);
  assert.match(String(value("-2849000")), /hanya boleh/);
  assert.match(String(value("28490000000")), /batas wajar/);
});

test("schema penawaran: harga opsional saat menambah, wajib saat mencatat", () => {
  const base = {
    variantId: "3fbb172b-8827-4ed3-9bfc-dd6065aaff1d",
    marketplace: "Shopee",
    sellerName: "Motorola Official Store",
    url: "https://shopee.co.id/motorola-g77-power-i.1.2",
    warranty: "",
    listingStatus: "active",
  };
  const withoutPrice = offerInput.safeParse({ ...base, priceIdr: "" });
  assert.ok(withoutPrice.success);
  assert.equal(withoutPrice.data.priceIdr, null);
  const missingField = offerInput.safeParse(base);
  assert.ok(missingField.success, "kolom harga tidak ada = tanpa harga");
  assert.equal(missingField.data.priceIdr, null);
  const withPrice = offerInput.safeParse({ ...base, priceIdr: "2.849.000" });
  assert.ok(withPrice.success);
  assert.equal(withPrice.data.priceIdr, 2_849_000);
  assert.equal(offerInput.safeParse({ ...base, priceIdr: "0" }).success, false);

  const offerId = "9dbe4e37-3d7b-4c8a-852d-369fa9f1290a";
  assert.equal(priceInput.safeParse({ offerId, priceIdr: "2.849.000" }).data?.priceIdr, 2_849_000);
  const empty = priceInput.safeParse({ offerId, priceIdr: "" });
  assert.equal(empty.success, false, "Rp0 dari kolom kosong tidak lagi lolos (dulu z.coerce)");
  assert.equal(priceInput.safeParse({ offerId: "bukan-uuid", priceIdr: "2849000" }).success, false);
});

import { SPEC_GUIDE, specGuideFor, specGuidesFor } from "@/lib/catalog/spec-guide";
import { joinNames, specInsight, type InsightSubject } from "@/lib/catalog/spec-insight";
import type { ProductSpecs } from "@/lib/catalog/schema";

const baseSpecs: ProductSpecs = {
  displayInches: 6.7, displayTechnology: "AMOLED", refreshRateHz: 120, chipset: "Snapdragon 7s Gen 3",
  batteryMah: 5000, chargingWatt: 45, mainCameraMp: 50, cameraLensCount: 3, cameraHasUltrawide: true,
  cameraHasTelephoto: false, cameraOpticalZoomX: null, weightGrams: 190, releaseYear: 2025, is5G: true,
  hasNfc: true, ipRating: "IP68", has35mmJack: false, osVersion: "Android 15, One UI 7", colorOptions: null,
};
const subject = (name: string, specs: Partial<ProductSpecs> = {}, extra: Partial<InsightSubject> = {}): InsightSubject => ({
  name, specs: { ...baseSpecs, ...specs }, ramGb: 8, storageGb: 256, warranty: "Resmi Indonesia", ...extra,
});

test("Bank materi: setiap atribut punya 'apa ini' dan 2-4 butir realita, tanpa klaim pemenang", () => {
  assert.ok(SPEC_GUIDE.length >= 15);
  for (const entry of SPEC_GUIDE) {
    assert.ok(entry.what.length > 10, entry.label);
    assert.ok(entry.reality.length >= 2 && entry.reality.length <= 4, `${entry.label}: 2-4 butir`);
    const text = [entry.what, ...entry.reality].join(" ");
    assert.doesNotMatch(text, /terbaik|juara|pemenang|skor|wajib beli/i, entry.label);
    assert.doesNotMatch(text, /—/, `${entry.label}: tanpa em dash`);
  }
  assert.equal(specGuideFor("Baterai")?.label, "Baterai");
  assert.equal(specGuideFor("Pilihan warna"), null);
  assert.deepEqual(specGuidesFor(["RAM", "Pilihan warna", "RAM", "Bobot"]).map((e) => e.label), ["RAM", "Bobot"]);
});

test("Bank materi RV-03: 'Intinya' dan 'Perlu diperhatikan' pendek untuk popover (?)", () => {
  for (const entry of SPEC_GUIDE) {
    assert.ok(entry.short.length >= 10 && entry.short.length <= 110, `${entry.label}: intinya ${entry.short.length} karakter`);
    assert.ok(entry.tip.length >= 20 && entry.tip.length <= 140, `${entry.label}: tips ${entry.tip.length} karakter`);
    assert.doesNotMatch(`${entry.short} ${entry.tip}`, /terbaik|juara|pemenang|skor|wajib beli|—/i, entry.label);
  }
});

test("Insight: arah faktual + artinya, tanpa 'lebih baik', dan kosong bila ada nilai tak diketahui", () => {
  assert.equal(joinNames(["A", "B", "C"]), "A, B, dan C");

  const battery = specInsight("Baterai", [subject("A", { batteryMah: 6000 }), subject("B", { batteryMah: 5400 })]);
  assert.equal(battery?.fact, "A 600 mAh (11%) lebih besar dari B (6.000 mAh vs 5.400 mAh).");
  assert.match(battery!.meaning!, /cek ulasan/i);
  const small = specInsight("Baterai", [subject("A", { batteryMah: 5100 }), subject("B", { batteryMah: 5000 })]);
  assert.match(small!.meaning!, /jarang terasa/);

  const weight = specInsight("Bobot", [subject("A", { weightGrams: 210 }), subject("B", { weightGrams: 185 })]);
  assert.equal(weight?.fact, "B 25 gram lebih ringan dari A (185 gram vs 210 gram).");

  const three = specInsight("RAM", [subject("A", {}, { ramGb: 12 }), subject("B", {}, { ramGb: 8 }), subject("C", {}, { ramGb: 12 })]);
  assert.equal(three?.fact, "Paling besar: A dan C (12 GB); paling kecil: B (8 GB). Selisih 4 GB.");

  const nfc = specInsight("NFC", [subject("A"), subject("B", { hasNfc: false })]);
  assert.equal(nfc?.fact, "Hanya A yang tercatat punya NFC.");
  const nfc3 = specInsight("NFC", [subject("A"), subject("B"), subject("C", { hasNfc: false })]);
  assert.equal(nfc3?.fact, "A dan B tercatat punya NFC; C tidak.");

  const chip = specInsight("Chipset", [subject("A", { chipset: "Snapdragon 8 Elite" }), subject("B", { chipset: "Helio G85" })]);
  assert.equal(chip?.fact, "Kelas chipset A: flagship; B: entry.");
  assert.match(chip!.meaning!, /bukan benchmark/);
  assert.equal(specInsight("Chipset", [subject("A", { chipset: "Chip Misterius X1" }), subject("B")]), null);

  const ip = specInsight("Ketahanan (IP rating)", [subject("A"), subject("B", { ipRating: "IP54" })]);
  assert.equal(ip?.fact, "A: IP68, tahan terendam lebih dari 1 meter; B: IP54, tahan cipratan air.");
  assert.equal(specInsight("Ketahanan (IP rating)", [subject("A", { ipRating: "IP68/IP69" }), subject("B")])?.fact.startsWith("A: IP69"), true);

  const camera = specInsight("Susunan kamera", [subject("A", { cameraHasTelephoto: true, cameraOpticalZoomX: 3 }), subject("B")]);
  assert.equal(camera?.fact, "Hanya A yang tercatat punya telefoto (zoom optik).");

  const panel = specInsight("Layar", [subject("A"), subject("B", { displayTechnology: "IPS LCD", displayInches: 6.72 })]);
  assert.match(panel!.fact, /Panel A: OLED; B: LCD/);
  assert.doesNotMatch(panel!.fact, /inci lebih/, "selisih 0,02 inci tidak disebut");

  const year = specInsight("Tahun rilis", [subject("A"), subject("B", { releaseYear: 2023 })]);
  assert.equal(year?.fact, "A dirilis 2025, 2 tahun setelah B (2023).");

  // Nilai tak diketahui tidak pernah dihitung; nilai sama tidak punya arah.
  assert.equal(specInsight("Baterai", [subject("A"), subject("B", { batteryMah: null })]), null);
  assert.equal(specInsight("Baterai", [subject("A"), subject("B")]), null);
  assert.equal(specInsight("Pilihan warna", [subject("A"), subject("B")]), null);
  assert.equal(specInsight("Baterai", [subject("A")]), null);

  for (const label of SPEC_GUIDE.map((e) => e.label)) {
    const insight = specInsight(label, [subject("A", { batteryMah: 7000, weightGrams: 230 }, { ramGb: 16 }), subject("B", { hasNfc: false, is5G: false, has35mmJack: true }, { warranty: "Distributor" })]);
    if (insight) assert.doesNotMatch(`${insight.fact} ${insight.meaning ?? ""}`, /lebih baik|terbaik|pemenang|unggul/i, label);
  }
});

import { buildRefreshGrid, wibDate } from "@/lib/admin/refresh-grid";

test("CD-03 grid pemeriksaan harian: tanggal WIB, kategori status, gagal tidak tertutup berhasil", () => {
  // 18 Nov 2026 20:00 UTC = 19 Nov 03:00 WIB.
  const now = new Date("2026-11-18T20:00:00Z");
  assert.equal(wibDate(now), "2026-11-19");
  const grid = buildRefreshGrid(
    [
      { brand: "Xiaomi", runDate: "2026-11-19", status: "queued", message: null },
      { brand: "OPPO", runDate: "2026-11-19", status: "blocked", message: "Turnstile" },
      { brand: "OPPO", runDate: "2026-11-19", status: "nothing-to-update", message: null },
      { brand: "OPPO", runDate: "2026-11-18", status: "no-offers", message: null },
      { brand: "Xiaomi", runDate: "2026-10-01", status: "queued", message: null },
    ],
    now,
    3
  );
  assert.deepEqual(grid.dates, ["2026-11-17", "2026-11-18", "2026-11-19"]);
  assert.deepEqual(grid.rows.map((row) => row.brand), ["OPPO", "Xiaomi"]);
  assert.deepEqual(grid.rows[0]!.cells, [null, "tanpa-penawaran", "gagal"], "gagal diutamakan di hari yang sama");
  assert.deepEqual(grid.rows[1]!.cells, [null, null, "berhasil"], "catatan di luar jendela diabaikan");
  assert.deepEqual(grid.failuresPerDay, [0, 0, 1]);
  assert.deepEqual(buildRefreshGrid([], now).rows, []);
});
