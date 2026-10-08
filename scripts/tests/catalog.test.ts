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

test("produk hero: harga segar yang diperiksa paling baru; tanpa harga segar pakai produk pertama", () => {
  const hero = pickHeroProduct([
    item("lama", "A", available(1, "2026-10-05T00:00:00Z")),
    item("baru", "B", available(1, "2026-10-07T08:00:00Z")),
    item("basi", "C", stale(1)),
  ]);
  assert.equal(hero?.slug, "baru");
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
