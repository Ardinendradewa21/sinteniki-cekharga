import { expect, test } from "@playwright/test";

import { affirmativeSentences, parseRupiah, productLinks } from "../support/helpers";

// FR-04 Perbandingan, FR-06 Asisten AI (jalur formulir), FR-08 Transparansi.

test.describe("Perbandingan (FR-04)", () => {
  test("TC-CMP-01 dua produk dari URL tampil dengan nama dan varian @smoke", async ({ page }) => {
    await page.goto("/products?urut=checked");
    const [a, b] = (await productLinks(page)).map((href) => href.replace("/products/", ""));
    await page.goto(`/compare?produk=${a}&produk=${b}`);
    const main = page.locator("main");
    await expect(main).toContainText(/\d+\/\d+ (GB|TB)/);
    // Tidak ada pemenang tunggal atau skor universal (PRD §3, FR-04).
    expect(affirmativeSentences(await main.innerText())).not.toMatch(/pemenang|terbaik|skor\s*\d/i);
  });

  test("TC-CMP-02 lebih dari tiga pembanding dibatasi tiga @regression", async ({ page }) => {
    await page.goto("/products?urut=checked");
    const slugs = (await productLinks(page)).slice(0, 4).map((href) => href.replace("/products/", ""));
    const response = await page.goto(`/compare?${slugs.map((slug) => `produk=${slug}`).join("&")}`);
    expect(response?.status()).toBe(200);
    const shown = await page.locator('main a[href^="/products/"]').evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute("href")))]
    );
    expect(shown.filter((href) => slugs.some((slug) => href?.startsWith(`/products/${slug}`))).length).toBeLessThanOrEqual(3);
  });
});

test.describe("Perbandingan, struktur tabel (UX-09)", () => {
  test("TC-CMP-03 spesifikasi berupa tabel ARIA: baris per atribut, sel per produk @regression", async ({ page }) => {
    await page.goto("/products?urut=checked");
    const [a, b] = (await productLinks(page)).map((href) => href.replace("/products/", ""));
    await page.goto(`/compare?produk=${a}&produk=${b}`);
    const table = page.getByRole("table").first();
    await expect(table).toBeVisible();
    const row = table.getByRole("row").filter({ has: page.getByRole("rowheader") }).first();
    await expect(row.getByRole("rowheader")).toHaveCount(1);
    await expect(row.getByRole("cell")).toHaveCount(2);
  });
});

test.describe("Tanya AI, jalur formulir (FR-06)", () => {
  const budget = 5_000_000;
  const query = `tanya=form&budget=${budget}&budget_wajib=ya&kegiatan=foto&wajib_jawab=ya&wajib=ram-8&prioritas=kamera`;

  test("TC-AI-01 syarat wajib menyaring kandidat secara terstruktur @smoke", async ({ page }) => {
    await page.goto(`/assistant?${query}`);
    const main = page.locator("main");
    // Tiga keadaan sah bergantung umur data harga: kandidat dengan harga segar,
    // tidak ada kandidat, atau kandidat yang harganya perlu dicek ulang (basi).
    await expect(main).toContainText(/kandidat yang memenuhi syaratmu|Belum ada kandidat|perlu dicek ulang/i);
    if (/kandidat yang memenuhi syaratmu/i.test(await main.innerText())) {
      await expect(main).toContainText(/bukan peringkat kualitas/i);
    }
    const candidates = page.locator("main article, main li").filter({ hasText: /Lihat detail dan penawarannya/ });
    const count = await candidates.count();
    for (let index = 0; index < count; index += 1) {
      const text = await candidates.nth(index).innerText();
      // Kandidat yang lolos tidak melewati budget wajib dan menyebut RAM 8 GB+.
      if (/perlu dicek ulang/i.test(text)) continue;
      const price = parseRupiah(text);
      if (price !== null) expect(price).toBeLessThanOrEqual(budget);
      const ram = Number(text.match(/Varian (\d+)\//)?.[1] ?? 0);
      expect(ram).toBeGreaterThanOrEqual(8);
    }
  });

  test("TC-AI-02 harga lama dipisah dan diberi label @regression", async ({ page }) => {
    await page.goto(`/assistant?${query}`);
    const stale = page.getByText(/perlu dicek ulang/i);
    test.skip((await stale.count()) === 0, "tidak ada kandidat berharga lama saat ini");
    await expect(stale.first()).toBeVisible();
  });

  test("TC-AI-03 jalur formulir bekerja tanpa model AI @regression", async ({ page }) => {
    await page.goto("/assistant?tanya=form");
    await expect(page.getByRole("spinbutton", { name: "Budget dalam Rupiah" })).toBeVisible();
    await page.getByRole("spinbutton", { name: "Budget dalam Rupiah" }).fill("3000000");
    await page.getByRole("button", { name: "Kirim" }).click();
    await expect(page).toHaveURL(/budget=3000000/);
  });
});

test.describe("Transparansi (FR-08) dan berkas publik", () => {
  test("TC-TRN-01 halaman cara kerja menjelaskan sumber dan keterbatasan @regression", async ({ page }) => {
    const response = await page.goto("/how-it-works");
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toContainText(/sumber/i);
    await expect(page.locator("main")).toContainText(/mulai dari|keterbatasan|kedaluwarsa/i);
  });

  test("TC-TRN-02 ads.txt tersaji sebagai teks @regression", async ({ request }) => {
    const response = await request.get("/ads.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
  });

  test("TC-TRN-03 health check menjawab 200 di mode live @smoke", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
  });
});
