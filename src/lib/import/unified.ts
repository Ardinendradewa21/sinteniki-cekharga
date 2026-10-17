import { canonicalBrandModel, toSlug } from "@/lib/catalog/brands";
import type { CsvRow } from "@/lib/import/csv-parser";
import {
  canonicalHeader,
  normalizeGsmarenaPath,
  normalizeListingStatus,
  normalizeMemoryGb,
  normalizeObservedAt,
  normalizePriceIdr,
  normalizeYesNo,
  parseVariantPair,
  type Correction,
  type Normalized,
} from "@/lib/import/normalize";

/**
 * CSV gabungan: spesifikasi, penawaran, dan foto dalam SATU berkas (templat
 * terpadu 2026-10-10, foto digabung Sprint 8 2026-10-17).
 *
 * Setiap baris dibaca menurut kelompok kolom yang terisi, dan satu baris boleh
 * membawa lebih dari satu jenis:
 *   - kolom spesifikasi (atau gsmarena_url) terisi -> baris membawa produk;
 *   - kolom penawaran (offer_url, harga, toko) terisi -> baris membawa penawaran;
 *   - image_url terisi -> baris membawa satu foto (warna, urutan, sampul).
 *
 * Semua foto lewat satu jalur, yaitu aturan galeri (batas per warna, satu
 * sampul per warna, deteksi foto yang sama). Foto yang sama di beberapa baris
 * (mis. diulang per varian) dihitung sekali. Admin bisa memilih bagian yang
 * diimpor (`parts`); kolom bagian yang tidak dipilih diabaikan sejak awal.
 *
 * Baris produk yang sama digabung: varian dikumpulkan, dan spesifikasi cukup
 * diisi di salah satu baris. Bila dua baris memberi nilai berbeda untuk kolom
 * yang sama, nilai baris pertama dipakai dan konfliknya dicatat, tidak
 * ditebak mana yang benar.
 *
 * Hasilnya baris dalam format yang sudah dipahami mesin impor: baris
 * spesifikasi (dibaca `mapRow`) dan baris templat penawaran. Penawaran milik
 * produk di berkas ini membawa `source_key` dan diterapkan SETELAH produknya
 * tersimpan, lewat batch harga lanjutan.
 *
 * Modul murni, tanpa jaringan dan database.
 */

/** Kolom templat terpadu, urut per kelompok. Dipakai templat unduhan dan dokumentasi. */
export const UNIFIED_COLUMNS = [
  // identitas
  "brand",
  "model_name",
  "slug",
  "gsmarena_url",
  "ram_gb",
  "storage_gb",
  // spesifikasi (opsional; cukup di satu baris per produk)
  "announced",
  "network_technology",
  "display_size_inches",
  "display_type_raw",
  "refresh_rate_hz",
  "chipset",
  "battery_capacity_mah",
  "charging",
  "main_camera_count",
  "main_camera_raw",
  "weight_raw",
  "nfc",
  "ip_rating",
  "jack_3_5mm",
  "os",
  "colors",
  // warna dan foto (opsional; foto dari host yang diizinkan dan wajib dasar hak pakai)
  "color",
  "image_url",
  "urutan",
  "is_cover",
  "image_source_url",
  "image_usage_basis",
  "image_usage_rights",
  // penawaran (opsional)
  "marketplace",
  "seller_name",
  "offer_url",
  "price_idr",
  "observed_at",
  "warranty",
  "listing_status",
  "seller_verified",
] as const;

/** Kolom yang menandai baris membawa data produk. */
const SPEC_DATA_COLUMNS = [
  "announced",
  "network_technology",
  "display_size_inches",
  "display_type_raw",
  "refresh_rate_hz",
  "chipset",
  "battery_capacity_mah",
  "charging",
  "main_camera_count",
  "main_camera_raw",
  "weight_raw",
  "nfc",
  "ip_rating",
  "jack_3_5mm",
  "os",
  "status_raw",
] as const;

/**
 * Kolom produk yang diteruskan ke adaptor spesifikasi tanpa memicu "baris
 * produk". `colors` (daftar warna) termasuk di sini: berkas harga sering
 * mengisinya di setiap baris, dan itu tidak boleh membuat produk lama
 * dianggap produk baru (2026-10-12).
 */
const SPEC_PASSTHROUGH_COLUMNS = ["device_type", "colors", "memory_variants_raw"] as const;

const PHOTO_COLUMNS = ["image_url", "urutan", "is_cover", "image_source_url", "image_usage_basis", "image_usage_rights"] as const;

/** Bagian CSV gabungan yang bisa dipilih admin saat mengunggah. */
export const UNIFIED_PARTS = ["specs", "offers", "photos"] as const;
export type UnifiedPart = (typeof UNIFIED_PARTS)[number];

/** Kolom milik tiap bagian; dikosongkan bila bagiannya tidak dipilih. */
const PART_COLUMNS: Record<UnifiedPart, readonly string[]> = {
  specs: [...SPEC_DATA_COLUMNS, "gsmarena_url", "memory_variants_summary"],
  offers: ["offer_url", "price_idr", "marketplace", "seller_name", "observed_at", "warranty", "listing_status", "seller_verified"],
  photos: PHOTO_COLUMNS,
};

/** Host GSMArena: kolom `url` berisi tautan ini dibaca sebagai sumber spesifikasi. */
const GSMARENA_URL = /^(?:https?:\/\/(?:www\.|m\.)?gsmarena\.com\/)?[a-z0-9_]+-\d+\.php$/i;

const OFFER_TRIGGER_COLUMNS = ["offer_url", "price_idr", "marketplace", "seller_name"] as const;

/** Header yang hanya ada di templat terpadu (setelah alias), dipakai pendeteksi berkas. */
export function looksLikeUnifiedHeaders(headers: readonly string[]): boolean {
  const names = new Set(headers.map(canonicalHeader));
  return (
    names.has("offer_url") ||
    names.has("gsmarena_url") ||
    names.has("variant") ||
    (names.has("brand") && names.has("ram_gb") && names.has("storage_gb"))
  );
}

type UnifiedConversion = {
  /** Baris spesifikasi gabungan per produk, format yang dibaca `mapRow`. */
  specRows: CsvRow[];
  /** Penawaran untuk produk di berkas ini: membawa `source_key`, diterapkan setelah produknya. */
  followUpOfferRows: CsvRow[];
  /** Penawaran untuk produk yang sudah ada di katalog: membawa `slug`. */
  offerRows: CsvRow[];
  /** Foto dalam format galeri (photo-gallery-rows.ts), satu baris per foto unik. */
  photoRows: CsvRow[];
  corrections: Correction[];
};

type ProductEntry = { row: CsvRow; lines: Map<string, number>; variants: Map<string, [number, number]>; firstLine: number };

type ParsedRow = {
  line: number;
  r: CsvRow;
  ram: string;
  storage: string;
  gsmarena: string;
  /** Kelompok produk: slug dari merek + model, atau null bila keduanya tidak diisi. */
  group: string | null;
  hasSpec: boolean;
  hasOffer: boolean;
};

export function convertUnifiedRows(
  rows: readonly CsvRow[],
  parts: readonly UnifiedPart[] = UNIFIED_PARTS
): UnifiedConversion {
  const corrections: Correction[] = [];
  const followUpOfferRows: CsvRow[] = [];
  const offerRows: CsvRow[] = [];
  const photoRows: CsvRow[] = [];
  const excluded = UNIFIED_PARTS.filter((part) => !parts.includes(part)).flatMap((part) => PART_COLUMNS[part]);

  const log = (line: number, column: string, from: string, result: Normalized) => {
    if (result.note) corrections.push({ line, column, from, to: result.value, note: result.note, level: "info" });
    return result.value;
  };

  // Tahap 1: rapikan setiap baris dan tentukan kelompok produknya.
  const parsed: ParsedRow[] = rows.map((raw, index) => {
    const line = index + 2;
    const r = canonicalRow(raw, line, corrections);
    for (const column of excluded) delete r[column];
    // Varian: kolom ram_gb/storage_gb, atau kolom gabungan "variant" (8/256GB).
    let ram = log(line, "ram_gb", r.ram_gb ?? "", normalizeMemoryGb(r.ram_gb ?? ""));
    let storage = log(line, "storage_gb", r.storage_gb ?? "", normalizeMemoryGb(r.storage_gb ?? ""));
    if (r.variant) {
      const pair = parseVariantPair(r.variant);
      if (!pair) {
        corrections.push({ line, column: "variant", from: r.variant, to: "", note: "Varian tidak terbaca; tulis seperti 8/256GB.", level: "error" });
      } else if (!ram && !storage) {
        ram = String(pair.ramGb);
        storage = String(pair.storageGb);
        corrections.push({
          line,
          column: "variant",
          from: r.variant,
          to: `RAM ${ram} GB, penyimpanan ${storage} GB`,
          note: "Kolom varian dipecah menjadi RAM dan penyimpanan.",
          level: "info",
        });
      }
    }
    const gsmarena = log(line, "gsmarena_url", r.gsmarena_url ?? "", normalizeGsmarenaPath(r.gsmarena_url ?? ""));
    let group: string | null = null;
    if (r.brand && r.model_name) {
      const { brand, model } = canonicalBrandModel(r.brand, r.model_name);
      group = toSlug(brand, model);
    }
    return {
      line,
      r,
      ram,
      storage,
      gsmarena,
      group,
      hasSpec: Boolean(gsmarena) || SPEC_DATA_COLUMNS.some((column) => r[column]),
      hasOffer: OFFER_TRIGGER_COLUMNS.some((column) => r[column]),
    };
  });

  // Kelompok yang punya spesifikasi di baris MANA PUN adalah produk di berkas
  // ini; semua barisnya (termasuk baris yang hanya berisi varian dan harga,
  // di atas maupun di bawah baris spesifikasinya) menjadi varian produk itu.
  // gsmarena_url cukup diisi di satu baris.
  const productGroups = new Map<string, { gsmarena: string; line: number }>();
  for (const row of parsed) {
    if (!row.group || !row.hasSpec) continue;
    const known = productGroups.get(row.group);
    if (!known) {
      productGroups.set(row.group, { gsmarena: row.gsmarena, line: row.line });
    } else if (row.gsmarena && !known.gsmarena) {
      known.gsmarena = row.gsmarena;
      known.line = row.line;
    } else if (row.gsmarena && known.gsmarena !== row.gsmarena) {
      corrections.push({
        line: row.line,
        column: "gsmarena_url",
        from: row.gsmarena,
        to: known.gsmarena,
        note: `Berbeda dengan baris ${known.line} untuk produk yang sama; dipakai nilai baris ${known.line}.`,
        level: "warning",
      });
    }
  }

  // Tahap 2: bentuk baris spesifikasi gabungan dan baris penawaran.
  const products = new Map<string, ProductEntry>();
  const photoLines = new Map<string, { line: number; row: CsvRow }>();
  const addPhoto = (row: ParsedRow) => {
    const { line, r } = row;
    if (!row.group && !r.slug) {
      corrections.push({ line, column: "image_url", from: r.image_url ?? "", to: "", note: "Foto butuh merek dan model (atau slug) di baris yang sama; dilewati.", level: "error" });
      return;
    }
    if (!r.color) {
      corrections.push({ line, column: "color", from: "", to: "", note: "Foto wajib menyebut warnanya di kolom color; foto dilewati.", level: "error" });
      return;
    }
    // Foto yang sama sering diulang per varian atau per toko: dihitung sekali.
    // Urutan, sampul, dan halaman asal dari baris ulangan mengisi yang kosong.
    const key = `${row.group ?? r.slug}|${r.color.toLowerCase()}|${r.image_url}`;
    const first = photoLines.get(key);
    if (first !== undefined) {
      for (const [target, source] of [["urutan", "urutan"], ["is_cover", "is_cover"], ["source_url", "image_source_url"]] as const) {
        if (!first.row[target] && r[source]) first.row[target] = r[source]!;
      }
      corrections.push({ line, column: "image_url", from: "", to: "", note: `Foto yang sama dengan baris ${first.line}; dihitung sekali.`, level: "info" });
      return;
    }
    const photo: CsvRow = {
      brand: r.brand ?? "",
      model_name: r.model_name ?? "",
      slug: row.group ? "" : (r.slug ?? ""),
      color: r.color,
      urutan: r.urutan ?? "",
      is_cover: r.is_cover ?? "",
      image_url: r.image_url ?? "",
      source_url: r.image_source_url ?? "",
      image_usage_basis: r.image_usage_basis ?? "",
      image_usage_rights: r.image_usage_rights ?? "",
    };
    photoLines.set(key, { line, row: photo });
    photoRows.push(photo);
  };
  for (const row of parsed) {
    const { line, r, ram, storage } = row;
    const productGroup = row.group ? productGroups.get(row.group) : undefined;
    if (r.image_url) addPhoto(row);
    if (!row.hasSpec && !row.hasOffer) {
      if (!r.image_url) {
        corrections.push({ line, column: "-", from: "", to: "", note: "Baris tidak berisi spesifikasi, penawaran, maupun foto; dilewati.", level: "error" });
      }
      continue;
    }
    if (row.hasSpec && !productGroup) {
      corrections.push({ line, column: "brand", from: "", to: "", note: "Baris spesifikasi wajib berisi merek dan model; dilewati.", level: "error" });
      continue;
    }

    let sourceKey: string | null = null;
    if (productGroup && row.group) {
      // Kunci yang sama dengan `mapRow`, supaya penawaran lanjutan menemukan produknya.
      sourceKey = productGroup.gsmarena
        ? `gsmarena:${productGroup.gsmarena.replace(/\.php$/, "")}`
        : `gsmarena:${row.group}`;
      const entry: ProductEntry = products.get(sourceKey) ?? {
        row: { brand: r.brand ?? "", model_name: r.model_name ?? "", url: productGroup.gsmarena },
        lines: new Map(),
        variants: new Map(),
        firstLine: line,
      };
      for (const column of [...SPEC_DATA_COLUMNS, ...SPEC_PASSTHROUGH_COLUMNS, "memory_variants_summary"]) {
        const value = r[column];
        if (!value) continue;
        const current = entry.row[column];
        if (current && current !== value) {
          corrections.push({
            line,
            column,
            from: value,
            to: current,
            note: `Berbeda dengan baris ${entry.lines.get(column)} untuk produk yang sama; dipakai nilai baris ${entry.lines.get(column)}.`,
            level: "warning",
          });
          continue;
        }
        if (!current) {
          entry.row[column] = value;
          entry.lines.set(column, line);
        }
      }
      if (/^\d+$/.test(ram) && /^\d+$/.test(storage)) entry.variants.set(`${ram}|${storage}`, [Number(ram), Number(storage)]);
      products.set(sourceKey, entry);
    }

    if (row.hasOffer) {
      const offer: CsvRow = {
        ram_gb: ram,
        storage_gb: storage,
        marketplace: r.marketplace ?? "",
        seller_name: r.seller_name ?? "",
        url: r.offer_url ?? "",
        warranty: r.warranty ?? "",
        listing_status: log(line, "listing_status", r.listing_status ?? "", normalizeListingStatus(r.listing_status ?? "")),
        seller_verified: log(line, "seller_verified", r.seller_verified ?? "", normalizeYesNo(r.seller_verified ?? "")),
        price_idr: log(line, "price_idr", r.price_idr ?? "", normalizePriceIdr(r.price_idr ?? "")),
        observed_at: log(line, "observed_at", r.observed_at ?? "", normalizeObservedAt(r.observed_at ?? "")),
        color: r.color ?? "",
      };
      if (sourceKey) {
        followUpOfferRows.push({ ...offer, source_key: sourceKey });
      } else {
        let slug = r.slug ?? "";
        if (slug && row.group) {
          // Slug yang diisi tangan dicek terhadap merek + model di baris yang
          // sama (2026-10-17: baris vivo Y05 ber-slug samsung-galaxy-a07-4g
          // hampir membuat penawaran vivo di produk Samsung).
          const { brand, model } = canonicalBrandModel(r.brand ?? "", r.model_name ?? "");
          offer.product_name = `${brand} ${model}`;
          offer.slug_check = "1";
        }
        if (!slug && row.group) {
          slug = row.group;
          // Nama ikut dikirim: pencocokan memakai nama (akhiran 4G/5G, merek
          // induk), dan slug bentukan hanya cadangan bila nama tidak cocok.
          const { brand, model } = canonicalBrandModel(r.brand ?? "", r.model_name ?? "");
          offer.product_name = `${brand} ${model}`;
          corrections.push({ line, column: "slug", from: "", to: slug, note: "Produk dicari lewat merek dan model.", level: "info" });
        }
        if (!slug) {
          corrections.push({ line, column: "slug", from: "", to: "", note: "Penawaran butuh slug, atau merek dan model produk; dilewati.", level: "error" });
          continue;
        }
        offerRows.push({ ...offer, slug });
      }
    }
  }

  const specRows = [...products.values()].map((entry) => {
    // Format ringkasan varian yang dibaca parseVariants: "penyimpananGB/RAMGB".
    const fromRows = [...entry.variants.values()].map(([ramGb, storageGb]) => `${storageGb}GB/${ramGb}GB`);
    const summary = [entry.row.memory_variants_summary, ...fromRows].filter(Boolean).join("; ");
    return { ...entry.row, memory_variants_summary: summary };
  });

  return { specRows, followUpOfferRows, offerRows, photoRows, corrections };
}

/** Kunci baris diganti nama kanonik (alias header); sel dirapikan spasinya. */
function canonicalRow(raw: CsvRow, line: number, corrections: Correction[]): CsvRow {
  const row: CsvRow = {};
  for (const [header, value] of Object.entries(raw)) {
    const cell = (value ?? "").trim();
    let column = canonicalHeader(header);
    // Kolom "url" tanpa keterangan dibaca dari isinya: tautan GSMArena adalah
    // sumber spesifikasi, tautan lain adalah listing toko.
    if (column === "url" && cell) column = GSMARENA_URL.test(cell) ? "gsmarena_url" : "offer_url";
    if (row[column] && cell && row[column] !== cell) {
      corrections.push({ line, column, from: cell, to: row[column]!, note: `Dua kolom berarti sama (${header}); dipakai yang pertama.`, level: "warning" });
      continue;
    }
    if (!row[column]) row[column] = cell;
  }
  return row;
}

/**
 * Isi templat CSV gabungan untuk tombol unduh. Contohnya memperlihatkan ketiga
 * jenis baris: produk baru (spesifikasi + varian + harga), foto per warna
 * (sampul dan urutan), serta harga dan foto untuk produk yang sudah ada.
 */
export function templateTerpadu(): string {
  const empty = Object.fromEntries(UNIFIED_COLUMNS.map((column) => [column, ""])) as Record<(typeof UNIFIED_COLUMNS)[number], string>;
  const reno = { ...empty, brand: "OPPO", model_name: "Reno16c" };
  const a6c = { ...empty, brand: "OPPO", model_name: "A6c" };
  const rows = [
    // Produk baru: spesifikasi cukup di satu baris, harga per varian.
    {
      ...reno,
      gsmarena_url: "oppo_reno16c_5g-14768.php",
      ram_gb: "8",
      storage_gb: "128",
      announced: "2026, July 02",
      network_technology: "GSM / HSPA / LTE / 5G",
      display_size_inches: "6.57",
      chipset: "Mediatek Dimensity 7300 Energy (4 nm)",
      battery_capacity_mah: "7000",
      nfc: "No",
      ip_rating: "IP68",
      colors: "Hitam, Ungu",
      color: "Hitam",
      marketplace: "Situs resmi OPPO Indonesia",
      seller_name: "OPPO Indonesia",
      offer_url: "https://www.oppo.com/id/smartphones/series-reno/reno16c/",
      price_idr: "Rp 4.999.000",
      observed_at: "10/10/2026 09:00",
    },
    {
      ...reno,
      ram_gb: "8",
      storage_gb: "256",
      marketplace: "Situs resmi OPPO Indonesia",
      seller_name: "OPPO Indonesia",
      offer_url: "https://www.oppo.com/id/smartphones/series-reno/reno16c/",
      price_idr: "",
      observed_at: "10/10/2026 09:00",
    },
    // Foto: satu baris per foto, dikelompokkan per warna.
    { ...reno, color: "Hitam", image_url: "https://fdn2.gsmarena.com/vv/bigpic/contoh-hitam-depan.jpg", urutan: "1", is_cover: "ya" },
    { ...reno, color: "Hitam", image_url: "https://fdn2.gsmarena.com/vv/bigpic/contoh-hitam-belakang.jpg", urutan: "2" },
    { ...reno, color: "Ungu", image_url: "https://fdn2.gsmarena.com/vv/bigpic/contoh-ungu.jpg", urutan: "1", is_cover: "ya" },
    // Produk yang sudah ada di katalog: harga dan foto saja.
    {
      ...a6c,
      ram_gb: "4",
      storage_gb: "128",
      color: "Biru",
      marketplace: "Blibli",
      seller_name: "Toko Contoh",
      offer_url: "https://www.blibli.com/p/contoh",
      price_idr: "1999000",
      observed_at: "2026-10-10T09:00:00+07:00",
      warranty: "Garansi resmi Indonesia",
      listing_status: "aktif",
      seller_verified: "tidak",
    },
    { ...a6c, color: "Biru", image_url: "https://down-id.img.susercontent.com/file/contoh", urutan: "1", is_cover: "ya", image_source_url: "https://www.blibli.com/p/contoh" },
  ];
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [UNIFIED_COLUMNS.join(","), ...rows.map((row) => UNIFIED_COLUMNS.map((column) => cell(row[column])).join(","))].join("\n") + "\n";
}
