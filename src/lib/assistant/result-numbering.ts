import type { Candidate } from "@/lib/assistant/recommend";
import type { ResultView } from "@/lib/assistant/results";

// Terpisah dari results.ts (yang memakai zod lewat search-params) karena
// dipakai kartu hasil di klien.

export type NumberedCandidate = {
  /** Nomor tampilan, dimulai dari 1, berurutan lintas grup. */
  number: number;
  group: "cocok" | "harga-lama" | "luar-budget";
  candidate: Candidate;
};

/**
 * Nomor kandidat yang sama dipakai kartu hasil dan penulis balasan Tanya AI,
 * supaya "kenapa nomor 2?" merujuk kartu yang sama dengan yang dilihat
 * pengguna. Urutannya mengikuti urutan grup di layar.
 */
export function numberCandidates(view: Pick<ResultView, "matches" | "staleMatches" | "overBudget">): NumberedCandidate[] {
  const groups: [NumberedCandidate["group"], Candidate[]][] = [
    ["cocok", view.matches],
    ["harga-lama", view.staleMatches],
    ["luar-budget", view.overBudget],
  ];
  const out: NumberedCandidate[] = [];
  for (const [group, list] of groups) {
    for (const candidate of list) out.push({ number: out.length + 1, group, candidate });
  }
  return out;
}
