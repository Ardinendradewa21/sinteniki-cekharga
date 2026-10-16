/**
 * Alamat halaman "A vs B" (PB-28). Modul murni.
 *
 * Bentuknya `/bandingkan/{slugA}-vs-{slugB}`. Slug produk sendiri memakai
 * tanda hubung, jadi pemisahnya dicari dari daftar pasangan yang ada, bukan
 * dengan memotong teks secara buta.
 */

export type PairSlugs = { a: string; b: string };

const PAIR_SEPARATOR = "-vs-";

function pairSegment({ a, b }: PairSlugs): string {
  return `${a}${PAIR_SEPARATOR}${b}`;
}

export function pairPath(pair: PairSlugs): string {
  return `/bandingkan/${pairSegment(pair)}`;
}

/**
 * Pasangan untuk segmen URL. `reversed` berarti alamat memakai urutan
 * terbalik dan perlu dialihkan ke alamat kanonis (urutan pilihan admin).
 */
export function findPair<T extends PairSlugs>(
  segment: string,
  pairs: readonly T[]
): { pair: T; reversed: boolean } | null {
  for (const pair of pairs) {
    if (pairSegment(pair) === segment) return { pair, reversed: false };
    if (pairSegment({ a: pair.b, b: pair.a }) === segment) return { pair, reversed: true };
  }
  return null;
}
