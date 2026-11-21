/**
 * Aturan memilih satu iklan untuk satu slot (ADS-CONTEXT §8 butir 2). Murni,
 * tanpa akses database, supaya bisa diuji (`scripts/tests/ads.test.ts`).
 *
 * Urutan (keputusan PO 21 November 2026, temuan F2 audit iklan):
 * 1. Kandidat: slot cocok, belum tampil di halaman ini, target belum habis,
 *    materi lengkap, dan tidak menargetkan merek lain. Iklan bertarget merek
 *    hanya tayang di halaman merek itu.
 * 2. Prioritas tertinggi (angka terkecil) menang, apa pun targetnya. House ad
 *    bertarget (prioritas 90) tidak pernah menyingkirkan iklan berbayar.
 * 3. Bila prioritasnya sama, iklan yang menargetkan merek halaman ini
 *    didahulukan; sisanya dirotasi berbobot.
 */

export type CandidateRow = {
  line_item_id: string;
  slot_code: string;
  format: "display" | "native";
  image_url: string | null;
  headline: string | null;
  priority: number;
  weight: number;
  target_brands: string[] | null;
  remaining: number | null;
};

export function pickCandidate<T extends CandidateRow>(
  rows: T[],
  {
    slotCode,
    brand,
    exclude = [],
    random = Math.random,
  }: { slotCode: string; brand?: string | null; exclude?: string[]; random?: () => number }
): T | null {
  const wanted = brand?.trim().toLowerCase() || null;
  const targets = (row: T) => (row.target_brands ?? []).map((b) => b.trim().toLowerCase()).filter(Boolean);

  const eligible = rows.filter((row) => {
    if (row.slot_code !== slotCode || exclude.includes(row.line_item_id)) return false;
    if (row.remaining !== null && row.remaining <= 0) return false;
    if (row.format === "native" ? !row.headline : !row.image_url) return false;
    const brands = targets(row);
    return brands.length === 0 || (wanted !== null && brands.includes(wanted));
  });
  if (eligible.length === 0) return null;

  const best = Math.min(...eligible.map((row) => row.priority));
  const top = eligible.filter((row) => row.priority === best);
  const targeted = wanted ? top.filter((row) => targets(row).includes(wanted)) : [];
  return pickWeighted(targeted.length > 0 ? targeted : top, random);
}

function pickWeighted<T extends { weight: number }>(rows: T[], random: () => number): T | null {
  const total = rows.reduce((sum, row) => sum + Math.max(1, row.weight), 0);
  let roll = random() * total;
  for (const row of rows) {
    roll -= Math.max(1, row.weight);
    if (roll < 0) return row;
  }
  return rows[0] ?? null;
}

/** Satu merek bila semua produk di halaman bermerek sama; selain itu null (T3). */
export function sharedBrand(brands: (string | null | undefined)[]): string | null {
  const names = new Set(brands.map((b) => b?.trim().toLowerCase()).filter(Boolean));
  if (names.size !== 1) return null;
  return brands.find((b) => b?.trim())?.trim() ?? null;
}
