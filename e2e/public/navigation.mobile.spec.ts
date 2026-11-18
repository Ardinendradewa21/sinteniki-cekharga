import { expect, test } from "@playwright/test";

// CD-01: tab bar bawah situs publik di ponsel (proyek "publik-mobile", Pixel 7).
// Bukti klik nyata (antislop R-35): tab berpindah halaman, lembar "Lainnya"
// bisa dibuka dan ditutup dengan keyboard, dan compare tray tidak tertutup.

test.describe("Tab bar ponsel (CD-01)", () => {
  test("TC-NAV-01 tab berpindah halaman dan menandai tab aktif @smoke", async ({ page }) => {
    await page.goto("/");
    const bar = page.getByRole("navigation", { name: "Navigasi utama ponsel" });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link", { name: "Beranda" })).toHaveAttribute("aria-current", "page");

    await bar.getByRole("link", { name: "Produk" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(bar.getByRole("link", { name: "Produk" })).toHaveAttribute("aria-current", "page");

    // Setiap tab setinggi minimal 44px (PRD §8).
    for (const name of ["Beranda", "Produk", "Bandingkan", "Tanya AI"]) {
      const box = await bar.getByRole("link", { name }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("TC-NAV-02 lembar Lainnya: fokus masuk, Escape menutup, tautan berfungsi @regression", async ({ page }) => {
    await page.goto("/");
    const more = page.getByRole("button", { name: "Lainnya" });
    await more.click();
    const sheet = page.getByRole("dialog", { name: "Lainnya" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link", { name: /Cara Kerja/ })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();

    await more.click();
    await sheet.getByRole("link", { name: /Pertanyaan umum/ }).click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(sheet).toBeHidden();
  });

  test("TC-NAV-03 compare tray duduk di atas tab bar, tidak tertutup @regression", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("button", { name: "Bandingkan", pressed: false }).first().click();
    const tray = page.getByRole("region", { name: "Pilihan untuk dibandingkan" });
    await expect(tray).toBeVisible();
    // Tunggu animasi masuk (entrance 450ms) selesai sebelum mengukur.
    await page.waitForTimeout(700);
    const trayBox = await tray.boundingBox();
    const barBox = await page.getByRole("navigation", { name: "Navigasi utama ponsel" }).boundingBox();
    expect(trayBox!.y + trayBox!.height).toBeLessThanOrEqual(barBox!.y + 1);
  });
});
