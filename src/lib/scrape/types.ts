/**
 * Tipe bersama fitur tarik data otomatis, dipakai server action dan UI admin.
 *
 * Sengaja tanpa `server-only` dan tanpa import modul server: berkas "use server"
 * hanya boleh mengekspor fungsi async, jadi tipe dan konstanta tinggal di sini.
 */

import type { SpecRow } from "@/lib/scrape/parsers";

export const SCRAPE_BRANDS = [
  "vivo",
  "iqoo",
  "oppo",
  "samsung",
  "xiaomi",
  "apple",
  "infinix",
  "itel",
  "motorola",
] as const;
export type ScrapeBrand = (typeof SCRAPE_BRANDS)[number];

/**
 * Merek dengan sumber harga online di Indonesia. Apple tidak punya toko online
 * Indonesia, jadi harganya diambil dari Digimap (penjual, bukan Apple sendiri;
 * labelnya ditulis apa adanya). Infinix hanya menerbitkan "harga mulai" tanpa
 * varian, jadi variannya dipilih admin di pratinjau. itel dan Motorola tidak
 * menampilkan harga online sama sekali per 2026-09-23; daftar modelnya diambil
 * dari GSMArena dan harganya diisi lewat impor CSV penawaran.
 */
export const BRANDS_WITH_OFFICIAL_PRICES: readonly ScrapeBrand[] = ["vivo", "iqoo", "oppo", "samsung", "xiaomi", "apple", "infinix"];

export const SCRAPE_BRAND_LABELS: Record<ScrapeBrand, string> = {
  vivo: "vivo (harga dari vivo.com/id)",
  iqoo: "iQOO (harga dari iqoo.com/id)",
  oppo: "OPPO (harga dari oppo.com/id)",
  samsung: "Samsung (harga dari samsung.com/id)",
  xiaomi: "Xiaomi (harga dari mi.co.id)",
  apple: "Apple (harga dari digimap.co.id)",
  infinix: "Infinix (harga mulai dari infinixmobility.com)",
  itel: "itel (spesifikasi saja)",
  motorola: "Motorola (spesifikasi saja)",
};

export type OfficialVariantPrice = {
  ramGb: number;
  storageGb: number;
  priceIdr: number;
  /** Harga promo yang tertera langsung di situs resmi. */
  isPromotion: boolean;
  /** false = semua warna varian ini sedang habis; dicatat sebagai out-of-stock. */
  inStock?: boolean;
  /** Halaman produk khusus varian ini (Digimap); bila kosong dipakai halaman model. */
  url?: string;
};

/** Satu model dari daftar produk situs resmi (atau GSMArena bila merek tanpa harga resmi). */
export type LineupItem = {
  /** ID unik di sumbernya, sebagai string (kode produk OPPO berawalan huruf). */
  officialId: string;
  brand: ScrapeBrand;
  officialName: string;
  /** Halaman produk di situs resmi; null bila daftar berasal dari GSMArena. */
  officialUrl: string | null;
  prices: OfficialVariantPrice[];
  /** Harga yang RAM-nya belum diketahui (Samsung); dipasangkan setelah varian GSMArena terbaca. */
  storageOnlyPrices: { storageGb: number; priceIdr: number; isPromotion: boolean; inStock?: boolean; url?: string }[];
  /** "Harga mulai" tanpa keterangan varian (Infinix); variannya dipilih admin di pratinjau. */
  unassignedPrices: { priceIdr: number; isPromotion: boolean; url?: string }[];
  priceIssues: string[];
  /** Situs resmi juga memuat "... 5G" dengan nama dasar sama (nama ini kemungkinan 4G). */
  siblingHas5g: boolean;
  /** Halaman GSMArena yang sudah pasti (daftar dari GSMArena), tanpa perlu pencocokan nama. */
  gsmarenaPath: string | null;
};

export type LineupResult =
  | { ok: true; items: LineupItem[]; fetchedAt: string }
  | { ok: false; error: string };

export type PreviewIssue = {
  /** `error` menghalangi penyimpanan model ini; `warning` perlu dicek manusia. */
  level: "error" | "warning";
  message: string;
};

export type PreviewItem = {
  lineup: LineupItem;
  gsmarena: { name: string; path: string } | null;
  alternatives: { name: string; path: string }[];
  /** Baris dengan kolom yang sama seperti CSV dataset GSMArena. */
  specRow: SpecRow | null;
  summary: {
    brand: string;
    model: string;
    slug: string;
    releaseYear: number | null;
    network: string;
    chipset: string | null;
    displayInches: number | null;
    batteryMah: number | null;
    variants: { ramGb: number; storageGb: number }[];
  } | null;
  /** Harga resmi per varian, beserta apakah variannya tercatat di spesifikasi. */
  prices: (OfficialVariantPrice & { variantKnown: boolean })[];
  catalog: { status: "new" | "draft" | "published"; slug: string | null };
  issues: PreviewIssue[];
};

export type ResolveResult =
  | { ok: true; item: PreviewItem }
  | { ok: false; error: string; blocked: boolean };

export type CommitSummary = {
  error: string | null;
  /** Batch pratinjau di Pusat Impor yang dibuat dari hasil tarik otomatis. */
  batchId?: string;
  specs: {
    totalRows: number;
    created: number;
    updated: number;
    imagesCreated: number;
    imagesUpdated: number;
    skipped: { label: string; reason: string }[];
    imageSkipped: { label: string; reason: string }[];
  } | null;
  prices: {
    totalRows: number;
    created: number;
    updated: number;
    pricesRecorded: number;
    duplicatePrices: number;
    skipped: { label: string; reason: string }[];
  } | null;
};
