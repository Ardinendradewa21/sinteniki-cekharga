import { expect, test } from "@playwright/test";

// PRD §8 aksesibilitas di layar ponsel: target sentuh 44 px, tanpa scroll
// horizontal, fokus terlihat. Dijalankan di proyek "publik-mobile" (Pixel 7).

for (const path of ["/", "/products", "/assistant?tanya=form"]) {
  test(`TC-A11Y-01 ${path} tanpa scroll horizontal di ponsel @regression`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("TC-A11Y-02 tautan kartu katalog setinggi minimal 44 px @regression", async ({ page }) => {
  await page.goto("/products");
  const heights = await page
    .locator('main a[href^="/products/"]')
    .evaluateAll((links) => links.slice(0, 12).map((link) => link.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
});

test("TC-A11Y-03 fokus keyboard terlihat pada tautan pertama @regression", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    return { outline: style.outlineStyle, width: style.outlineWidth, shadow: style.boxShadow };
  });
  expect(outline).not.toBeNull();
  const visible = outline!.outline !== "none" && outline!.width !== "0px";
  expect(visible || outline!.shadow !== "none").toBe(true);
});

test("TC-A11Y-04 kolom budget Tanya AI punya indikator fokus terlihat (UX-01) @regression", async ({ page }) => {
  await page.goto("/assistant?tanya=form");
  const input = page.getByRole("spinbutton", { name: "Budget dalam Rupiah" });
  await input.focus();
  // Kolom tanpa bingkai: indikatornya ada di kotak composer yang membungkusnya.
  const indicator = await input.evaluate((el) => {
    const own = getComputedStyle(el);
    const box = el.closest(".rounded-xl") as HTMLElement | null;
    const wrap = box ? getComputedStyle(box) : null;
    // Ring Tailwind = box-shadow "0 0 0 <spread>": cari spread > 0.
    const shadows = (wrap?.boxShadow ?? "none").split(/,(?![^(]*\))/);
    return {
      ownOutline: own.outlineStyle !== "none" && own.outlineWidth !== "0px",
      wrapRing: shadows.some((part) => /0px 0px 0px [1-9][\d.]*px\s*$/.test(part.trim())),
      wrapShadow: wrap?.boxShadow ?? "",
    };
  });
  expect(indicator.ownOutline || indicator.wrapRing, indicator.wrapShadow).toBe(true);
});

test("TC-A11Y-05 tautan baris bawah footer setinggi minimal 44 px (UX-06) @regression", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Beriklan", "Ketentuan Layanan"]) {
    const box = await page.locator("footer").getByRole("link", { name, exact: true }).last().boundingBox();
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(44);
  }
});

const KEY_PAGES = ["/", "/products", "/compare?produk=apple-iphone-17&produk=apple-iphone-16", "/assistant?tanya=form", "/how-it-works"];

for (const path of KEY_PAGES) {
  test(`TC-A11Y-06 ${path} tanpa teks di bawah 12 px (UX-05) @regression`, async ({ page }) => {
    await page.goto(path);
    const tiny = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))
        .filter((el) => {
          const s = getComputedStyle(el);
          const hidden = s.position === "absolute" && (el as HTMLElement).offsetWidth <= 1;
          return !hidden && parseFloat(s.fontSize) < 12;
        })
        .map((el) => `${(el.textContent ?? "").trim().slice(0, 30)} (${getComputedStyle(el).fontSize})`)
    );
    expect(tiny).toEqual([]);
  });

  test(`TC-A11Y-07 ${path} heading tidak lebih besar dari tingkat di atasnya (UX-07) @regression`, async ({ page }) => {
    await page.goto(path);
    const sizes = await page.evaluate(() => {
      const visible = (el: Element) => (el as HTMLElement).offsetWidth > 1;
      const max = (tag: string) =>
        Math.max(0, ...[...document.querySelectorAll(`main ${tag}`)].filter(visible).map((el) => parseFloat(getComputedStyle(el).fontSize)));
      const min = (tag: string) => {
        const list = [...document.querySelectorAll(`main ${tag}`)].filter(visible).map((el) => parseFloat(getComputedStyle(el).fontSize));
        return list.length ? Math.min(...list) : Infinity;
      };
      return { h1: min("h1"), h2: max("h2"), h2min: min("h2"), h3: max("h3") };
    });
    // H2 terbesar tidak melebihi H1; H3 terbesar tidak melebihi H2 terbesar.
    if (sizes.h1 !== Infinity) expect(sizes.h2).toBeLessThanOrEqual(sizes.h1);
    if (sizes.h2 > 0) expect(sizes.h3).toBeLessThanOrEqual(sizes.h2);
  });
}
