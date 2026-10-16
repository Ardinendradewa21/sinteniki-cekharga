import { expect, test } from "@playwright/test";

import { catalogTotal, parseRupiah, productCards, productLinks, rupiahIn } from "../support/helpers";

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

  test("TC-KAT-03 urut harga terendah: harga berlaku dulu lalu harga lama, masing-masing menaik @regression", async ({ page }) => {
    await page.goto("/products?urut=price-asc");
    // PRD §7 butir 5: harga lama ("terakhir tercatat") tidak boleh tampil
    // seolah pilihan termurah saat ini, jadi selalu di belakang harga berlaku.
    const cards = await productCards(page).allInnerTexts();
    const priced = cards
      .map((text) => ({ price: parseRupiah(text), stale: /terakhir tercatat/i.test(text) }))
      .filter((card): card is { price: number; stale: boolean } => card.price !== null);
    expect(priced.length).toBeGreaterThan(3);
    const firstStale = priced.findIndex((card) => card.stale);
    if (firstStale >= 0) expect(priced.slice(firstStale).every((card) => card.stale)).toBe(true);
    for (const tier of [priced.filter((card) => !card.stale), priced.filter((card) => card.stale)]) {
      const prices = tier.map((card) => card.price);
      expect(prices).toEqual([...prices].sort((x, y) => x - y));
    }
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
  test("TC-KAT-10 tombol Bandingkan mengisi baki, menolak pilihan keempat, lalu membuka perbandingan @regression", async ({ page }) => {
    await page.goto("/products");
    const toggles = page.getByRole("button", { name: /untuk dibandingkan$/ });
    const tray = page.getByRole("region", { name: "Pilihan untuk dibandingkan" });
    await toggles.nth(0).click();
    await expect(toggles.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(tray).toContainText("Pilih 1 lagi");
    for (const index of [1, 2, 3]) await toggles.nth(index).click();
    await expect(tray).toContainText("Maksimal 3 produk");
    await expect(toggles.nth(3)).toHaveAttribute("aria-pressed", "false");
    // Pilihan bertahan saat pindah halaman katalog.
    await page.goto("/products?hal=2");
    await expect(tray).toContainText("3 produk dipilih");
    await Promise.all([
      page.waitForURL(/\/compare\?produk=[^&]+&produk=[^&]+&produk=/, { timeout: 60_000 }),
      page.getByRole("link", { name: "Bandingkan 3 produk terpilih" }).click(),
    ]);
    await expect(tray).toHaveCount(0);
  });
});
