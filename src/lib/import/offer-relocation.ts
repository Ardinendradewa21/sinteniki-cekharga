import type { OfferSourceFormat } from "@/lib/import/offers";
import { isOfficialOffer, sameHost } from "@/lib/scrape/official-sellers";

/**
 * Penawaran lama yang dipindah ke URL baru, bukan diduplikasi (PB-06).
 *
 * Dua sumber hanya punya satu listing per varian, tetapi URL-nya berganti:
 *   - Erafone: warna termurah berganti antar-impor;
 *   - penjual resmi (situs merek, Digimap): URL perwakilan warna/SKU berganti,
 *     mis. Samsung "galaxy-s26-fe-graphite-128gb" menjadi "...-blueberry-...".
 * Tanpa pemindahan, tarik otomatis membuat penawaran kedua untuk varian yang
 * sama; yang lama lalu dicatat gagal setiap hari dan tampil ganda (DEF-018).
 *
 * Penawaran lama dipakai hanya bila: varian, marketplace, dan penjualnya sama,
 * host-nya sama (penjual resmi), belum dihapus, dan URL lamanya tidak ikut
 * diimpor di berkas yang sama. Pratinjau menampilkannya sebagai perubahan URL,
 * jadi admin tetap melihat dan memutuskan sebelum diterapkan.
 */
export function findRelocatedOffer<Row extends Record<string, unknown>>(
  item: { format: OfferSourceFormat; variantId: string; url: string; payload: { marketplace: string; seller_name: string } },
  existing: readonly Row[],
  importedKeys: { has(key: string): boolean }
): Row | undefined {
  const erafone = item.format === "erafone-scrape";
  const official = isOfficialOffer({ url: item.url, marketplace: item.payload.marketplace, sellerName: item.payload.seller_name });
  if (!erafone && !official) return undefined;
  const marketplace = erafone ? "Erafone" : item.payload.marketplace;
  const sellerName = erafone ? "Erafone" : item.payload.seller_name;
  return existing.find(
    (row) =>
      row.variant_id === item.variantId &&
      row.marketplace === marketplace &&
      row.seller_name === sellerName &&
      !row.deleted_at &&
      (erafone || sameHost(String(row.url), item.url)) &&
      !importedKeys.has(`${item.variantId}|${row.url}`)
  );
}
