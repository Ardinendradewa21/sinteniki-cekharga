import type { Product } from "@/lib/catalog/schema";

/**
 * Pencocokan kata kunci untuk search bar katalog (PRD FR-02).
 *
 * Kenapa bukan tag manual atau pencarian vektor?
 *
 * - Tag manual di database cepat basi setiap kali produk diimpor dan menambah
 *   kerja admin. Tag di sini DITURUNKAN dari data spesifikasi yang sudah ada,
 *   jadi selalu sinkron tanpa kerja tambahan.
 * - Pencarian vektor/AI berbiaya per query, sulit dijelaskan kenapa sebuah
 *   produk cocok, dan cenderung "menebak" kualitas, padahal PRD melarang
 *   kualitas pemakaian disimpulkan dari angka spesifikasi.
 *
 * Aturannya deterministik dan bisa dijelaskan ke pengguna: setiap kata kunci
 * harus cocok (awal kata) dengan nama, merek, atau tag produk. Kata yang tidak
 * dikenal katalog sama sekali diabaikan DAN dilaporkan, bukan membuat hasil
 * kosong tanpa penjelasan.
 */

/** Kata pengisi yang tidak membawa syarat apa pun. */
const STOPWORDS = new Set([
  "hp", "handphone", "hape", "ponsel", "smartphone", "phone", "yang", "yg",
  "untuk", "utk", "buat", "dan", "atau", "dengan", "dgn", "ada", "mau", "cari",
  "carikan", "butuh", "perlu", "pengen", "ingin", "ga", "gak", "nggak", "tidak",
  "bisa", "aja", "saja", "dong", "sih", "ya", "nya", "di", "ke", "dari", "sama",
  "harga", "budget", "anggaran", "rp", "juta", "jt", "ribu", "rb", "minimal",
  "maksimal", "min", "max", "gb", "giga", "ram", "penyimpanan", "storage",
  "memori", "internal", "punya", "kalau", "paling", "lebih", "sekitar", "an",
  "tanpa", "bukan", "the", "for", "with",
]);

/**
 * Kata penilaian yang tidak punya padanan data. Tidak dipakai menyaring,
 * tetapi dilaporkan supaya pengguna tahu cara menulis syarat yang terukur.
 */
const SUBJECTIVE = new Set([
  "murah", "termurah", "mahal", "bagus", "terbagus", "terbaik", "best",
  "mantap", "keren", "kencang", "cepat", "ngebut", "rekomendasi",
  "recommended", "worth", "premium", "flagship",
]);

export type KeywordPlan = {
  /** Kata yang dicocokkan ke produk (semua harus cocok). */
  keywords: string[];
  /** Kata penilaian yang tidak bisa diukur dari data. */
  subjective: string[];
};

export function planKeywords(keywordText: string): KeywordPlan {
  const tokens = keywordText
    .normalize("NFKC")
    .toLocaleLowerCase("id-ID")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);

  const keywords: string[] = [];
  const subjective: string[] = [];
  for (const token of new Set(tokens)) {
    if (STOPWORDS.has(token)) continue;
    if (SUBJECTIVE.has(token)) subjective.push(token);
    else keywords.push(token);
  }
  return { keywords, subjective };
}

function words(value: string | null | undefined): string[] {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("id-ID")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Dokumen pencarian satu produk: token nama/merek dan tag otomatis dari
 * spesifikasi. Tag hanya dibuat dari data yang tercatat `true`/terisi;
 * nilai `null` (tidak diketahui) tidak pernah menjadi tag.
 */
export type SearchDocument = { name: Set<string>; tags: Set<string> };

export function buildSearchDocument(product: Product): SearchDocument {
  const specs = product.specs;
  const name = new Set([
    ...words(product.brand),
    ...words(product.model),
    ...words(product.slug.replace(/-/g, " ")),
  ]);

  // Angka murni dari chipset/OS ("8" dari "Snapdragon 8 Elite", "16" dari
  // "Android 16") dibuang: kalau tidak, pencarian "iphone 16" bisa cocok ke
  // ponsel Android 16. Angka hanya bermakna dari nama produk dan tahun rilis.
  const tags = new Set<string>(
    [
      ...words(specs.chipset),
      ...words(specs.displayTechnology),
      ...words(specs.ipRating),
      ...words(specs.osVersion),
    ].filter((token) => !/^\d+$/.test(token))
  );
  if (specs.is5G === true) tags.add("5g");
  if (specs.hasNfc === true) tags.add("nfc");
  if (specs.releaseYear) tags.add(String(specs.releaseYear));
  if (specs.cameraHasUltrawide === true) tags.add("ultrawide");
  if (specs.cameraHasTelephoto === true) {
    tags.add("telefoto");
    tags.add("telephoto");
  }
  if (specs.has35mmJack === true) tags.add("jack");
  if (/\b(?:fold|flip)/i.test(product.model)) {
    tags.add("lipat");
    tags.add("foldable");
  }

  return { name, tags };
}

/** Kata kunci cocok bila sama dengan, atau menjadi awal dari, sebuah token. */
function matchesAny(keyword: string, tokens: Set<string>): boolean {
  for (const token of tokens) {
    if (token === keyword || (keyword.length >= 2 && token.startsWith(keyword))) {
      return true;
    }
  }
  return false;
}

export type KeywordMatch = {
  matched: boolean;
  /**
   * Skor kecocokan TEKS, bukan skor kualitas produk (PRD FR-02). Kecocokan di
   * nama/merek lebih relevan daripada kecocokan di tag spesifikasi.
   */
  score: number;
};

export function matchKeywords(
  keywords: readonly string[],
  document: SearchDocument
): KeywordMatch {
  let score = 0;
  for (const keyword of keywords) {
    if (matchesAny(keyword, document.name)) score += 2;
    else if (matchesAny(keyword, document.tags)) score += 1;
    else return { matched: false, score: 0 };
  }
  return { matched: true, score };
}

/** Apakah sebuah kata dikenal oleh setidaknya satu produk di katalog. */
export function isKnownKeyword(
  keyword: string,
  documents: readonly SearchDocument[]
): boolean {
  return documents.some(
    (document) => matchesAny(keyword, document.name) || matchesAny(keyword, document.tags)
  );
}
