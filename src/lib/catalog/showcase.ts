import type { StartingPriceResolution } from "@/lib/catalog/pricing";

/**
 * Pemilihan produk untuk etalase beranda dari data yang sedang aktif.
 *
 * Dulu beranda memakai slug fixture demo yang ditulis langsung ("volt-arc-3",
 * "nusa-aksa-5"). Di data live slug itu tidak ada, sehingga bagian "contoh
 * perbandingan" (PRD §4) hilang tanpa jejak. Aturan di sini memilih dari
 * katalog apa pun yang aktif, dan tetap jujur:
 *
 * - Hanya produk dengan harga segar (status "available", PRD §7). Contoh
 *   perbandingan dengan harga kosong/basi tidak mengajarkan apa pun.
 * - Dua merek berbeda, dengan harga mulai paling berdekatan: alternatif yang
 *   sebanding di budget yang sama, bukan "yang terbaik" (PRD §3, FR-04).
 * - Deterministik (seri diputus urutan slug), jadi halaman tidak berganti
 *   contoh setiap kali dimuat dan uji bisa memastikan hasilnya.
 */

export type ShowcaseCandidate = {
  slug: string;
  brand: string;
  price: StartingPriceResolution;
};

function freshPrice(candidate: ShowcaseCandidate): number | null {
  return candidate.price.status === "available" ? candidate.price.priceIdr : null;
}

export function pickComparisonPair(
  candidates: readonly ShowcaseCandidate[]
): [string, string] | null {
  const priced = candidates
    .map((candidate) => ({ candidate, price: freshPrice(candidate) }))
    .filter((entry): entry is { candidate: ShowcaseCandidate; price: number } => entry.price !== null)
    .sort((a, b) => a.price - b.price || a.candidate.slug.localeCompare(b.candidate.slug));

  let best: { pair: [string, string]; gap: number } | null = null;
  for (let i = 0; i < priced.length; i += 1) {
    for (let j = i + 1; j < priced.length; j += 1) {
      const a = priced[i]!;
      const b = priced[j]!;
      if (a.candidate.brand.toLowerCase() === b.candidate.brand.toLowerCase()) continue;
      const gap = b.price - a.price;
      if (best && gap >= best.gap) {
        // Daftar terurut harga: selisih hanya membesar untuk j berikutnya.
        break;
      }
      const pair = [a.candidate.slug, b.candidate.slug].sort() as [string, string];
      best = { pair, gap };
    }
  }
  return best?.pair ?? null;
}

/**
 * Produk untuk panel harga hero (UX-23). Urutan pilihan:
 * 1. harga segar, diperiksa paling baru;
 * 2. bila tidak ada, harga terakhir tercatat yang paling baru (panel memberi
 *    label "terakhir tercatat" beserta tanggal, PRD §7 butir 5);
 * 3. bila katalog belum punya harga sama sekali, produk pertama.
 * Panel "Harga belum tersedia" di kesan pertama hanya muncul di kasus 3.
 */
export function pickHeroProduct<T extends ShowcaseCandidate>(candidates: readonly T[]): T | null {
  const time = (candidate: T) =>
    candidate.price.status === "available"
      ? new Date(candidate.price.checkedAt).getTime()
      : candidate.price.status === "stale"
        ? new Date(candidate.price.observedAt).getTime()
        : 0;
  const newest = (status: "available" | "stale") =>
    candidates
      .filter((candidate) => candidate.price.status === status)
      .sort((a, b) => time(b) - time(a) || a.slug.localeCompare(b.slug))[0];
  return newest("available") ?? newest("stale") ?? candidates[0] ?? null;
}
