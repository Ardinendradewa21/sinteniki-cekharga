/**
 * Aturan gerbang terbit (PB-15), modul murni supaya bisa diuji tanpa database.
 *
 * - `tanpa-varian`: harga selalu terikat varian (PRD §7).
 * - `tanpa-penawaran`: tidak ada penawaran berstatus `active`. Penawaran habis
 *   stok, ambigu, atau nonaktif tidak dihitung, karena pembeli tidak punya
 *   tempat membeli.
 */
export type PublishBlocker = "tanpa-varian" | "tanpa-penawaran";

export function publishBlockers(
  productIds: readonly string[],
  variants: readonly { id: string; product_id: string }[],
  offers: readonly { variant_id: string; listing_status: string }[]
): Map<string, PublishBlocker> {
  const productByVariant = new Map(variants.map((variant) => [variant.id, variant.product_id]));
  const withVariant = new Set(variants.map((variant) => variant.product_id));
  const withActiveOffer = new Set<string>();
  for (const offer of offers) {
    if (offer.listing_status !== "active") continue;
    const productId = productByVariant.get(offer.variant_id);
    if (productId) withActiveOffer.add(productId);
  }
  const blockers = new Map<string, PublishBlocker>();
  for (const id of productIds) {
    if (!withVariant.has(id)) blockers.set(id, "tanpa-varian");
    else if (!withActiveOffer.has(id)) blockers.set(id, "tanpa-penawaran");
  }
  return blockers;
}
