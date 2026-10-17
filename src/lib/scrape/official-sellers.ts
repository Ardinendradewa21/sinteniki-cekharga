import type { ScrapeBrand } from "@/lib/scrape/types";

/**
 * Identitas penjual resmi per merek: host tautan produk, label marketplace,
 * dan nama penjual yang dicatat di penawaran. Modul murni (tanpa fetch), jadi
 * bisa dipakai tarik otomatis (`sources.ts`) maupun importer penawaran.
 */
type OfficialSeller = {
  label: string;
  /** Host yang sah untuk tautan produk resmi (dicek ulang saat menyimpan). */
  productHost: string;
  marketplace: string;
  sellerName: string;
};

export const OFFICIAL_SELLERS = {
  vivo: { label: "vivo", productHost: "www.vivo.com", marketplace: "Situs resmi vivo Indonesia", sellerName: "vivo Indonesia" },
  iqoo: { label: "iQOO", productHost: "www.iqoo.com", marketplace: "Situs resmi iQOO Indonesia", sellerName: "iQOO Indonesia" },
  oppo: { label: "OPPO", productHost: "www.oppo.com", marketplace: "Situs resmi OPPO Indonesia", sellerName: "OPPO Indonesia" },
  samsung: { label: "Samsung", productHost: "www.samsung.com", marketplace: "Situs resmi Samsung Indonesia", sellerName: "Samsung Indonesia" },
  xiaomi: { label: "Xiaomi", productHost: "www.mi.co.id", marketplace: "Situs resmi Xiaomi Indonesia", sellerName: "Xiaomi Indonesia" },
  // Apple tidak punya toko online Indonesia; harga dari Digimap sebagai
  // penjual, dicatat dengan nama penjualnya, tanpa badge terverifikasi.
  apple: { label: "Digimap", productHost: "www.digimap.co.id", marketplace: "Digimap", sellerName: "Digimap" },
  // Tautan produk mengarah ke toko resminya (Magento), bukan ke situs utama.
  infinix: {
    label: "Infinix",
    productHost: "id.pro.infinixmobility.com",
    marketplace: "Situs resmi Infinix Indonesia",
    sellerName: "Infinix Indonesia",
  },
} satisfies Partial<Record<ScrapeBrand, OfficialSeller>>;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Penawaran dari penjual resmi: host, marketplace, dan nama penjual cocok
 * dengan satu entri. Satu varian semestinya hanya punya SATU penawaran dari
 * penjual resmi, karena situs resmi menjual tiap varian di satu halaman.
 */
export function isOfficialOffer(offer: { url: string; marketplace: string; sellerName: string }): boolean {
  const host = hostOf(offer.url);
  return Object.values(OFFICIAL_SELLERS).some(
    (seller) => seller.productHost === host && seller.marketplace === offer.marketplace && seller.sellerName === offer.sellerName
  );
}

/** Host URL sama (bentuk huruf kecil); dipakai saat memindahkan penawaran ke URL baru. */
export function sameHost(a: string, b: string): boolean {
  const host = hostOf(a);
  return host !== null && host === hostOf(b);
}
