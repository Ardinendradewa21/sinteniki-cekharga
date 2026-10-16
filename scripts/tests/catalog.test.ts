// Uji deterministik aturan etalase beranda (src/lib/catalog/showcase.ts).
// Jalankan: pnpm test:catalog
import { test } from "node:test";
import assert from "node:assert/strict";

import { pickComparisonPair, pickHeroProduct, type ShowcaseCandidate } from "@/lib/catalog/showcase";

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
