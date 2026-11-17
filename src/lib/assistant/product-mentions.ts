/**
 * Mengenali produk katalog yang disebut di pesan pengguna (VD-08). Modul murni.
 *
 * Dipakai supaya pertanyaan seperti "redmi note 17 sama oppo a6 pro mending
 * mana?" dijawab dari data katalog, bukan dibelokkan ke pertanyaan budget.
 * Pencocokan dilakukan KODE, bukan model: model bisa salah eja atau
 * mengarang, sedangkan daftar ini hanya berisi produk yang benar terbit.
 *
 * Cara kerja: teks dan nama produk dinormalkan menjadi huruf kecil tanpa
 * spasi dan tanda baca ("Redmi Note 17" -> "redminote17"). Sebuah produk
 * dianggap disebut bila kuncinya muncul di teks mulai dari awal kata sampai
 * akhir kata. Kunci model yang terlalu pendek atau tanpa huruf ("17") hanya
 * dipakai bila mereknya juga disebut, supaya angka biasa tidak salah tangkap.
 * Bila dua kecocokan bertumpuk, yang terpanjang menang.
 */

export type MentionableProduct = { slug: string; brand: string; model: string };

/** Jumlah produk maksimum yang dikenali dari satu pesan (halaman bandingkan maks. 3). */
export const MAX_MENTIONS = 3;

/** Nama lain merek yang sering diketik pengguna. */
const BRAND_ALIASES: Record<string, string[]> = {
  apple: ["iphone"],
  samsung: ["galaxy"],
  xiaomi: ["redmi", "poco", "mi"],
  vivo: [],
  iqoo: [],
  oppo: [],
  realme: [],
  infinix: [],
  motorola: ["moto"],
};

export function mentionKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]/g, "");
}

type Match = { slug: string; start: number; end: number };

/**
 * Teks dinormalkan per kata lalu disambung, sambil mencatat posisi awal dan
 * akhir setiap kata. Kecocokan wajib mulai di awal kata dan selesai di akhir
 * kata: "oppo a6 pro mending" cocok dengan "oppoa6pro", tetapi "redmi note
 * 17 pro" tidak cocok dengan produk "Redmi Note 17" kecuali tidak ada yang
 * lebih panjang (lihat penumpukan di bawah).
 */
function wordIndex(text: string): { haystack: string; starts: Set<number>; ends: Set<number> } {
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\+/g, " plus ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const starts = new Set<number>();
  const ends = new Set<number>();
  let haystack = "";
  for (const word of words) {
    starts.add(haystack.length);
    haystack += word;
    ends.add(haystack.length);
  }
  return { haystack, starts, ends };
}

function occurrences(index: ReturnType<typeof wordIndex>, needle: string): number[] {
  const found: number[] = [];
  if (!needle) return found;
  for (let at = index.haystack.indexOf(needle); at >= 0; at = index.haystack.indexOf(needle, at + 1)) {
    if (index.starts.has(at) && index.ends.has(at + needle.length)) found.push(at);
  }
  return found;
}

export function findProductMentions(text: string, products: readonly MentionableProduct[]): string[] {
  const index = wordIndex(text);
  if (!index.haystack) return [];
  const matches: Match[] = [];

  for (const product of products) {
    const brandKey = mentionKey(product.brand);
    const modelKey = mentionKey(product.model);
    if (!modelKey) continue;
    const brandWords = [brandKey, ...(BRAND_ALIASES[brandKey] ?? [])];
    // Model yang sudah memuat nama seri ("Redmi Note 17", "Galaxy A57") cukup khas.
    const distinctive = modelKey.length >= 4 && /[a-z]/.test(modelKey) && /\d/.test(modelKey);

    const keys = new Set<string>([`${brandKey}${modelKey}`]);
    if (distinctive) keys.add(modelKey);
    for (const alias of BRAND_ALIASES[brandKey] ?? []) {
      // "iPhone 17" untuk Apple "iPhone 17"; "galaxy a57" untuk Samsung "Galaxy A57".
      if (!modelKey.startsWith(alias)) keys.add(`${alias}${modelKey}`);
    }

    for (const key of keys) {
      const isBareModel = key === modelKey && !brandWords.some((word) => modelKey.startsWith(word));
      for (const start of occurrences(index, key)) {
        // Kunci model saja yang pendek wajib didahului mereknya di teks.
        if (isBareModel && !distinctive) continue;
        matches.push({ slug: product.slug, start, end: start + key.length });
      }
    }
  }

  // Terpanjang dulu; buang yang bertumpuk dengan kecocokan yang lebih panjang.
  matches.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const taken: Match[] = [];
  for (const match of matches) {
    if (taken.some((other) => match.start < other.end && other.start < match.end)) continue;
    taken.push(match);
  }
  taken.sort((a, b) => a.start - b.start);
  return [...new Set(taken.map((match) => match.slug))].slice(0, MAX_MENTIONS);
}
