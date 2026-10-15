/**
 * Kelas chipset untuk MENGURUTKAN kandidat asisten (rancangan Tanya AI §3.4).
 *
 * Ini pengelompokan editorial CekHarga berdasarkan seri dan generasi chipset
 * menurut penempatan pabrikannya (mis. Snapdragon 8 Elite = seri teratas,
 * Helio G81 = seri entry). Bukan hasil benchmark dan bukan klaim pengalaman
 * pemakaian: PRD FR-06 melarang menyimpulkan pengalaman gaming dari angka
 * spesifikasi, jadi tampilan selalu menyebutnya "perkiraan kelas", dan kelas
 * tidak pernah dipakai sebagai syarat wajib.
 *
 * Chipset yang tidak cocok dengan aturan mana pun mendapat `null`: tidak
 * menambah skor dan tidak memunculkan klaim. Tambahkan aturan baru di atas
 * aturan yang lebih umum, karena aturan pertama yang cocok yang dipakai.
 */

export type ChipsetTier = 1 | 2 | 3 | 4 | 5;

export const CHIPSET_TIER_LABELS: Record<ChipsetTier, string> = {
  5: "flagship",
  4: "menengah atas",
  3: "menengah",
  2: "menengah bawah",
  1: "entry",
};

const RULES: readonly [RegExp, ChipsetTier][] = [
  // Qualcomm
  [/snapdragon 8 elite|snapdragon 8 gen [345]\b/i, 5],
  [/snapdragon 8s gen|snapdragon 8\+? gen [12]\b/i, 4],
  [/snapdragon 7\+? gen|snapdragon 7s gen [34]\b/i, 3],
  [/snapdragon 7s gen [12]\b|snapdragon 7[0-9]{2}g?\b/i, 2],
  [/snapdragon 6s? (4g )?gen|snapdragon 6[0-9]{2}\b/i, 2],
  [/snapdragon 4/i, 1],
  // MediaTek
  [/dimensity 9[0-9]{3}/i, 5],
  [/dimensity 8[0-9]{3}/i, 4],
  [/dimensity 7[2-9][0-9]{2}|dimensity 1200/i, 3],
  [/dimensity (7[01][0-9]{2}|1[01][0-9]{2}|9[0-9]{2})\b/i, 2],
  [/dimensity 6[0-9]{3}/i, 2],
  [/helio g(9[0-9]|1[0-9]{2})\b/i, 2],
  [/helio/i, 1],
  // Apple
  [/apple a1[7-9]/i, 5],
  [/apple a1[56]/i, 4],
  [/apple a1[0-4]/i, 3],
  // Samsung, Huawei
  [/exynos 2[0-9]{3}/i, 5],
  [/exynos 1[4-9][0-9]{2}/i, 3],
  [/exynos 1[0-3][0-9]{2}/i, 2],
  [/kirin 9[0-9]{3}/i, 4],
  [/kirin 8[0-9]{3}/i, 2],
  // Unisoc
  [/unisoc t[78]3[0-9]{2}/i, 2],
  [/unisoc/i, 1],
];

/**
 * Kelas chipset utama. Teks GSMArena kadang memuat dua chipset per wilayah
 * ("Snapdragon … - US, Exynos … - ROW"); yang dinilai yang disebut pertama.
 */
export function chipsetTier(chipset: string | null): ChipsetTier | null {
  if (!chipset) return null;
  const primary = chipset.split(/ - |\) [A-Z]/)[0] ?? chipset;
  for (const [pattern, tier] of RULES) {
    if (pattern.test(primary)) return tier;
  }
  return null;
}

/** Nama chipset tanpa kode model dan proses, mis. "Snapdragon 7s Gen 4". */
export function chipsetShortName(chipset: string): string {
  const primary = chipset.split(" - ")[0] ?? chipset;
  return primary
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(qualcomm|mediatek)\b/gi, "")
    .replace(/\bSM[0-9]{4}[-A-Z0-9]*\b/g, "")
    .replace(/\bMT[0-9]{4}[A-Z]*\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
