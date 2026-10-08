import { expect, test } from "@playwright/test";

import { affirmativeSentences } from "../support/helpers";

// FR-01 Beranda. Kasus uji: docs/qa/TEST-CASES.md (TC-BRD-*).

test.describe("Beranda (FR-01)", () => {
  test("TC-BRD-01 CTA utama membuka katalog @smoke", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /cari produk/i }).first().click();
    await expect(page).toHaveURL(/\/products/);
    await expect(page.locator('[aria-live="polite"]').first()).toContainText(/produk/);
  });

  test("TC-BRD-02 CTA sekunder membuka Tanya AI @smoke", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /tanya ai/i }).first().click();
    await expect(page).toHaveURL(/\/assistant/);
  });

  test("TC-BRD-03 tidak ada klaim popularitas, testimonial, atau jumlah pengguna @regression", async ({ page }) => {
    await page.goto("/");
    const text = affirmativeSentences(await page.locator("main").innerText());
    // PRD FR-01 dan AGENTS.md: tidak boleh ada klaim yang tidak bisa dibuktikan.
    expect(text).not.toMatch(/testimoni|\b\d[\d.]*\s*(ribu|rb|juta)?\s*pengguna|paling populer|terlaris|#1\b/i);
  });

  test("TC-BRD-04 slot iklan tanpa kampanye tidak merender ruang kosong @regression", async ({ page }) => {
    await page.goto("/");
    // ADS-CONTEXT §14.2: slot tanpa iklan tidak merender apa pun.
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
  });
});
