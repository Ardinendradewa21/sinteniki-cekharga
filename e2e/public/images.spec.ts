import { expect, test } from "@playwright/test";

/*
 * next/image di mode dev memperingatkan gambar yang ukurannya diubah CSS di
 * satu sisi saja ("has either width or height modified, but not the other"),
 * yang berarti rasio foto bisa terdistorsi. Temuan PO 18 November 2026 di
 * kolom kandidat /compare; foto produk kini memakai `fill` di kotak berukuran
 * tetap. Uji ini menjaga supaya peringatan gambar tidak muncul lagi di mana
 * pun. Peringatannya hanya ada di mode dev; di build produksi uji ini tetap
 * lolos karena konsol bersih.
 */

const PAGES = [
  "/",
  "/products",
  "/products/oppo-a6-pro",
  "/compare?produk=oppo-a6-pro&produk=xiaomi-redmi-note-17",
  "/assistant",
  "/hp",
];

test("TC-IMG-01 tanpa peringatan next/image di halaman publik utama @regression", async ({ page }) => {
  test.setTimeout(180_000);
  const warnings: string[] = [];
  let current = "";
  page.on("console", (message) => {
    const text = message.text();
    if (/Image with src|has "fill"|aspect ratio/i.test(text)) warnings.push(`${current}: ${text.replace(/src "[^"]+"/, 'src "…"').slice(0, 160)}`);
  });
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      current = `${path} @${width}`;
      await page.goto(path, { waitUntil: "load" });
      for (let y = 0; y < 5000; y += 800) {
        await page.mouse.wheel(0, 800);
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(600);
    }
  }
  expect(warnings).toEqual([]);
});
