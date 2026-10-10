import type { ProductSpecs } from "@/lib/catalog/schema";

/**
 * Aturan patch impor (langkah 1 rancangan impor terpadu, 2026-10-10).
 *
 * Sebelumnya impor ulang MENGGANTI seluruh `specs`, sehingga sel CSV yang
 * kosong menghapus nilai lama di database. Contoh nyata: NFC yang diisi admin
 * dari situs resmi (SOP impor §7) hilang lagi saat dataset GSMArena diimpor
 * ulang dengan kolom NFC kosong. Aturannya sekarang:
 *
 * - Sel kosong, atau nilai yang tidak terbaca (mis. NFC "market dependent"),
 *   berarti "tidak diubah": nilai lama tetap.
 * - Sel berisi tanda `-` berarti "kosongkan": nilainya disetel null
 *   (tidak diketahui), bukan dihapus dari objek.
 * - Harga kosong tetap berarti "belum ada harga", bukan nol (PRD §7).
 *
 * Penggabungan di database memakai `specs || patch` (jsonb, objek kanan
 * menang per key tingkat atas), dan pratinjau memakai `mergeSpecs` yang sama
 * maknanya, jadi yang tampil di pratinjau adalah yang nanti ditulis.
 */

export const CLEAR_TOKEN = "-";

/** Kolom CSV sumber untuk setiap kunci spesifikasi; `-` di salah satunya mengosongkan kunci itu. */
export const SPEC_SOURCE_COLUMNS: Record<keyof ProductSpecs, readonly string[]> = {
  displayInches: ["display_size_inches"],
  displayTechnology: ["display_type_raw"],
  refreshRateHz: ["refresh_rate_hz"],
  chipset: ["chipset"],
  batteryMah: ["battery_capacity_mah"],
  chargingWatt: ["charging"],
  mainCameraMp: ["main_camera_raw"],
  cameraLensCount: ["main_camera_count"],
  cameraHasUltrawide: ["main_camera_raw"],
  cameraHasTelephoto: ["main_camera_raw"],
  cameraOpticalZoomX: ["main_camera_raw"],
  weightGrams: ["weight_raw"],
  releaseYear: ["announced"],
  is5G: ["network_technology"],
  hasNfc: ["nfc"],
  ipRating: ["ip_rating"],
  has35mmJack: ["jack_3_5mm"],
  osVersion: ["os"],
  colorOptions: ["colors"],
};

export function clearedSpecKeys(clearedColumns: ReadonlySet<string>): (keyof ProductSpecs)[] {
  return (Object.keys(SPEC_SOURCE_COLUMNS) as (keyof ProductSpecs)[]).filter((key) =>
    SPEC_SOURCE_COLUMNS[key].some((column) => clearedColumns.has(column))
  );
}

/** Nilai yang terbaca, ditambah kunci yang sengaja dikosongkan (null). */
export function specsPatch(
  specs: ProductSpecs,
  cleared: readonly (keyof ProductSpecs)[]
): Partial<ProductSpecs> {
  const patch: Partial<Record<keyof ProductSpecs, unknown>> = {};
  for (const [key, value] of Object.entries(specs) as [keyof ProductSpecs, unknown][]) {
    if (value !== null && value !== undefined) patch[key] = value;
  }
  for (const key of cleared) patch[key] = null;
  return patch as Partial<ProductSpecs>;
}

/** Padanan `specs || patch` di database, untuk pratinjau. */
export function mergeSpecs(
  existing: Partial<ProductSpecs> | null | undefined,
  patch: Partial<ProductSpecs>
): Partial<ProductSpecs> {
  return { ...(existing ?? {}), ...patch };
}

/**
 * Kolom penawaran yang bisa disunting admin. Bila sel CSV-nya kosong (atau
 * format sumbernya memang tidak membawa kolom itu, mis. hasil scraper),
 * penawaran yang SUDAH ADA mempertahankan nilainya. Penawaran baru memakai
 * nilai bawaan (garansi kosong, status aktif, tidak terverifikasi).
 */
export const OFFER_KEEPABLE_FIELDS = ["warranty", "listing_status", "seller_verified"] as const;
export type OfferKeepableField = (typeof OFFER_KEEPABLE_FIELDS)[number];

export function applyKeepExisting<T extends Partial<Record<OfferKeepableField, unknown>>>(
  payload: T,
  existing: Record<string, unknown>,
  keep: readonly OfferKeepableField[]
): T {
  const result: Record<string, unknown> = { ...payload };
  for (const field of keep) result[field] = existing[field] ?? null;
  return result as T;
}
