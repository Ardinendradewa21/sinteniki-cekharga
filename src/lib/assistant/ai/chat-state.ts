import type { Collected } from "@/lib/assistant/ai/collected-schema";
import type { ResultView } from "@/lib/assistant/results";
import type { PriceResolution } from "@/lib/catalog/pricing";

/**
 * Tipe dan konstanta percakapan yang dipakai bersama klien dan server.
 *
 * Modul ini SENGAJA tanpa `server-only` dan tanpa ketergantungan ke modul
 * server. Komponen chat di sisi klien membutuhkan `CHAT_START` sebagai nilai
 * awal; kalau nilai itu diimpor dari modul ber-`server-only`, seluruh kode
 * server ikut tertarik ke bundel klien dan build gagal.
 *
 * Karena itu arah ketergantungannya satu arah: modul server mengimpor dari
 * sini, tidak pernah sebaliknya.
 */

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

// Skema zod-nya ada di collected-schema.ts: impor tipe saja supaya zod tidak
// ikut ke bundel klien lewat CHAT_START.
export type { Collected } from "@/lib/assistant/ai/collected-schema";

export const EMPTY_COLLECTED: Collected = {
  budgetIdr: null,
  budgetIsHard: null,
  activities: [],
  priorities: [],
  requirements: [],
  brands: [],
  brandsOnly: false,
  avoidBrands: [],
};

/** Kandidat nyata dari mesin deterministik, bukan karangan model. */
export type ChatResult = ResultView;

/**
 * Produk yang ditanyakan atau dibandingkan pengguna (VD-08), sebagai kartu
 * ringkas di bawah jawaban. Datanya dari katalog, bukan dari model.
 */
export type ProductCardView = {
  slug: string;
  name: string;
  variantLabel: string | null;
  price: PriceResolution;
  detailHref: string;
  image: { src: string; alt: string; isGenericIllustration: boolean };
};

export type ChatState = {
  messages: ChatMessage[];
  collected: Collected;
  suggestions: string[];
  /** Hasil pencarian; null selama masih mengobrol. */
  result: ChatResult | null;
  /** Tautan halaman perbandingan bila pengguna minta dua kandidat dibandingkan. */
  compareHref: string | null;
  /** Kartu produk yang ditanyakan/dibandingkan giliran terakhir; null bila tidak ada. */
  products: ProductCardView[] | null;
  /** Halaman perbandingan untuk `products` (dua produk atau lebih). */
  productsCompareHref: string | null;
  /**
   * Indeks pesan asisten tempat `result` dan `products` ditempelkan, supaya
   * kartu tampil tepat di bawah jawaban yang membahasnya (gaya chat), bukan
   * di dasar halaman. Pertanyaan umum sesudahnya tidak menghapus hasil.
   */
  resultIndex: number | null;
  productsIndex: number | null;
  error: string | null;
  /** Pesan pengguna yang gagal diproses, untuk tombol "Coba lagi" (PRD FR-06). */
  retryText: string | null;
};

export const CHAT_START: ChatState = {
  messages: [],
  collected: EMPTY_COLLECTED,
  suggestions: [],
  result: null,
  compareHref: null,
  products: null,
  productsCompareHref: null,
  resultIndex: null,
  productsIndex: null,
  error: null,
  retryText: null,
};
