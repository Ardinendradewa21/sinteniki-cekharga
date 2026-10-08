import type { Locator, Page } from "@playwright/test";

/** "Rp4.499.000" -> 4499000. Mengembalikan null bila tidak ada angka rupiah. */
export function parseRupiah(text: string): number | null {
  const match = text.match(/Rp\s?([\d.]+)/);
  return match ? Number(match[1].replace(/\./g, "")) : null;
}

/** Semua harga rupiah yang tampil di dalam locator, berurutan sesuai DOM. */
export async function rupiahIn(locator: Locator): Promise<number[]> {
  const texts = await locator.allInnerTexts();
  return texts.map(parseRupiah).filter((value): value is number => value !== null);
}

/** Tautan kartu produk di katalog (`/products/<slug>`), unik dan berurutan. */
export async function productLinks(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator('main a[href^="/products/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  return [...new Set(hrefs.filter((href) => /^\/products\/[a-z0-9-]+$/.test(href)))];
}

/** Kartu produk katalog: elemen daftar yang memuat tautan detail. */
export function productCards(page: Page): Locator {
  return page.locator("main li").filter({ has: page.locator('a[href^="/products/"]') });
}

/**
 * Kalimat yang TIDAK berisi penyangkalan. Situs ini sering menulis
 * "bukan peringkat atau klaim terlaris" / "tanpa penanda pemenang"; kalimat
 * seperti itu justru memenuhi PRD, jadi tidak boleh dianggap klaim.
 */
export function affirmativeSentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => !/\b(bukan|tanpa|tidak|belum)\b/i.test(sentence))
    .join("\n");
}

/** Total produk dari teks ringkasan katalog ("Menampilkan 1-20 dari 101 produk" atau "17 produk yang cocok"). */
export async function catalogTotal(page: Page): Promise<number> {
  const status = page.locator('[aria-live="polite"]').first();
  await status.waitFor();
  const text = await page.locator("main").innerText();
  const match = text.match(/dari (\d+) produk\./) ?? text.match(/(\d+) produk yang cocok/);
  if (!match) throw new Error("Ringkasan jumlah produk tidak ditemukan");
  return Number(match[1]);
}
