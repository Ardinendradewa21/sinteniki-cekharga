import { formatIdr } from "@/lib/catalog/pricing";
import type { ProductDetail } from "@/lib/catalog/queries";

/**
 * Judul, deskripsi, dan data terstruktur halaman produk (PB-23 + PB-12,
 * 2026-10-14). Modul murni supaya aturannya bisa dites.
 *
 * Aturan kejujuran:
 * - "Terbaru" dan "Mulai Rp…" hanya dipakai bila ada harga SEGAR. Bulan yang
 *   disebut adalah bulan pemeriksaan terakhir, bukan bulan hari ini.
 * - Harga lama disebut "terakhir tercatat" beserta tanggalnya (PRD §7 butir 5).
 * - JSON-LD tidak memuat rating atau ulasan karangan (AGENTS.md), dan blok
 *   penawaran hanya dari harga segar.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "Okt 2026" menurut zona WIB. */
export function monthLabel(iso: string): string {
  const wib = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return `${MONTHS[wib.getUTCMonth()]} ${wib.getUTCFullYear()}`;
}

/** "12 Okt 2026" menurut zona WIB. */
function dateLabel(iso: string): string {
  const wib = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return `${wib.getUTCDate()} ${monthLabel(iso)}`;
}

/** Harga ringkas untuk judul: Rp2,9 Juta / Rp19,9 Juta / Rp899 Ribu. */
export function compactIdr(priceIdr: number): string {
  if (priceIdr >= 1_000_000) {
    const juta = Math.floor(priceIdr / 100_000) / 10;
    return `Rp${juta.toLocaleString("id-ID", { maximumFractionDigits: 1 })} Juta`;
  }
  return `Rp${Math.floor(priceIdr / 1000)} Ribu`;
}

type SeoInput = Pick<
  ProductDetail,
  "name" | "brand" | "model" | "slug" | "image" | "gallery" | "variants" | "price" | "selectedVariant" | "freshOfferSummary"
>;

export function productTitle(detail: SeoInput): string {
  const fresh = detail.freshOfferSummary;
  if (fresh) return `Harga ${detail.name} Terbaru ${monthLabel(fresh.checkedAt)}, Mulai ${compactIdr(fresh.lowPriceIdr)}`;
  return `Harga ${detail.name}: Spesifikasi, Varian, dan Penawaran`;
}

export function productDescription(detail: SeoInput): string {
  const fresh = detail.freshOfferSummary;
  const variants = detail.variants.length;
  const tail = `Bandingkan ${variants} varian, spesifikasi, dan penawaran tokonya di CekHarga.`;
  if (fresh) {
    const stores = fresh.storeCount === 1 ? "1 toko" : `${fresh.storeCount} toko`;
    return `Harga ${detail.name} mulai ${formatIdr(fresh.lowPriceIdr)} di ${stores}, diperiksa ${dateLabel(fresh.checkedAt)}. ${tail}`;
  }
  if (detail.price.status === "stale" && detail.selectedVariant) {
    return `Harga terakhir tercatat ${detail.name} ${detail.selectedVariant.label}: ${formatIdr(detail.price.priceIdr)} pada ${dateLabel(detail.price.observedAt)}; harga bisa sudah berubah. ${tail}`;
  }
  return `Harga ${detail.name} belum tersedia. ${tail}`;
}

/** Data terstruktur schema.org `Product`. `pageUrl` absolut hanya bila domain produksi sudah ditetapkan. */
export function productJsonLd(detail: SeoInput, pageUrl: string | null): Record<string, unknown> {
  const images = detail.gallery.length
    ? detail.gallery.slice(0, 5).map((photo) => photo.src)
    : detail.image.isGenericIllustration
      ? []
      : [detail.image.src];
  const fresh = detail.freshOfferSummary;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: detail.name,
    brand: { "@type": "Brand", name: detail.brand },
    ...(images.length && images.every((src) => /^https:\/\//.test(src)) ? { image: images } : {}),
    ...(pageUrl ? { url: pageUrl } : {}),
    description: productDescription(detail),
    ...(fresh
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "IDR",
            lowPrice: fresh.lowPriceIdr,
            highPrice: fresh.highPriceIdr,
            offerCount: fresh.offerCount,
          },
        }
      : {}),
  };
}

/** JSON untuk `<script type="application/ld+json">`, dengan `<` di-escape (panduan JSON-LD Next.js). */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
