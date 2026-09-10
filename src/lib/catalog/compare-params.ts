import { z } from "zod";

/**
 * Kontrak URL halaman perbandingan (PRD FR-04).
 *
 * Bentuknya `?produk=<slug>~<varian>` dan boleh diulang, mis.
 * `/compare?produk=volt-arc-3~8-256&produk=nusa-aksa-5`.
 *
 * Beberapa keputusan:
 *
 * - Sama seperti katalog dan halaman detail, pilihan hidup di URL supaya
 *   perbandingan bisa dibagikan dan dibuka ulang persis sama. Ini juga yang
 *   membuat tambah/hapus pembanding cukup berupa tautan biasa, tanpa state
 *   klien.
 * - Pemisahnya `~` karena termasuk karakter unreserved di RFC 3986, jadi tidak
 *   pernah ter-encode dan URL-nya tetap terbaca manusia.
 * - Bagian varian opsional. Tanpa varian, halaman memakai varian basis harga,
 *   sama dengan perilaku halaman detail.
 */

export const COMPARE_PARAM = "produk";

/** PRD FR-04: "Pengguna memilih 2-3 kandidat beserta variannya." */
export const MIN_COMPARE_ITEMS = 2;
export const MAX_COMPARE_ITEMS = 3;

export type CompareSelection = {
  slug: string;
  /** `null` = pakai varian basis harga. */
  variantKey: string | null;
};

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const variantKeySchema = z.string().trim().regex(/^\d+-\d+$/);

function toList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Membaca pilihan dari URL. Entri yang bentuknya tidak masuk akal dibuang
 * diam-diam, bukan melempar error: URL bisa datang dari mana saja dan halaman
 * perbandingan tetap harus tampil.
 */
export function parseCompareSelections(
  raw: Record<string, string | string[] | undefined>
): CompareSelection[] {
  const selections: CompareSelection[] = [];
  const seen = new Set<string>();

  for (const entry of toList(raw[COMPARE_PARAM])) {
    const [rawSlug, rawVariant] = entry.split("~");

    const slug = slugSchema.safeParse(rawSlug);
    if (!slug.success) continue;

    // Satu produk hanya boleh muncul sekali; membandingkan produk dengan
    // dirinya sendiri tidak memberi informasi apa pun.
    if (seen.has(slug.data)) continue;
    seen.add(slug.data);

    const variant = rawVariant
      ? variantKeySchema.safeParse(rawVariant)
      : undefined;

    selections.push({
      slug: slug.data,
      variantKey: variant?.success ? variant.data : null,
    });

    // Kelebihan pilihan dipotong, bukan ditolak. Pengguna tetap melihat
    // perbandingan yang valid alih-alih halaman error.
    if (selections.length >= MAX_COMPARE_ITEMS) break;
  }

  return selections;
}

export function buildCompareHref(selections: CompareSelection[]): string {
  if (selections.length === 0) return "/compare";

  /*
    Query string dirakit manual, bukan lewat `URLSearchParams`, karena
    `toString()` meng-encode `~` menjadi `%7E` dan URL-nya jadi sulit dibaca.
    Aman dilakukan di sini: slug sudah dibatasi pola kebab-case dan kunci varian
    hanya angka dengan tanda hubung, jadi tidak ada karakter yang perlu di-escape.
  */
  const parts = selections.map((selection) => {
    const value = selection.variantKey
      ? `${selection.slug}~${selection.variantKey}`
      : selection.slug;
    return `${COMPARE_PARAM}=${value}`;
  });

  return `/compare?${parts.join("&")}`;
}
