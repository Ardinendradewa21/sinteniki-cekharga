import "server-only";

import { selectWhereIn } from "@/lib/backend/paged-read";
import { publishBlockers, type PublishBlocker } from "@/lib/admin/publish-rules";

/**
 * Gerbang terbit (PB-15, disetujui PO 2026-10-08): produk hanya boleh terbit
 * bila punya varian DAN sedikitnya satu penawaran aktif. Halaman publik tanpa
 * penawaran tidak bisa menampilkan harga maupun tempat membeli.
 *
 * Dua query bertumpuk (varian lalu penawaran), bukan query per produk, supaya
 * penerbitan massal tetap tanpa N+1 (aturan system design 4). `selectWhereIn`
 * menyaring penawaran yang dihapus lunak.
 */
export async function loadPublishBlockers(
  productIds: readonly string[]
): Promise<Map<string, PublishBlocker>> {
  if (productIds.length === 0) return new Map();
  const variants = (await selectWhereIn("variants", "id, product_id", "product_id", productIds)) as {
    id: string;
    product_id: string;
  }[];
  const offers = variants.length
    ? ((await selectWhereIn(
        "offers",
        "id, variant_id, listing_status",
        "variant_id",
        variants.map((variant) => variant.id)
      )) as { variant_id: string; listing_status: string }[])
    : [];
  return publishBlockers(productIds, variants, offers);
}
