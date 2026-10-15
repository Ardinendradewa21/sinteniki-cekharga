import { canonicalBrandModel } from "@/lib/catalog/brands";
import type { CsvRow } from "@/lib/import/csv-parser";
import { resolveNamedProduct, type OfferCatalogProduct } from "@/lib/import/offers";
import type { LineupItem } from "@/lib/scrape/types";

/**
 * Tarik "harga saja" (PB-16). Modul murni.
 *
 * Membuat baris penawaran resmi untuk produk yang SUDAH ada di katalog,
 * langsung dari daftar harga situs resmi, tanpa membuka GSMArena (yang sering
 * meminta verifikasi anti-bot dan tidak boleh ditembus). Pencocokan nama
 * memakai aturan yang sama dengan templat terpadu (`resolveNamedProduct`).
 *
 * Yang sengaja TIDAK dilakukan:
 * - Produk yang belum ada di katalog tidak dibuat; namanya dilaporkan supaya
 *   admin menariknya lewat tarik otomatis lengkap.
 * - Varian yang tidak tercatat di katalog tidak dikarang.
 * - "Harga mulai" tanpa keterangan varian (Infinix) tidak dipasangkan
 *   otomatis; variannya dipilih admin di tarik otomatis lengkap.
 */

type Source = { marketplace: string; sellerName: string; host: string };

type PricesOnlyPlan = {
  rows: CsvRow[];
  matched: { name: string; slug: string; prices: number }[];
  /** Model situs resmi yang belum ada di katalog. */
  unmatched: string[];
  /** Harga yang dilewati beserta alasannya. */
  notes: { name: string; reason: string }[];
};

function onHost(value: string | null | undefined, host: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host ? url.href : null;
  } catch {
    return null;
  }
}

export function planPricesOnly({
  lineup,
  products,
  source,
  brandName,
  observedAt,
}: {
  lineup: readonly LineupItem[];
  products: readonly OfferCatalogProduct[];
  source: Source;
  /** Nama merek di katalog, mis. "Xiaomi" atau "iQOO". */
  brandName: string;
  observedAt: string;
}): PricesOnlyPlan {
  const plan: PricesOnlyPlan = { rows: [], matched: [], unmatched: [], notes: [] };

  for (const item of lineup) {
    const named = canonicalBrandModel(brandName, item.officialName);
    const name = `${named.brand} ${named.model}`;
    const modelUrl = onHost(item.officialUrl, source.host);
    if (!modelUrl) {
      plan.notes.push({ name, reason: "Halaman produk tidak berada di situs resmi merek." });
      continue;
    }
    const resolved = resolveNamedProduct(name, products);
    if (resolved && "error" in resolved) {
      plan.notes.push({ name, reason: resolved.error });
      continue;
    }
    if (!resolved) {
      plan.unmatched.push(name);
      continue;
    }
    const { product } = resolved;
    const hasVariant = (ramGb: number, storageGb: number) =>
      product.variants.some((variant) => variant.ramGb === ramGb && variant.storageGb === storageGb);

    const prices: { ramGb: number; storageGb: number; priceIdr: number; inStock?: boolean; url?: string }[] = [];
    for (const price of item.prices) {
      if (hasVariant(price.ramGb, price.storageGb)) prices.push(price);
      else plan.notes.push({ name, reason: `Varian ${price.ramGb}/${price.storageGb} GB tidak tercatat di katalog; tidak dikarang.` });
    }
    for (const price of item.storageOnlyPrices) {
      // Situs yang hanya menyebut penyimpanan (Samsung): RAM diambil dari
      // katalog hanya bila penyimpanan itu punya satu pilihan RAM.
      const options = product.variants.filter((variant) => variant.storageGb === price.storageGb);
      if (options.length === 1) prices.push({ ...price, ramGb: options[0]!.ramGb });
      else plan.notes.push({ name, reason: `Penyimpanan ${price.storageGb} GB punya ${options.length} pilihan RAM di katalog; pilih lewat tarik otomatis lengkap.` });
    }
    if (item.unassignedPrices.length > 0) {
      plan.notes.push({ name, reason: "Situs hanya mencantumkan harga mulai tanpa varian; pilih variannya lewat tarik otomatis lengkap." });
    }
    if (prices.length === 0) continue;

    for (const price of prices) {
      plan.rows.push({
        slug: product.slug,
        ram_gb: String(price.ramGb),
        storage_gb: String(price.storageGb),
        marketplace: source.marketplace,
        seller_name: source.sellerName,
        url: onHost(price.url, source.host) ?? modelUrl,
        // Garansi tidak dinyatakan di data situs; dibiarkan kosong, bukan ditebak.
        warranty: "",
        listing_status: price.inStock === false ? "out-of-stock" : "active",
        seller_verified: "tidak",
        price_idr: String(price.priceIdr),
        observed_at: observedAt,
      });
    }
    plan.matched.push({ name, slug: product.slug, prices: prices.length });
  }
  return plan;
}
