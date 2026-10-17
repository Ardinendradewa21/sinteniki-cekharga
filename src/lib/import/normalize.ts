/**
 * Koreksi otomatis untuk templat terpadu (langkah 3 rancangan impor terpadu).
 *
 * Prinsipnya: hanya koreksi yang HASILNYA PASTI yang dilakukan otomatis, dan
 * setiap koreksi dicatat supaya admin bisa memeriksanya di pratinjau. Nilai
 * yang tidak bisa dipastikan tidak ditebak; nilainya diteruskan apa adanya dan
 * adaptor menolaknya dengan alasan (PRD: yang tidak pasti tidak dinilai,
 * varian tidak boleh dikarang).
 *
 * Modul murni, tanpa jaringan dan database.
 */

export type CorrectionLevel = "info" | "warning" | "error";

export type Correction = {
  /** Nomor baris di berkas, mulai 2 (baris 1 adalah header). */
  line: number;
  column: string;
  from: string;
  to: string;
  note: string;
  level: CorrectionLevel;
};

/* ---------------------------------------------------------- alias header */

/**
 * Nama kolom templat terpadu dan nama lain yang diterima. Nama dibandingkan
 * setelah dinormalkan (huruf kecil; spasi, garis bawah, dan tanda hubung
 * disamakan), jadi "Harga", "harga_idr", dan "HARGA-IDR" sama.
 */
const HEADER_ALIASES: Record<string, readonly string[]> = {
  brand: ["merek", "merk"],
  model_name: ["model", "nama model", "tipe"],
  slug: [],
  gsmarena_url: ["url gsmarena", "spec url", "sumber spesifikasi"],
  variant: ["varian", "memori"],
  ram_gb: ["ram"],
  storage_gb: ["storage", "penyimpanan", "rom", "internal"],
  marketplace: ["platform", "toko online"],
  seller_name: ["penjual", "toko", "nama toko"],
  // "listing_url" sengaja tidak dijadikan alias: itu kolom hasil scraper
  // Shopee, dan berkas Shopee harus tetap dikenali sebagai format Shopee.
  offer_url: ["link", "tautan", "url listing", "link produk"],
  warranty: ["garansi"],
  listing_status: ["status", "status listing", "stok"],
  seller_verified: ["terverifikasi", "verified"],
  price_idr: ["harga", "price", "harga idr"],
  observed_at: ["diperiksa", "waktu cek", "tanggal cek", "scraped at"],
  display_size_inches: ["ukuran layar", "layar inci"],
  display_type_raw: ["jenis layar", "panel layar"],
  refresh_rate_hz: ["refresh rate"],
  chipset: ["prosesor"],
  battery_capacity_mah: ["baterai", "baterai mah"],
  charging: ["pengisian", "charger"],
  main_camera_raw: ["kamera utama"],
  main_camera_count: ["jumlah kamera"],
  weight_raw: ["bobot", "berat"],
  network_technology: ["jaringan"],
  announced: ["rilis", "tanggal rilis"],
  os: ["sistem operasi"],
  // "Warna" di satu baris berarti warna listing/foto baris itu, bukan daftar
  // semua warna produk (kolom spesifikasi `colors`).
  colors: ["daftar warna", "pilihan warna"],
  color: ["warna", "warna listing", "varian warna"],
  image_url: ["url image", "url gambar", "link gambar", "gambar", "url foto", "link foto", "foto"],
  image_usage_basis: ["dasar hak pakai", "dasar hak pakai foto"],
  image_usage_rights: ["hak pakai foto", "bukti hak pakai"],
  // Kolom foto CSV gabungan (Sprint 8): urutan dalam warna, sampul, halaman asal.
  urutan: ["urutan foto", "sort order"],
  is_cover: ["sampul", "cover", "foto sampul"],
  image_source_url: ["source_url", "sumber foto", "halaman foto"],
};

function normalizeHeaderName(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

const ALIAS_TO_CANONICAL = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
  ALIAS_TO_CANONICAL.set(normalizeHeaderName(canonical), canonical);
  for (const alias of aliases) ALIAS_TO_CANONICAL.set(normalizeHeaderName(alias), canonical);
}

/** Nama kolom kanonik untuk satu header; header tak dikenal dikembalikan dalam bentuk snake_case. */
export function canonicalHeader(header: string): string {
  const normalized = normalizeHeaderName(header);
  return ALIAS_TO_CANONICAL.get(normalized) ?? normalized.replace(/ /g, "_");
}

/* ------------------------------------------------------------ nilai sel */

export type Normalized = { value: string; note: string | null };

const unchanged = (value: string): Normalized => ({ value, note: null });

/** "8", "8GB", "8 gb" -> "8"; "1TB" -> "1024". Selain itu dibiarkan (adaptor yang menolak). */
export function normalizeMemoryGb(raw: string): Normalized {
  const value = raw.trim();
  const match = value.match(/^(\d{1,4})\s*(gb|tb)?$/i);
  if (!match) return unchanged(value);
  const gb = match[2]?.toLowerCase() === "tb" ? Number(match[1]) * 1024 : Number(match[1]);
  const text = String(gb);
  return text === value ? unchanged(value) : { value: text, note: "Satuan memori dibaca sebagai GB." };
}

/** "8/256", "8GB/256GB", "8+256", "12/1TB" -> RAM dan penyimpanan dalam GB. */
export function parseVariantPair(raw: string): { ramGb: number; storageGb: number } | null {
  const match = raw.trim().match(/^(\d{1,2})\s*(?:gb)?\s*[/+]\s*(\d{1,4})\s*(gb|tb)?$/i);
  if (!match) return null;
  const storage = match[3]?.toLowerCase() === "tb" ? Number(match[2]) * 1024 : Number(match[2]);
  return { ramGb: Number(match[1]), storageGb: storage };
}

/**
 * Harga Rupiah ke bilangan bulat tanpa pemisah:
 * "Rp 7.999.000" / "7.999.000,00" / "7,999,000" / "7.5 jt" / "7,5 juta".
 * Bentuk lain dibiarkan supaya adaptor menolaknya; harga tidak pernah ditebak.
 */
export function normalizePriceIdr(raw: string): Normalized {
  const value = raw.trim();
  if (!value) return unchanged(value);
  const text = value.replace(/^rp\.?\s*/i, "").replace(/\s+/g, " ").trim();

  const million = text.match(/^(\d{1,3})(?:[.,](\d{1,3}))?\s*(jt|juta)$/i);
  if (million) {
    const fraction = (million[2] ?? "").padEnd(6, "0").slice(0, 6);
    const idr = Number(million[1]) * 1_000_000 + Number(fraction || "0");
    return { value: String(idr), note: "Singkatan juta diubah menjadi angka Rupiah." };
  }
  // Titik sebagai pemisah ribuan, koma desimal nol opsional (format Indonesia).
  if (/^\d{1,3}(?:\.\d{3})+(?:,0{1,2})?$/.test(text)) {
    return { value: text.replace(/,0{1,2}$/, "").replace(/\./g, ""), note: "Pemisah ribuan dan awalan Rp dihapus." };
  }
  // Koma sebagai pemisah ribuan (format spreadsheet berbahasa Inggris).
  if (/^\d{1,3}(?:,\d{3})+$/.test(text)) {
    return { value: text.replace(/,/g, ""), note: "Pemisah ribuan dihapus." };
  }
  if (/^\d+$/.test(text)) {
    return text === value ? unchanged(value) : { value: text, note: "Awalan Rp dihapus." };
  }
  return unchanged(value);
}

const STATUS_ALIASES: Record<string, string> = {
  aktif: "active",
  tersedia: "active",
  ada: "active",
  "stok habis": "out-of-stock",
  habis: "out-of-stock",
  kosong: "out-of-stock",
  "out of stock": "out-of-stock",
  nonaktif: "inactive",
  "tidak aktif": "inactive",
  ambigu: "ambiguous",
};

export function normalizeListingStatus(raw: string): Normalized {
  const value = raw.trim();
  const mapped = STATUS_ALIASES[value.toLowerCase().replace(/[_-]+/g, " ")];
  return mapped && mapped !== value ? { value: mapped, note: "Status listing diterjemahkan." } : unchanged(value);
}

const YES = new Set(["ya", "yes", "y", "true", "1", "benar", "✓", "v"]);
const NO = new Set(["tidak", "no", "n", "false", "0", "bukan", "salah", "x"]);

export function normalizeYesNo(raw: string): Normalized {
  const value = raw.trim();
  const lower = value.toLowerCase();
  if (YES.has(lower)) return lower === "ya" ? unchanged(value) : { value: "ya", note: "Dibaca sebagai ya." };
  if (NO.has(lower)) return lower === "tidak" ? unchanged(value) : { value: "tidak", note: "Dibaca sebagai tidak." };
  return unchanged(value);
}

const pad = (n: string) => n.padStart(2, "0");

/**
 * Waktu pengamatan ke ISO 8601 dengan zona eksplisit (`+07:00`, bentuk yang
 * diterima `z.iso.datetime({ offset: true })`). Waktu tanpa zona diasumsikan
 * WIB, dan asumsi itu dicatat. Tanggal tanpa jam memakai 00.00 WIB, pilihan
 * yang membuat harga terlihat LEBIH tua, bukan lebih segar.
 */
export function normalizeObservedAt(raw: string): Normalized {
  const value = raw.trim();
  if (!value) return unchanged(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return unchanged(value);

  // 2026-10-10 14:30[:00] atau 2026-10-10T14:30 (tanpa zona)
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?$/);
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    return withWib(`${y}-${pad(mo!)}-${pad(d!)}`, h, mi, s, value);
  }
  // 10/10/2026 14.30 atau 10-10-2026 (urutan hari/bulan/tahun, kebiasaan Indonesia)
  match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T,]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?$/);
  if (match) {
    const [, d, mo, y, h, mi, s] = match;
    return withWib(`${y}-${pad(mo!)}-${pad(d!)}`, h, mi, s, value);
  }
  return unchanged(value);
}

function withWib(date: string, h: string | undefined, mi: string | undefined, s: string | undefined, original: string): Normalized {
  const [y, mo, d] = date.split("-").map(Number);
  const probe = new Date(Date.UTC(y!, mo! - 1, d!));
  // Tanggal mustahil (mis. 31/02) tidak dikoreksi; adaptor yang menolaknya.
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo! - 1 || probe.getUTCDate() !== d) {
    return unchanged(original);
  }
  const time = h === undefined ? "00:00:00" : `${pad(h)}:${mi}:${s ?? "00"}`;
  return {
    value: `${date}T${time}+07:00`,
    note: h === undefined ? "Jam tidak diisi; diasumsikan 00.00 WIB." : "Zona waktu tidak ditulis; diasumsikan WIB.",
  };
}

/** "https://www.gsmarena.com/oppo_x-123.php" -> "oppo_x-123.php" (bentuk yang dibaca adaptor spesifikasi). */
export function normalizeGsmarenaPath(raw: string): Normalized {
  const value = raw.trim();
  const match = value.match(/^https?:\/\/(?:www\.|m\.)?gsmarena\.com\/([a-z0-9_()]+-\d+\.php)(?:[?#].*)?$/i);
  return match ? { value: match[1]!, note: "Alamat GSMArena dipendekkan menjadi nama halamannya." } : unchanged(value);
}
