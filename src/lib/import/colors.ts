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

/** Jarak edit Levenshtein dua teks pendek (nama warna). */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = prev[j]!;
      prev[j] = Math.min(above + 1, prev[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length]!;
}

/**
 * Warna lain milik produk yang SANGAT mirip dengan `color`, kemungkinan salah
 * ketik ("Hitam Malm" untuk "Hitam Malam"). Warna baru yang memang berbeda
 * ("Vibing Blue" vs "Black") tidak dianggap mirip. Batasnya ketat supaya nama
 * pendek yang memang berbeda ("Pink" vs "Mint") tidak tertangkap: beda 1 huruf
 * untuk nama sampai 6 huruf, beda 2 huruf untuk nama lebih panjang.
 * Mengembalikan warna pembanding pertama yang mirip, atau null.
 */
export function similarColor(color: string, known: readonly string[]): string | null {
  const key = colorKey(color.replace(/\s+/g, " ").trim());
  if (key.length < 4) return null;
  const limit = key.length <= 6 ? 1 : 2;
  for (const other of known) {
    const otherKey = colorKey(other.replace(/\s+/g, " ").trim());
    if (!otherKey || otherKey === key) continue;
    if (Math.abs(otherKey.length - key.length) > limit) continue;
    if (editDistance(key, otherKey) <= limit) return other;
  }
  return null;
}
