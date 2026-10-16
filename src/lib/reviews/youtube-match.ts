/**
 * Mencocokkan judul video YouTube ke produk katalog (PB-40).
 *
 * Modul murni tanpa I/O supaya bisa diuji. Pencocokan sengaja konservatif:
 * kandidat yang terlewat masih bisa ditambahkan admin lewat tautan manual,
 * tetapi kandidat yang salah membuang waktu admin. Aturannya:
 *
 * - Nama model harus muncul utuh sebagai rangkaian kata. Huruf dan angka yang
 *   menempel dipisah di kedua sisi ("Reno16 F" = "Reno 16 F").
 * - Kata sesudah nama model tidak boleh mengubah modelnya: "iPhone 17" tidak
 *   cocok dengan "iPhone 17 Pro Max", "OPPO A6" tidak cocok dengan "A6s".
 * - Model yang namanya hanya angka atau kata umum ("15", "V70", "Neo 10")
 *   wajib didahului mereknya ("iQOO 15", "vivo V70").
 * - Bila dua produk cocok di tempat yang sama, yang lebih spesifik menang
 *   ("Galaxy A07 4G" mengalahkan "Galaxy A07").
 * - Judul berhashtag dilewati: hampir selalu video Shorts, bukan ulasan.
 */

export type MatchableProduct = { id: string; brand: string; model: string };

type VideoMatch = {
  productId: string;
  suggestedAspect: "umum" | "kamera";
  looksLikeReview: boolean;
};

/** Kata yang, bila menyusul nama model, berarti model lain. */
const EXTENDERS = new Set([
  "pro", "max", "plus", "ultra", "mini", "lite", "fe", "neo", "prime", "power", "fusion", "air", "edge",
  "s", "c", "x", "t", "r", "e", "f", "d",
]);

/** Kata umum yang tidak cukup untuk mengenali model tanpa merek. */
const GENERIC = new Set(["pro", "max", "plus", "ultra", "mini", "lite", "fe", "neo", "prime", "power", "smart", "air"]);

const CAMERA_WORDS = /\b(kamera|camera|foto|photo|zoom|lensa|selfie)\b/;
const REVIEW_WORDS = /\b(review|ulasan|unboxing|jajal|tes|test|vs|bandingin|komparasi|setelah|bulan kemudian|daily driver|in depth|first impression|hands on)\b/;

function normalizeTitle(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/\+/g, " plus ")
    // Tanda pemisah menjadi batas "|": "iPhone 17 Pro & Pro Max" tidak membuat
    // "Pro" kedua dianggap bagian nama model pertama.
    .replace(/\s\p{Pd}\s|[&,/|;:!?()[\]]/gu, " | ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9|]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function needsBrand(modelTokens: string[]): boolean {
  return !modelTokens.some((token) => /^[a-z]{2,}$/.test(token) && !GENERIC.has(token));
}

function phraseFor(product: MatchableProduct): string[] {
  const model = normalizeTitle(product.model);
  const brand = normalizeTitle(product.brand);
  // Model yang sudah memuat mereknya (mis. "iPhone 17") tidak diulang.
  return needsBrand(model) && model.slice(0, brand.length).join(" ") !== brand.join(" ") ? [...brand, ...model] : model;
}

/** Semua posisi awal `phrase` di `tokens` yang tidak disusul kata pengubah model. */
function findSpans(tokens: string[], phrase: string[]): [number, number][] {
  const spans: [number, number][] = [];
  for (let start = 0; start + phrase.length <= tokens.length; start += 1) {
    if (!phrase.every((word, offset) => tokens[start + offset] === word)) continue;
    const next = tokens[start + phrase.length];
    if (next !== undefined && EXTENDERS.has(next)) continue;
    spans.push([start, start + phrase.length]);
  }
  return spans;
}

/** Judul berhashtag hampir selalu video Shorts: cuplikan, bukan ulasan. */
const HASHTAG = /#[\p{L}\p{N}_]+/u;

export function matchVideoTitle(title: string, products: readonly MatchableProduct[]): VideoMatch[] {
  if (HASHTAG.test(title)) return [];
  const tokens = normalizeTitle(title);
  if (tokens.length === 0) return [];
  const hits = products
    .map((product) => ({ product, spans: findSpans(tokens, phraseFor(product)) }))
    .filter((hit) => hit.spans.length > 0);

  // Buang produk yang setiap kemunculannya tertutup produk lain yang lebih panjang.
  const kept = hits.filter((hit) =>
    hit.spans.some(
      ([start, end]) =>
        !hits.some(
          (other) =>
            other !== hit &&
            other.spans.some(([otherStart, otherEnd]) => otherStart <= start && otherEnd >= end && otherEnd - otherStart > end - start)
        )
    )
  );

  const plain = tokens.filter((token) => token !== "|").join(" ");
  const suggestedAspect = CAMERA_WORDS.test(plain) ? "kamera" : "umum";
  const looksLikeReview = REVIEW_WORDS.test(plain);
  return kept.map((hit) => ({ productId: hit.product.id, suggestedAspect, looksLikeReview }));
}

/** ID video dari tautan YouTube biasa, pendek, Shorts, atau embed. */
export function parseYoutubeVideoId(input: string): string | null {
  const text = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "music.youtube.com") {
    id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** Tautan video dengan menit yang dirujuk, untuk ditampilkan ke publik. */
export function youtubeWatchUrl(videoId: string, seconds: number | null = null): string {
  return `https://www.youtube.com/watch?v=${videoId}${seconds ? `&t=${seconds}s` : ""}`;
}
