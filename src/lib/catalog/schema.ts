import { z } from "zod";

/**
 * Model domain katalog (PRD §6).
 *
 * Aturan yang dikunci di schema ini:
 * - `null` berarti tidak diketahui / tidak tersedia, BUKAN nol (PRD §6).
 * - Harga adalah integer Rupiah non-negatif (PRD §6).
 * - Kombinasi RAM/penyimpanan tidak boleh dikarang; varian hanya yang tercatat.
 *
 * Validasi runtime dengan Zod, tipe diturunkan dari schema (PRD §9) supaya
 * data dari sumber mana pun (fixture sekarang, API nanti) melewati gerbang
 * yang sama.
 */

export const publicationStatusSchema = z.enum(["draft", "published"]);
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;

/** Asal informasi, supaya kesalahan bisa ditelusuri (PRD §10). */
export const provenanceSchema = z.object({
  /** Nama sumber, mis. "GSMArena" atau "Fixture demo". */
  source: z.string().min(1),
  /** URL sumber bila ada dan boleh ditampilkan. */
  url: z.url().nullable(),
  /** Kapan data diambil dari sumber. */
  retrievedAt: z.iso.datetime(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

export const priceIdrSchema = z
  .int()
  .nonnegative()
  .describe("Harga dalam Rupiah, integer non-negatif");

/**
 * Spesifikasi terstruktur. `null` = tidak diketahui, jangan diisi tebakan.
 *
 * Set field di sini adalah hasil pemetaan sadar dari sumber data spesifikasi
 * mentah (mis. hasil scrape GSMArena), BUKAN salinan seluruh kolom yang
 * tersedia di sumbernya. Field yang dikecualikan secara sengaja:
 *
 * - Skor benchmark mentah (AnTuTu/Geekbench/3DMark): angka tanpa tabel
 *   pembanding tidak bermakna bagi kebanyakan pembeli, dan datanya tidak
 *   selalu tersedia. Ditunda ke iterasi berikutnya, bukan dibuang selamanya.
 * - Nilai SAR dan label regulasi Uni Eropa (kelas energi, uji jatuh,
 *   reparabilitas): itu kewajiban pelabelan pasar Eropa yang tidak berlaku di
 *   Indonesia, dan menampilkannya tanpa konteks berpotensi menyesatkan atau
 *   menakuti tanpa alasan.
 * - Harga dari sumber spesifikasi: sumber semacam itu memuat harga referensi
 *   internasional (kadang bercampur mata uang, termasuk Rupee India yang
 *   gampang tertukar simbolnya dengan Rupiah), bukan listing marketplace
 *   Indonesia yang terikat varian dan waktu pemeriksaan (PRD §7). Harga TETAP
 *   hanya berasal dari `offerSchema`/`priceObservationSchema`, tidak pernah
 *   dari data spesifikasi.
 */
export const productSpecsSchema = z.object({
  displayInches: z.number().positive().nullable(),
  displayTechnology: z.string().nullable(),
  refreshRateHz: z.int().positive().nullable(),
  chipset: z.string().nullable(),
  batteryMah: z.int().positive().nullable(),
  chargingWatt: z.int().positive().nullable(),
  mainCameraMp: z.int().positive().nullable(),
  /** Jumlah lensa kamera belakang (mis. 3 untuk wide + telefoto + ultrawide). */
  cameraLensCount: z.int().positive().nullable(),
  cameraHasUltrawide: z.boolean().nullable(),
  cameraHasTelephoto: z.boolean().nullable(),
  /** Faktor zoom optik pada lensa telefoto, kalau ada. Bukan zoom digital. */
  cameraOpticalZoomX: z.number().positive().nullable(),
  weightGrams: z.int().positive().nullable(),
  releaseYear: z.int().nullable(),
  is5G: z.boolean().nullable(),
  hasNfc: z.boolean().nullable(),
  /** Mis. "IP68". Ditulis apa adanya dari sumber, tidak dinormalisasi. */
  ipRating: z.string().nullable(),
  has35mmJack: z.boolean().nullable(),
  /** Mis. "Android 16, ColorOS 16". */
  osVersion: z.string().nullable(),
  /** `null` = belum diketahui. Array kosong tidak dipakai untuk arti ini. */
  colorOptions: z.array(z.string().min(1)).nullable(),
});
export type ProductSpecs = z.infer<typeof productSpecsSchema>;

export const variantSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  ramGb: z.int().positive(),
  storageGb: z.int().positive(),
  /** Atribut pembeda lain yang tercatat, mis. "Garansi resmi Indonesia". */
  region: z.string().nullable(),
});
export type Variant = z.infer<typeof variantSchema>;

export const productAssetSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable(),
  /**
   * `generic-illustration` menandai gambar perangkat generik lokal, bukan foto
   * produk asli (PRD §8). Jangan pernah menampilkannya seolah foto model asli.
   */
  kind: z.enum(["photo", "generic-illustration"]),
  src: z.string().min(1),
  alt: z.string().min(1),
  provenance: provenanceSchema,
  /** Hak penggunaan aset harus jelas sebelum dipakai (PRD §6). */
  usageRights: z.string().min(1),
});
export type ProductAsset = z.infer<typeof productAssetSchema>;

export const productSchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug harus kebab-case"),
  brand: z.string().min(1),
  model: z.string().min(1),
  specs: productSpecsSchema,
  specsProvenance: provenanceSchema,
  status: publicationStatusSchema,
});
export type Product = z.infer<typeof productSchema>;

export const reviewSummarySchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable(),
  channelName: z.string().min(1),
  videoUrl: z.url(),
  publishedAt: z.iso.datetime(),
  /** Detik ke titik relevan di video, supaya klaim bisa diperiksa. */
  timestampSeconds: z.int().nonnegative().nullable(),
  aspect: z.string().min(1),
  summary: z.string().min(1),
  strengths: z.array(z.string().min(1)),
  limitations: z.array(z.string().min(1)),
  /** Konteks pengujian reviewer, mis. "pemakaian 1 minggu, jaringan 4G". */
  testContext: z.string().nullable(),
  status: publicationStatusSchema,
});
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;

export const offerSchema = z.object({
  id: z.string().min(1),
  variantId: z.string().min(1),
  marketplace: z.string().min(1),
  sellerName: z.string().min(1),
  url: z.httpUrl(),
  /** Versi awal hanya kondisi baru (PRD §3). */
  condition: z.literal("new"),
  /** `null` = jenis garansi belum diketahui, bukan berarti tanpa garansi. */
  warranty: z.string().nullable(),
  listingStatus: z.enum(["active", "out-of-stock", "ambiguous", "inactive"]),
  /**
   * Badge resmi/terverifikasi hanya boleh tampil dengan bukti verifikasi
   * (PRD FR-05). Default false.
   */
  sellerVerified: z.boolean(),
});
export type Offer = z.infer<typeof offerSchema>;

export const priceObservationSchema = z.object({
  id: z.string().min(1),
  offerId: z.string().min(1),
  priceIdr: priceIdrSchema,
  /** Waktu pengamatan yang BERHASIL (PRD §7 butir 6). */
  observedAt: z.iso.datetime(),
  origin: z.enum(["manual", "automatic"]),
});
export type PriceObservation = z.infer<typeof priceObservationSchema>;

export const priceCheckSchema = z.object({
  id: z.string().min(1),
  offerId: z.string().min(1),
  attemptedAt: z.iso.datetime(),
  outcome: z.enum(["success", "failure"]),
  /** Ringkasan error yang aman ditampilkan, tanpa detail internal. */
  errorSummary: z.string().nullable(),
});
export type PriceCheck = z.infer<typeof priceCheckSchema>;

/** Bentuk lengkap dataset katalog, dipakai adapter mana pun. */
export const catalogDatasetSchema = z.object({
  products: z.array(productSchema),
  variants: z.array(variantSchema),
  assets: z.array(productAssetSchema),
  reviews: z.array(reviewSummarySchema),
  offers: z.array(offerSchema),
  priceObservations: z.array(priceObservationSchema),
  priceChecks: z.array(priceCheckSchema),
});
export type CatalogDataset = z.infer<typeof catalogDatasetSchema>;
