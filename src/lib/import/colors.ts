/**
 * Nama warna dari berkas impor (2026-10-12).
 *
 * Warna disimpan apa adanya dari sumber ("Lotus Purple", "Hitam"), hanya
 * dirapikan spasinya. Tidak diterjemahkan dan tidak ditebak: dua toko boleh
 * menulis nama berbeda untuk warna yang sama, dan itu tetap tercatat berbeda.
 * Warna tidak pernah membentuk varian atau memengaruhi harga (PRD §7).
 *
 * Modul murni.
 */

const MAX_COLOR_LENGTH = 60;
/** Batas warna per penawaran, sama dengan CHECK di database. */
const MAX_OFFER_COLORS = 24;

/** Nama warna rapi, atau null bila kosong, "-", atau terlalu panjang untuk nama warna. */
export function normalizeColorName(value: string | null | undefined): string | null {
  const cleaned = (value ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === "-" || cleaned.length > MAX_COLOR_LENGTH) return null;
  return cleaned;
}

/** Kunci pembanding: "Black" dan "black" adalah warna yang sama. */
export function colorKey(value: string): string {
  return value.toLowerCase();
}

/** Gabungan daftar warna tanpa duplikat (tanpa membedakan huruf besar), urutan kemunculan pertama dipertahankan. */
export function mergeColors(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) {
    for (const color of list) {
      const key = colorKey(color);
      if (!seen.has(key)) seen.set(key, color);
    }
  }
  return [...seen.values()].slice(0, MAX_OFFER_COLORS);
}

/** Dua daftar berisi warna yang sama, tanpa memedulikan urutan dan huruf besar. */
export function sameColors(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a.map(colorKey));
  const right = new Set(b.map(colorKey));
  return left.size === right.size && [...left].every((key) => right.has(key));
}

/**
 * Warna berkas termasuk daftar warna spesifikasi produk. Nama dalam kurung
 * dihitung sebagai nama lain: "Deep Blue (Endless Blue)" cocok dengan
 * "Deep Blue" dan "Endless Blue". Tanpa daftar warna, tidak ada yang dicek.
 */
export function colorInOptions(color: string, options: readonly string[] | null | undefined): boolean {
  if (!options || options.length === 0) return true;
  const names = new Set<string>();
  for (const option of options) {
    names.add(colorKey(option.trim()));
    const match = option.match(/^(.*?)\s*\((.*)\)\s*$/);
    if (match) {
      names.add(colorKey(match[1]!.trim()));
      names.add(colorKey(match[2]!.trim()));
    }
  }
  return names.has(colorKey(color.trim()));
}
