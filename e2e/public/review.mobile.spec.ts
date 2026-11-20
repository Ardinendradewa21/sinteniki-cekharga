import { expect, test } from "@playwright/test";

// RV-05 (keputusan PO 20 Nov 2026): di ponsel video ulasan tersembunyi di balik
// tombol "Tonton video" supaya kartu tidak memanjang; proyek "publik-mobile".

test.describe("Video ulasan di ponsel (RV-05)", () => {
  test("TC-DET-13 kotak video tersembunyi sampai 'Tonton video' ditekan @regression", async ({ page }) => {
    await page.goto("/products/xiaomi-redmi-17");
    const watch = page.getByRole("button", { name: /Tonton video/ }).first();
    test.skip((await watch.count()) === 0, "Belum ada ulasan video terbit untuk produk uji.");
    // Sebelum ditekan: thumbnail 16:9 tidak tampil dan pemutar belum dimuat.
    await expect(page.getByRole("button", { name: /Putar video ulasan/ }).first()).toBeHidden();
    await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Buka di YouTube/ }).first()).toBeVisible();
    await watch.click();
    const player = page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]').first();
    await expect(player).toBeVisible();
    await expect(watch).toHaveCount(0);
  });
});
