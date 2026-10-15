import type { Correction, CorrectionLevel } from "@/lib/import/normalize";

/**
 * Ringkasan catatan koreksi templat terpadu untuk halaman pratinjau. Daftar
 * lengkap bisa panjang (satu catatan per sel yang dikoreksi), jadi batch hanya
 * menyimpan sebagian daftar ditambah hitungan lengkapnya.
 */

const MAX_STORED_CORRECTIONS = 300;

export type CorrectionSummary = Record<CorrectionLevel, number> & { total: number };

export function summarizeCorrections(corrections: readonly Correction[]): CorrectionSummary {
  const summary: CorrectionSummary = { info: 0, warning: 0, error: 0, total: corrections.length };
  for (const correction of corrections) summary[correction.level] += 1;
  return summary;
}

const LEVEL_ORDER: Record<CorrectionLevel, number> = { error: 0, warning: 1, info: 2 };

/**
 * Catatan yang disimpan di batch: baris dilewati dan konflik SELALU lebih
 * dulu, baru koreksi info mengisi sisa kuota. Tanpa ini, berkas 500 baris
 * (sekitar 2.000 catatan info) membuat konflik di bawah baris ke-75 hilang
 * dari pratinjau.
 */
export function selectStoredCorrections(
  corrections: readonly Correction[],
  limit = MAX_STORED_CORRECTIONS
): Correction[] {
  return [...corrections]
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.line - b.line)
    .slice(0, limit);
}
