import { expect, test } from "@playwright/test";

import { catalogTotal, productCards, productLinks, rupiahIn } from "../support/helpers";

// FR-02 Katalog. Kontrak URL: src/lib/catalog/search-params.ts (q, merek, ram,
// penyimpanan, harga_min, harga_max, urut, hal).

test.describe("Katalog (FR-02)", () => {
  test("TC-KAT-01 pencarian menulis q ke URL dan mempersempit hasil @smoke", async ({ page }) => {
    await page.goto("/products");
    const before = await catalogTotal(page);
    await page.getByRole("searchbox").first().fill("Galaxy");
    // Dev server bisa lambat mengompilasi navigasi saat suite paralel; navigasi
    // diberi batas waktunya sendiri, terpisah dari batas expect 15 detik.
    await Promise.all([
      page.waitForURL(/[?&]q=Galaxy/, { timeout: 60_000 }),
      page.getByRole("searchbox").first().press("Enter"),
    ]);
    const after = await catalogTotal(page);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  test("TC-KAT-02 filter dari URL dipulihkan setelah reload @regression", async ({ page }) => {
    await page.goto("/products?merek=samsung&urut=price-asc");
    const first = await productLinks(page);
    await page.reload();
    expect(await productLinks(page)).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    for (const href of first.slice(0, 5)) expect(href).toContain("samsung");
  });

  test("TC-KAT-03 urut harga terendah benar-benar menaik @regression", async ({ page }) => {
    await page.goto("/products?urut=price-asc");
    const prices = await rupiahIn(productCards(page));
    expect(prices.length).toBeGreaterThan(3);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test("TC-KAT-04 batas budget: harga kosong tidak lolos dan tidak ada harga di atas batas @smoke", async ({ page }) => {
    const max = 4_000_000;
    await page.goto(`/products?harga_max=${max}`);
    const cards = productCards(page);
    // Bila semua harga sedang basi (pemeriksaan harian belum jalan), hasil
    // kosong adalah perilaku yang BENAR: harga basi tidak lolos filter budget.
    if ((await cards.count()) === 0) {
      await expect(page.getByText(/0 produk yang cocok/)).toBeVisible();
      return;
    }
    // PRD §7: harga kosong bukan nol, jadi tidak boleh lolos filter budget.
    await expect(cards.filter({ hasText: /Harga belum tersedia/ })).toHaveCount(0);
    for (const price of await rupiahIn(cards)) expect(price).toBeLessThanOrEqual(max);
  });

  test("TC-KAT-05 parameter rusak tidak menjatuhkan halaman @regression", async ({ page }) => {
    const response = await page.goto("/products?ram=abc&urut=termurah-banget&hal=-3&harga_max=xyz");
    expect(response?.status()).toBe(200);
    expect(await catalogTotal(page)).toBeGreaterThan(0);
  });

  test("TC-KAT-06 hasil kosong memberi saran konkret @regression", async ({ page }) => {
    await page.goto("/products?harga_max=1000");
    await expect(page.getByText(/0 produk yang cocok/)).toBeVisible();
    await expect(page.getByText(/Tidak ada produk yang cocok|Belum ada bukti ulasan/)).toBeVisible();
    // Saran berupa tautan yang melepas filter, bukan hanya teks.
    await expect(page.locator("main").getByRole("link", { name: /hapus|lepas|reset|tanpa/i }).first()).toBeVisible();
  });

  test("TC-KAT-07 perubahan hasil diumumkan lewat aria-live @regression", async ({ page }) => {
    await page.goto("/products");
    const status = page.locator('[aria-live="polite"]').first();
    await expect(status).toContainText(/dari \d+ produk/);
    await page.goto("/products?merek=samsung");
    await expect(page.locator('[aria-live="polite"]').first()).toContainText(/produk/);
  });

  test("TC-KAT-09 kartu tanpa foto asli berlabel dan ilustrasinya dekoratif (UX-13, PRD §8) @regression", async ({ page }) => {
    await page.goto("/products?urut=checked");
    const placeholder = productCards(page).filter({ hasText: "Foto belum tersedia" }).first();
    test.skip((await placeholder.count()) === 0, "semua produk di halaman ini punya foto asli");
    await expect(placeholder.locator('img[src*="generic-device"]')).toHaveAttribute("alt", "");
  });

  test("TC-KAT-08 kartu menyebut varian acuan dan waktu pemeriksaan harga @smoke", async ({ page }) => {
    await page.goto("/products?urut=checked");
    const priced = productCards(page).filter({ hasText: /Rp/ }).first();
    // PRD §7: harga selalu menyebut varian acuan dan waktu pemeriksaan.
    await expect(priced).toContainText(/Varian \d+\/\d+ (GB|TB)/);
    await expect(priced).toContainText(/diperiksa|tercatat/i);
  });
});
