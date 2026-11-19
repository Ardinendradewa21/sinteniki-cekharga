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
    const variants = page.getByRole("heading", { name: /Pilih kapasitas/ }).locator("xpath=..").getByRole("link");
    const count = await variants.count();
    test.skip(count < 2, "produk ini hanya punya satu varian");
    let index = 0;
    while (index < count && (await variants.nth(index).getAttribute("aria-current")) === "true") index += 1;
    const target = variants.nth(index);
    // Baris pertama = kapasitas; baris kedua harga varian (SegmentedNav dua baris, VD-06).
    const label = (await target.innerText()).split(/\r?\n/)[0]!.trim();
    await target.click();
    await expect(page).toHaveURL(/[?&]varian=/);
    await expect(variants.filter({ hasText: label }).first()).toHaveAttribute("aria-current", "true");
  });

  test("TC-DET-06 remah roti, judul dengan kapasitas, dan warna hanya mengganti foto @regression", async ({ page }) => {
    await page.goto("/products?urut=checked");
    const [href] = await productLinks(page);
    await page.goto(href);
    const crumbs = page.getByRole("navigation", { name: "Remah roti" });
    await expect(crumbs.getByRole("link", { name: "Beranda" })).toBeVisible();
    await expect(crumbs.getByRole("link", { name: "Katalog" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/\d+\/\d+ (GB|TB)/);

    const colors = page.getByRole("heading", { name: /Pilih warna/ }).locator("xpath=..").getByRole("link");
    test.skip((await colors.count()) < 2, "produk ini belum punya dua warna tercatat");
    const price = await page.locator("main").getByText(/^Rp[\d.]+$/).first().innerText();
    const target = colors.and(page.locator(":not([aria-current])")).first();
    const name = (await target.innerText()).trim();
    await target.click();
    await expect(page).toHaveURL(/[?&]warna=/);
    await expect(colors.filter({ hasText: name }).first()).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    // PRD §7: harga tercatat per kapasitas; warna tidak mengubahnya.
    await expect(page.locator("main").getByText(/^Rp[\d.]+$/).first()).toHaveText(price);
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
  test("TC-DET-10 ulasan reviewer dipisah keseluruhan dan kamera (PB-40) @regression", async ({ page }) => {
    await page.goto("/products?urut=checked");
    const [href] = await productLinks(page);
    await page.goto(href);
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Pengalaman reviewer", level: 2 }) });
    await expect(section.getByRole("heading", { name: "Ulasan keseluruhan", level: 3 })).toBeVisible();
    await expect(section.getByRole("heading", { name: "Ulasan kamera", level: 3 })).toBeVisible();
  });

  test("TC-DET-11 video ulasan diputar di kartu, pemutar baru dimuat saat diklik (RV-01) @regression", async ({ page }) => {
    // Produk dengan ulasan terbit; dilewati bila datanya belum ada.
    await page.goto("/products/xiaomi-redmi-17");
    const play = page.getByRole("button", { name: /Putar video ulasan/ }).first();
    test.skip((await play.count()) === 0, "Belum ada ulasan video terbit untuk produk uji.");
    // Sebelum diklik: tanpa iframe YouTube (halaman tetap ringan).
    await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
    const open = page.getByRole("link", { name: /Buka di YouTube/ }).first();
    await expect(open).toHaveAttribute("href", /^https:\/\/www\.youtube\.com\/watch\?v=/);
    await expect(open).toHaveAttribute("target", "_blank");
    await play.click();
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]').first()).toBeVisible();
  });

  test("TC-DET-12 ikon (?) spesifikasi membuka penjelasan ringkas, Esc mengembalikan fokus (RV-03) @regression", async ({ page }) => {
    await page.goto("/products?urut=checked");
    const [href] = await productLinks(page);
    await page.goto(href);
    const hint = page.getByRole("button", { name: "Apa arti Baterai?" });
    await expect(hint).toHaveAttribute("aria-expanded", "false");
    await hint.focus();
    await page.keyboard.press("Enter");
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover).toContainText("Intinya");
    await expect(popover).toContainText("Perlu diperhatikan");
    await popover.getByRole("button", { name: "Selengkapnya" }).click();
    await expect(popover).toContainText("miliampere-jam");
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(hint).toBeFocused();
    // Panel panjang lama sudah diganti ikon per baris.
    await expect(page.getByText("Apa arti spesifikasi ini?")).toHaveCount(0);
  });
});
