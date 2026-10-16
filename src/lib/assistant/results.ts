import { PARAM } from "@/lib/catalog/search-params";
import { buildNeedsHref, type UserNeeds } from "@/lib/assistant/needs";
import type { Candidate, RecommendationResult } from "@/lib/assistant/recommend";

/**
 * View model hasil asisten, dipakai bersama jalur chat dan jalur formulir.
 *
 * Mesin rekomendasi mengembalikan SEMUA kandidat yang lolos; yang ditampilkan
 * dibatasi di sini. Alasannya dua:
 *
 * - Hasil chat ikut bolak-balik di state percakapan setiap giliran. Seratus
 *   kartu kandidat membuat setiap pesan berat tanpa manfaat.
 * - Seratus kartu bukan bantuan memilih. Sisanya diarahkan ke katalog dengan
 *   filter yang sama, jadi tidak ada yang disembunyikan.
 *
 * Modul ini sengaja tanpa `server-only` (hanya mengimpor tipe dari modul
 * server) supaya komponen klien bisa memakai tipenya.
 */

export const RESULT_LIMITS = {
  matches: 5,
  staleMatches: 3,
  overBudget: 3,
  exclusions: 6,
} as const;

export type ResultView = {
  matches: Candidate[];
  staleMatches: Candidate[];
  overBudget: Candidate[];
  exclusions: { name: string; reason: string }[];
  appliedHardRules: string[];
  notes: string[];
  /** Jumlah sebenarnya sebelum dipotong, supaya tampilan bisa jujur menyebutnya. */
  totals: { matches: number; staleMatches: number; overBudget: number; exclusions: number };
  /** Katalog dengan filter yang setara, bila ada kandidat yang tidak ditampilkan. */
  catalogHref: string | null;
  /** Tautan hasil yang bisa dibagikan: hanya kebutuhan terstruktur, tanpa isi percakapan. */
  shareHref: string;
};

function buildCatalogHref(needs: UserNeeds): string {
  const params = new URLSearchParams();
  if (needs.budgetIdr !== null && needs.budgetIsHard) {
    params.set(PARAM.maxPrice, String(needs.budgetIdr));
  }
  if (needs.brandsOnly) {
    for (const brand of needs.brands) params.append(PARAM.brand, brand);
  }
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

export function toResultView(result: RecommendationResult, needs: UserNeeds): ResultView {
  const hidden =
    result.matches.length > RESULT_LIMITS.matches ||
    result.staleMatches.length > RESULT_LIMITS.staleMatches;

  return {
    matches: result.matches.slice(0, RESULT_LIMITS.matches),
    staleMatches: result.staleMatches.slice(0, RESULT_LIMITS.staleMatches),
    overBudget: result.overBudget.slice(0, RESULT_LIMITS.overBudget),
    exclusions: result.exclusions.slice(0, RESULT_LIMITS.exclusions),
    appliedHardRules: result.appliedHardRules,
    notes: result.notes,
    totals: {
      matches: result.matches.length,
      staleMatches: result.staleMatches.length,
      overBudget: result.overBudget.length,
      exclusions: result.exclusions.length,
    },
    catalogHref: hidden ? buildCatalogHref(needs) : null,
    shareHref: buildNeedsHref({ ...needs, requirementsAnswered: true }),
  };
}
