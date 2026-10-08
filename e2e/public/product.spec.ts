import { expect, test } from "@playwright/test";

import { catalogTotal, productLinks } from "../support/helpers";

// FR-03 Detail produk dan FR-05 Penawaran.

test.describe("Detail produk (FR-03, FR-05)", () => {
  test("TC-DET-01 harga menyebut varian dan waktu pemeriksaan @smoke", async ({ page }) => {
    await page.goto("/products?urut=checked");
    const [href] = await productLinks(page);
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const main = page.locator("main");
    await expect(main).toContainText(/Rp[\d.]+/);
    await expect(main).toContainText(/varian \d+\/\d+ (GB|TB)/i);
    await expect(main).toContainText(/diperiksa|tercatat/i);
  });

  test("TC-DET-02 ganti varian memperbarui URL dan menandai pilihan @regression", async ({ page }) => {
    await page.goto("/products?merek=samsung&urut=checked");
    const [href] = await productLinks(page);
    await page.goto(href);
    const variants = page.getByRole("heading", { name: "Varian tercatat" }).locator("xpath=..").getByRole("link");
    const count = await variants.count();
    test.skip(count < 2, "produk ini hanya punya satu varian");
    let index = 0;
    while (index < count && (await variants.nth(index).getAttribute("aria-current")) === "true") index += 1;
    const target = variants.nth(index);
    const label = (await target.locator("span").first().innerText()).trim();
    await target.click();
    await expect(page).toHaveURL(/[?&]varian=/);
    await expect(variants.filter({ hasText: label }).first()).toHaveAttribute("aria-current", "true");
  });

  test("TC-DET-03 slug tidak dikenal memberi status 404 @smoke", async ({ page }) => {
    const response = await page.goto("/products/produk-yang-tidak-pernah-ada");
    expect(response?.status()).toBe(404);
  });

  test("TC-DET-04 tautan penawaran membuka URL http(s) valid di tab baru @regression", async ({ page }) => {
    await page.goto("/products?urut=checked");
    const [href] = await productLinks(page);
    await page.goto(href);
    const offers = page.locator('main a[target="_blank"][aria-label*="membuka tab baru"]');
    test.skip((await offers.count()) === 0, "produk ini belum punya penawaran");
    for (const link of await offers.all()) {
      const url = await link.getAttribute("href");
      expect(url).toMatch(/^https:\/\//);
      expect(await link.getAttribute("rel")).toMatch(/noopener/);
    }
    // FR-05: CekHarga tidak mengklaim memproses transaksi.
    await expect(page.locator("main")).not.toContainText(/beli di cekharga|checkout di cekharga|bayar di cekharga/i);
  });

  test("TC-DET-05 produk tanpa harga tetap terbaca dan tidak menampilkan Rp0 @regression", async ({ page }) => {
    // Produk tanpa harga diurutkan paling akhir; buka halaman terakhir urutan harga.
    await page.goto("/products?urut=price-asc");
    const total = await catalogTotal(page);
    await page.goto(`/products?urut=price-asc&hal=${Math.ceil(total / 20)}`);
    const card = page.locator("main li").filter({ hasText: /Harga belum tersedia/ }).first();
    test.skip((await card.count()) === 0, "semua produk terbit sudah punya harga");
    await card.locator('a[href^="/products/"]').first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main")).toContainText(/Harga belum tersedia/);
    // PRD §7: harga kosong bukan nol.
    await expect(page.locator("main")).not.toContainText(/Rp\s?0(?![\d.])/);
  });
});
