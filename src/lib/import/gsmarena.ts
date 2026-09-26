import type { CsvRow } from "@/lib/import/csv-parser";
import { canonicalBrandModel, toSlug } from "@/lib/catalog/brands";
import type { ProductSpecs } from "@/lib/catalog/schema";
import {
  readProductImage,
  type ProductImageCandidate,
} from "@/lib/import/product-images";

/**
 * Penerjemah baris CSV GSMArena menjadi produk CekHarga (PRD §6 dan §10).
 *
 * Empat masalah nyata pada data sumber yang ditangani di sini, semuanya
 * ditemukan saat memeriksa berkas contoh:
 *
 * 1. Encoding rusak. Teksnya pernah didekode dua kali, sehingga simbol derajat
 *    muncul sebagai "Ë", mikrometer sebagai "Âµm", dan mata uang sebagai "â¬".
 *    Kalau tidak dibersihkan, karakter rusak itu akan tampil ke pengunjung.
 *
 * 2. Angka bercampur teks. Bobot ditulis "224 g (7.90 oz)", pengisian ditulis
 *    "80W wired, 40W/80W UFCS, 55W PPS". Yang diambil angka pertama yang
 *    bermakna, bukan angka mana pun yang kebetulan ada.
 *
 * 3. Varian tergabung dalam satu sel. "128GB/8GB; 256GB/12GB" harus dipecah
 *    menjadi baris varian tersendiri. Dipakai kolom ringkasan karena
 *    formatnya konsisten; kolom mentahnya hanya jadi cadangan.
 *
 * 4. HARGA TIDAK PERNAH DIIMPOR. Kolom harga di sumber ini berisi harga
 *    referensi internasional yang bercampur mata uang, termasuk Rupee India
 *    yang simbolnya gampang tertukar dengan Rupiah. PRD §7 mengharuskan harga
 *    berasal dari penawaran marketplace Indonesia yang tercatat beserta waktu
 *    pemeriksaannya. Mengimpor angka itu sebagai harga akan menyesatkan.
 */

/** Perbaikan mojibake: UTF-8 yang terlanjur dibaca sebagai Latin-1. */
const MOJIBAKE: [RegExp, string][] = [
  [/Â°/g, "°"],
  [/Ë/g, "°"],
  [/Âµ/g, "µ"],
  [/Â·/g, "·"],
  [/â€™/g, "'"],
  [/â€œ|â€/g, '"'],
  [/â€“/g, "-"],
  [/â€”/g, "-"],
  [/â‚¬|â¬/g, "€"],
  [/â‚¹|â¹/g, "₹"],
  [/Â£/g, "£"],
  [/Â/g, ""],
];

export function fixEncoding(value: string): string {
  return MOJIBAKE.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
    .replace(/\s+/g, " ")
    .trim();
}

/** Angka pertama dalam teks campuran, mis. "224 g (7.90 oz)" -> 224. */
function firstNumber(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstInt(value: string): number | null {
  const n = firstNumber(value);
  return n === null ? null : Math.round(n);
}

/** Watt tertinggi dari daftar pengisian, karena itu yang dijanjikan produsen. */
function chargingWatt(value: string): number | null {
  const matches = [...value.matchAll(/(\d+(?:\.\d+)?)\s*W/gi)].map((m) => Number(m[1]));
  const valid = matches.filter((n) => Number.isFinite(n) && n > 0);
  return valid.length ? Math.round(Math.max(...valid)) : null;
}

/** Nama teknologi layar saja, tanpa embel-embel refresh rate dan nits. */
function displayTechnology(value: string): string | null {
  const head = fixEncoding(value).split(",")[0]?.trim();
  return head && head.length > 0 ? head : null;
}

const LENS_COUNT: Record<string, number> = {
  single: 1,
  dual: 2,
  triple: 3,
  quad: 4,
};

/** Zoom optik dari teks kamera, mis. "3.5x optical zoom". */
function opticalZoom(camera: string): number | null {
  const match = camera.match(/(\d+(?:\.\d+)?)\s*x\s*optical\s*zoom/i);
  return match ? Number(match[1]) : null;
}

/**
 * "Yes (market/region dependent)" diperlakukan sebagai TIDAK DIKETAHUI, bukan
 * ya. Bagi pembeli di Indonesia, "tergantung pasar" tidak menjawab apa pun, dan
 * menjawab "ya" berarti menjanjikan sesuatu yang belum tentu ada di unit yang
 * mereka beli.
 */
function yesNo(value: string): boolean | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (text.includes("dependent") || text.includes("market")) return null;
  if (text.startsWith("yes")) return true;
  if (text.startsWith("no")) return false;
  return null;
}

/** Memecah "128GB/8GB; 256GB/12GB" menjadi pasangan RAM dan penyimpanan. */
export function parseVariants(
  summary: string,
  fallbackRaw: string
): { ramGb: number; storageGb: number }[] {
  const source = summary.trim().length > 0 ? summary : fallbackRaw;
  const chunks = source.split(/[;,]/).map((s) => s.trim()).filter(Boolean);

  const seen = new Set<string>();
  const variants: { ramGb: number; storageGb: number }[] = [];

  for (const chunk of chunks) {
    // Format ringkasan: "256GB/12GB" (penyimpanan dulu, lalu RAM).
    let match = chunk.match(/(\d+)\s*(GB|TB)\s*\/\s*(\d+)\s*GB/i);
    let storageGb: number | null = null;
    let ramGb: number | null = null;

    if (match) {
      storageGb = Number(match[1]) * (match[2]!.toUpperCase() === "TB" ? 1024 : 1);
      ramGb = Number(match[3]);
    } else {
      // Format mentah: "256GB 12GB RAM".
      match = chunk.match(/(\d+)\s*(GB|TB)\s+(\d+)\s*GB\s*RAM/i);
      if (match) {
        storageGb = Number(match[1]) * (match[2]!.toUpperCase() === "TB" ? 1024 : 1);
        ramGb = Number(match[3]);
      }
    }

    if (!storageGb || !ramGb) continue;

    const key = `${ramGb}-${storageGb}`;
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push({ ramGb, storageGb });
  }

  return variants;
}

export { stripBrandPrefix, toSlug } from "@/lib/catalog/brands";

export type ImportCandidate = {
  sourceKey: string;
  slug: string;
  brand: string;
  model: string;
  specs: ProductSpecs;
  specsSourceUrl: string | null;
  variants: { ramGb: number; storageGb: number }[];
  image: ProductImageCandidate | null;
  imageIssue: string | null;
};

export type RowOutcome =
  | { ok: true; candidate: ImportCandidate }
  | { ok: false; label: string; reason: string };

const GSMARENA_BASE = "https://www.gsmarena.com/";

export function mapRow(row: CsvRow): RowOutcome {
  const get = (key: string) => fixEncoding(row[key] ?? "");

  // Merek resmi (OPPO, realme) dan sub-merek (iQOO) dikanonkan sebelum slug
  // dan kunci apa pun dibentuk.
  const { brand, model } = canonicalBrandModel(get("brand"), get("model_name"));
  const label = [brand, model].filter(Boolean).join(" ") || "(baris tanpa nama)";

  if (!brand || !model) {
    return { ok: false, label, reason: "Merek atau nama model kosong." };
  }

  // PRD §3 membatasi versi awal pada smartphone. Tablet dan jam tangan
  // dikeluarkan, bukan disimpan diam-diam sebagai draft yang membingungkan.
  const deviceType = get("device_type").toLowerCase();
  if (deviceType && deviceType !== "phone") {
    return { ok: false, label, reason: `Bukan smartphone (${deviceType}), di luar cakupan versi awal.` };
  }

  const variants = parseVariants(get("memory_variants_summary"), get("memory_variants_raw"));
  if (variants.length === 0) {
    return {
      ok: false,
      label,
      reason: "Kombinasi RAM/penyimpanan tidak terbaca, dan varian tidak boleh dikarang.",
    };
  }

  const sourcePath = get("url");
  const specsSourceUrl = sourcePath ? GSMARENA_BASE + sourcePath : null;
  const sourceKey = sourcePath
    ? `gsmarena:${sourcePath.replace(/\.php$/, "")}`
    : `gsmarena:${toSlug(brand, model)}`;

  const camera = get("main_camera_raw");
  const cameraCountWord = get("main_camera_count").toLowerCase();
  const network = get("network_technology");
  const announced = get("announced") || get("status_raw");
  const image = readProductImage(row, { brand, model, specsSourceUrl });

  const specs: ProductSpecs = {
    displayInches: firstNumber(get("display_size_inches")),
    displayTechnology: displayTechnology(get("display_type_raw")),
    refreshRateHz: firstInt(get("refresh_rate_hz")),
    chipset: get("chipset") || null,
    batteryMah: firstInt(get("battery_capacity_mah")),
    chargingWatt: chargingWatt(get("charging")),
    mainCameraMp: firstInt(camera),
    cameraLensCount: LENS_COUNT[cameraCountWord] ?? null,
    cameraHasUltrawide: camera ? /ultrawide/i.test(camera) : null,
    cameraHasTelephoto: camera ? /telephoto/i.test(camera) : null,
    cameraOpticalZoomX: opticalZoom(camera),
    weightGrams: firstInt(get("weight_raw")),
    releaseYear: firstInt(announced.match(/\b(20\d{2})\b/)?.[1] ?? ""),
    is5G: network ? /5G/i.test(network) : null,
    hasNfc: yesNo(get("nfc")),
    ipRating: get("ip_rating") || null,
    has35mmJack: yesNo(get("jack_3_5mm")),
    osVersion: get("os") || null,
    colorOptions: (() => {
      const colors = get("colors");
      if (!colors) return null;
      const list = colors.split(",").map((c) => c.trim()).filter(Boolean);
      return list.length > 0 ? list : null;
    })(),
  };

  return {
    ok: true,
    candidate: {
      sourceKey,
      slug: toSlug(brand, model),
      brand,
      model,
      specs,
      specsSourceUrl,
      variants,
      image: image.candidate,
      imageIssue: image.issue,
    },
  };
}
