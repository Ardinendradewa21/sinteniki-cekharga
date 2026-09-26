import { z } from "zod";

/**
 * Kontrak query katalog (PRD FR-02).
 *
 * Dua aturan yang membentuk file ini:
 *
 * 1. "Pilihan filter tercermin pada URL agar dapat dibagikan dan dipulihkan
 *    saat reload." Jadi URL adalah satu-satunya sumber kebenaran state filter;
 *    tidak ada state filter yang hidup hanya di memori komponen.
 *
 * 2. URL datang dari luar dan bisa apa saja. Karena itu setiap field memakai
 *    `.catch()`: parameter yang rusak (`?ram=abc`, `?sort=termurah-banget`)
 *    jatuh ke nilai aman, bukan melempar error dan membuat halaman katalog
 *    gagal dirender.
 *
 * PRD FR-02 juga meminta "Gunakan contract existing untuk nama parameter/wire
 * value; jangan membuat alias baru tanpa kebutuhan". Nama parameter di bawah
 * adalah kontraknya; kalau berubah, tautan lama yang dibagikan orang akan
 * kehilangan filternya.
 */

/** Urutan minimum yang diwajibkan PRD FR-02. */
export const SORT_OPTIONS = [
  "relevance",
  "price-asc",
  "price-desc",
  "checked",
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  // "Relevansi pencarian bukan skor kualitas produk" (PRD FR-02), jadi labelnya
  // menyebut pencarian, bukan "terbaik" atau "rekomendasi".
  relevance: "Relevansi pencarian",
  "price-asc": "Harga terendah",
  "price-desc": "Harga tertinggi",
  checked: "Terakhir diperiksa",
};

/** Nama parameter URL. Satu tempat, supaya form dan parser tidak berbeda. */
export const PARAM = {
  query: "q",
  /**
   * Parameter lama dari masa dua search bar. Tidak lagi ditulis, tetapi tetap
   * dibaca dan digabung ke `q` supaya tautan lama yang sudah dibagikan tetap
   * membawa pencariannya.
   */
  legacyNeeds: "kebutuhan",
  brand: "merek",
  ram: "ram",
  storage: "penyimpanan",
  minPrice: "harga_min",
  maxPrice: "harga_max",
  sort: "urut",
  page: "hal",
} as const;

/** Bentuk mentah dari Next.js: satu nilai, banyak nilai, atau tidak ada. */
type RawSearchParams = Record<string, string | string[] | undefined>;

function toList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const optionalPositiveInt = z.preprocess(
  // Form GET mengirim input kosong sebagai "". Number("") = 0, tetapi harga
  // yang tidak diisi berarti tanpa batas, bukan batas Rp0.
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.coerce.number().int().nonnegative().nullable().catch(null)
);

const intList = z
  .array(z.coerce.number().int().positive().catch(0))
  // 0 = nilai yang tidak bisa dibaca; buang, jangan diperlakukan sebagai filter.
  .transform((values) => [...new Set(values.filter((value) => value > 0))])
  .catch([]);

const catalogQuerySchema = z.object({
  /** Satu kolom pencarian: nama, merek, spesifikasi, dan kalimat kebutuhan. */
  query: z.string().trim().max(160).catch(""),
  brands: z
    .array(z.string().trim().min(1).catch(""))
    .transform((values) => [...new Set(values.filter(Boolean))])
    .catch([]),
  ram: intList,
  storage: intList,
  minPrice: optionalPositiveInt,
  maxPrice: optionalPositiveInt,
  sort: z.enum(SORT_OPTIONS).catch("relevance"),
  /** Nomor halaman hasil, mulai 1. Nilai rusak jatuh ke halaman pertama. */
  page: z.coerce.number().int().positive().max(10_000).catch(1),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export function parseCatalogQuery(raw: RawSearchParams): CatalogQuery {
  const parsed = catalogQuerySchema.parse({
    query: [toList(raw[PARAM.query])[0], toList(raw[PARAM.legacyNeeds])[0]]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, 160),
    brands: toList(raw[PARAM.brand]),
    ram: toList(raw[PARAM.ram]),
    storage: toList(raw[PARAM.storage]),
    minPrice: toList(raw[PARAM.minPrice])[0],
    maxPrice: toList(raw[PARAM.maxPrice])[0],
    sort: toList(raw[PARAM.sort])[0],
    page: toList(raw[PARAM.page])[0] ?? 1,
  });

  // Rentang terbalik (min > max) tidak akan pernah cocok apa pun dan menghasilkan
  // hasil kosong yang membingungkan. Tukar supaya maksudnya tetap terbaca.
  if (
    parsed.minPrice !== null &&
    parsed.maxPrice !== null &&
    parsed.minPrice > parsed.maxPrice
  ) {
    return { ...parsed, minPrice: parsed.maxPrice, maxPrice: parsed.minPrice };
  }

  return parsed;
}

/** Apakah ada filter aktif, untuk memutuskan tampilan tombol reset dan pesan. */
export function countActiveFilters(query: CatalogQuery): number {
  return (
    (query.query ? 1 : 0) +
    query.brands.length +
    query.ram.length +
    query.storage.length +
    (query.minPrice !== null ? 1 : 0) +
    (query.maxPrice !== null ? 1 : 0)
  );
}

/** Apakah pengguna sedang membatasi berdasarkan harga (PRD §7 dan FR-02). */
export function hasPriceBound(query: CatalogQuery): boolean {
  return query.minPrice !== null || query.maxPrice !== null;
}

/**
 * Membangun URL katalog dari state filter, dengan sebagian nilai ditimpa.
 *
 * Dipakai untuk saran konkret di hasil kosong ("hapus filter merek"), yang
 * diminta PRD FR-02. Nilai kosong sengaja tidak ditulis ke URL supaya tautan
 * saran tetap bersih dan mudah dibaca.
 */
export function buildCatalogHref(
  query: CatalogQuery,
  overrides: Partial<CatalogQuery> = {}
): string {
  // Mengubah filter apa pun membuat daftar hasilnya berbeda, jadi halaman
  // kembali ke 1 kecuali pemanggil memang meminta halaman tertentu.
  const next = { ...query, page: 1, ...overrides };
  const params = new URLSearchParams();

  if (next.query) params.set(PARAM.query, next.query);
  for (const brand of next.brands) params.append(PARAM.brand, brand);
  for (const ram of next.ram) params.append(PARAM.ram, String(ram));
  for (const storage of next.storage) {
    params.append(PARAM.storage, String(storage));
  }
  if (next.minPrice !== null) params.set(PARAM.minPrice, String(next.minPrice));
  if (next.maxPrice !== null) params.set(PARAM.maxPrice, String(next.maxPrice));
  // Urutan default tidak perlu ditulis; URL-nya jadi lebih pendek.
  if (next.sort !== "relevance") params.set(PARAM.sort, next.sort);
  if (next.page > 1) params.set(PARAM.page, String(next.page));

  const search = params.toString();
  return search ? `/products?${search}` : "/products";
}

/** Query kosong, untuk tombol reset. */
export const EMPTY_CATALOG_QUERY: CatalogQuery = {
  query: "",
  brands: [],
  ram: [],
  storage: [],
  minPrice: null,
  maxPrice: null,
  sort: "relevance",
  page: 1,
};
