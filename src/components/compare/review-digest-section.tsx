import { ReviewDigestPanel } from "@/components/compare/review-digest-panel";
import type { CompareResult } from "@/lib/catalog/queries";
import { digestProducts, readCachedDigest } from "@/lib/reviews/digest";
import { countNotes, digestCacheKey, MIN_NOTES_FOR_DIGEST } from "@/lib/reviews/digest-rules";

/**
 * Bagian rangkuman AI ulasan reviewer (PB-40). Tidak tampil bila ringkasan
 * reviewer untuk produk yang dibandingkan belum cukup. Rangkuman yang sudah
 * ada di cache dibaca di server tanpa memanggil model.
 */
export async function ReviewDigestSection({ result }: { result: CompareResult }) {
  const products = digestProducts(result);
  const noteCount = countNotes(products);
  if (noteCount < MIN_NOTES_FOR_DIGEST) return null;
  const initial = await readCachedDigest(digestCacheKey(products));
  const channels = [...new Set(products.flatMap((product) => product.notes.map((note) => note.channelName)))];

  return (
    <div className="mt-4">
      <ReviewDigestPanel slugs={products.map((product) => product.slug)} initial={initial} noteCount={noteCount} channels={channels} />
    </div>
  );
}
