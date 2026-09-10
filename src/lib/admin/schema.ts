import { z } from "zod";

/**
 * Validasi masukan form admin (PRD §9 dan §10).
 *
 * Dokumentasi Next.js menegaskan Server Action adalah endpoint POST yang bisa
 * dipanggil siapa saja, jadi `FormData` diperlakukan sebagai masukan tidak
 * tepercaya. Schema di sini adalah gerbangnya, bukan atribut `required` di HTML.
 *
 * Kolom kosong menjadi `null`, BUKAN nol atau string kosong. Ini menjaga aturan
 * inti PRD §6 bahwa null berarti tidak diketahui: admin yang belum tahu bobot
 * sebuah HP harus bisa menyimpan produknya tanpa memaksa mengarang angka.
 */

/** Mengubah field form kosong menjadi null sebelum divalidasi. */
const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalText = z.preprocess(emptyToNull, z.string().trim().min(1).nullable());
const optionalInt = z.preprocess(
  emptyToNull,
  z.coerce.number().int().positive().nullable()
);
const optionalFloat = z.preprocess(
  emptyToNull,
  z.coerce.number().positive().nullable()
);

/**
 * Tri-state untuk pertanyaan ya/tidak yang boleh belum diketahui.
 * "" = belum diketahui, dan itu berbeda maknanya dari "tidak".
 */
const optionalBool = z.preprocess(
  emptyToNull,
  z.enum(["ya", "tidak"]).nullable().transform((v) => (v === null ? null : v === "ya"))
);

/** Daftar dipisah koma, mis. warna. Kosong berarti belum diketahui. */
const optionalList = z.preprocess(
  emptyToNull,
  z
    .string()
    .nullable()
    .transform((v) =>
      v === null
        ? null
        : v
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
    )
);

export const productSpecsInput = z.object({
  displayInches: optionalFloat,
  displayTechnology: optionalText,
  refreshRateHz: optionalInt,
  chipset: optionalText,
  batteryMah: optionalInt,
  chargingWatt: optionalInt,
  mainCameraMp: optionalInt,
  cameraLensCount: optionalInt,
  cameraHasUltrawide: optionalBool,
  cameraHasTelephoto: optionalBool,
  cameraOpticalZoomX: optionalFloat,
  weightGrams: optionalInt,
  releaseYear: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(2000).max(2100).nullable()
  ),
  is5G: optionalBool,
  hasNfc: optionalBool,
  ipRating: optionalText,
  has35mmJack: optionalBool,
  osVersion: optionalText,
  colorOptions: optionalList,
});

export const productInput = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug wajib diisi")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya huruf kecil, angka, dan tanda hubung"),
  brand: z.string().trim().min(1, "Merek wajib diisi"),
  model: z.string().trim().min(1, "Model wajib diisi"),
  specsSource: z.string().trim().min(1, "Sumber spesifikasi wajib diisi"),
  specsSourceUrl: z.preprocess(emptyToNull, z.httpUrl().nullable()),
  sourceKey: optionalText,
  specs: productSpecsInput,
});

export const variantInput = z.object({
  ramGb: z.coerce.number().int().positive("RAM harus lebih dari 0"),
  storageGb: z.coerce.number().int().positive("Penyimpanan harus lebih dari 0"),
  region: optionalText,
});

export const offerInput = z.object({
  variantId: z.uuid("Varian tidak dikenal"),
  marketplace: z.string().trim().min(1, "Marketplace wajib diisi"),
  sellerName: z.string().trim().min(1, "Nama penjual wajib diisi"),
  url: z.httpUrl("URL listing harus http/https"),
  warranty: optionalText,
  listingStatus: z.enum(["active", "out-of-stock", "ambiguous", "inactive"]),
  sellerVerified: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const priceInput = z.object({
  offerId: z.uuid(),
  /**
   * Rupiah bulat. Batas atas ada supaya salah ketik nol berlebih tertangkap di
   * sini, bukan menjadi harga Rp1 miliar yang tampil ke pengunjung.
   */
  priceIdr: z.coerce
    .number()
    .int("Harga harus bilangan bulat Rupiah")
    .nonnegative("Harga tidak boleh negatif")
    .max(500_000_000, "Harga di luar batas wajar, periksa lagi angkanya"),
});

export type ProductInput = z.infer<typeof productInput>;

/** Membaca FormData bernama titik (mis. "specs.chipset") menjadi objek bertingkat. */
export function formToNestedObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    const path = key.split(".");
    let cursor = out;
    for (let i = 0; i < path.length - 1; i += 1) {
      const segment = path[i]!;
      cursor[segment] ??= {};
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[path[path.length - 1]!] = value;
  }
  return out;
}

/**
 * Ringkasan review reviewer (PRD FR-07).
 *
 * Yang dijaga schema ini:
 *
 * - `videoUrl` wajib http/https. Atribusi tanpa tautan yang bisa dibuka bukan
 *   atribusi; pembaca harus bisa memeriksa sendiri klaimnya.
 * - `timestampSeconds` boleh kosong, tapi kalau diisi harus masuk akal. Ini
 *   penunjuk ke menit keberapa klaim itu diucapkan.
 * - Kelebihan dan keterbatasan ditulis satu per baris, lalu dipecah di sini.
 *   Baris kosong dibuang supaya tidak ada butir hampa di halaman publik.
 * - Tidak ada penggabungan atau penyaringan pendapat. FR-07 mensyaratkan
 *   review lintas sumber bisa disimpan TANPA menghapus perbedaan pendapat,
 *   jadi dua reviewer yang bertentangan sama-sama tersimpan apa adanya.
 */
const linesToArray = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value
          // Textarea di browser mengirim CRLF, bukan LF saja.
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      : value,
  z.array(z.string().min(1))
);

export const reviewInput = z.object({
  /** Kosong berarti review berlaku untuk produk, bukan varian tertentu. */
  variantId: z.preprocess(emptyToNull, z.uuid().nullable()),
  channelName: z.string().trim().min(1, "Nama channel wajib diisi"),
  videoUrl: z.httpUrl("URL video harus http/https"),
  /** Input tanggal mengirim "YYYY-MM-DD"; disimpan sebagai waktu penuh. */
  publishedAt: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? new Date(v).toISOString() : v),
    z.iso.datetime("Tanggal publikasi tidak valid")
  ),
  timestampSeconds: z.preprocess(
    emptyToNull,
    z.coerce.number().int().nonnegative().max(86_400, "Timestamp melebihi 24 jam").nullable()
  ),
  aspect: z.string().trim().min(1, "Aspek yang diulas wajib diisi"),
  summary: z.string().trim().min(1, "Ringkasan wajib diisi"),
  strengths: linesToArray,
  limitations: linesToArray,
  testContext: optionalText,
});
