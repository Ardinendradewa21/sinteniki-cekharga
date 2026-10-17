import { canonicalBrandModel, toSlug } from "@/lib/catalog/brands";
import type { CsvRow } from "@/lib/import/csv-parser";
import {
  canonicalHeader,
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
 * CSV gabungan: penawaran dan foto per warna dalam SATU berkas (templat
 * terpadu 2026-10-10, foto digabung Sprint 8, spesifikasi dikeluarkan
 * Sprint 9 pada 2026-10-17).
 *
 * Spesifikasi dan produk baru TIDAK lagi lewat CSV: keduanya diambil lewat
 * Tarik otomatis (situs resmi + GSMArena), lalu disunting di halaman produk.
 * Kolom spesifikasi di berkas lama diabaikan dengan satu catatan, jadi sheet
 * lama tetap bisa diunggah tanpa diubah.
 *
 * Setiap baris dibaca menurut kelompok kolom yang terisi, dan satu baris boleh
 * membawa keduanya:
 *   - kolom penawaran (offer_url, harga, toko) terisi -> satu penawaran untuk
 *     produk yang sudah ada di katalog (dicocokkan lewat merek + model);
 *   - image_url terisi -> satu foto (warna, urutan, sampul) lewat aturan galeri.
 *
 * Foto yang sama di beberapa baris (mis. diulang per varian) dihitung sekali.
 * Admin bisa memilih bagian yang diimpor (`parts`); kolom bagian yang tidak
 * dipilih diabaikan sejak awal. Modul murni, tanpa jaringan dan database.
 */

/** Kolom CSV gabungan, urut per kelompok. Dipakai templat unduhan dan dokumentasi. */
export const UNIFIED_COLUMNS = [
  // identitas
  "brand",
  "model_name",
  "slug",
  "ram_gb",
  "storage_gb",
  // warna dan foto (foto dari host yang diizinkan dan wajib dasar hak pakai)
  "color",
  "image_url",
  "urutan",
  "is_cover",
  "image_source_url",
  "image_usage_basis",
  "image_usage_rights",
  // penawaran
  "marketplace",
  "seller_name",
  "offer_url",
  "price_idr",
  "observed_at",
  "warranty",
  "listing_status",
  "seller_verified",
] as const;

/**
 * Kolom spesifikasi format lama. Diabaikan: spesifikasi kini hanya lewat Tarik
 * otomatis. Daftarnya dipakai untuk memberi tahu admin bahwa kolom itu tidak
 * dibaca, bukan untuk menyimpannya.
 */
const IGNORED_SPEC_COLUMNS = [
  "gsmarena_url",
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
  "colors",
  "memory_variants_summary",
] as const;

const PHOTO_COLUMNS = ["image_url", "urutan", "is_cover", "image_source_url", "image_usage_basis", "image_usage_rights"] as const;

const OFFER_TRIGGER_COLUMNS = ["offer_url", "price_idr", "marketplace", "seller_name"] as const;

/** Bagian CSV gabungan yang bisa dipilih admin saat mengunggah. */
export const UNIFIED_PARTS = ["offers", "photos"] as const;
export type UnifiedPart = (typeof UNIFIED_PARTS)[number];

/** Kolom milik tiap bagian; dikosongkan bila bagiannya tidak dipilih. */
const PART_COLUMNS: Record<UnifiedPart, readonly string[]> = {
  offers: ["offer_url", "price_idr", "marketplace", "seller_name", "observed_at", "warranty", "listing_status", "seller_verified"],
  photos: PHOTO_COLUMNS,
};

/** Host GSMArena: kolom `url` berisi tautan ini adalah sumber spesifikasi (diabaikan). */
const GSMARENA_URL = /^(?:https?:\/\/(?:www\.|m\.)?gsmarena\.com\/)?[a-z0-9_]+-\d+\.php$/i;

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
  /** Penawaran untuk produk yang sudah ada di katalog: membawa `slug` dan nama produk. */
  offerRows: CsvRow[];
  /** Foto dalam format galeri (photo-gallery-rows.ts), satu baris per foto unik. */
  photoRows: CsvRow[];
  corrections: Correction[];
};

export function convertUnifiedRows(
  rows: readonly CsvRow[],
  parts: readonly UnifiedPart[] = UNIFIED_PARTS
): UnifiedConversion {
  const corrections: Correction[] = [];
  const offerRows: CsvRow[] = [];
  const photoRows: CsvRow[] = [];
  const excluded = UNIFIED_PARTS.filter((part) => !parts.includes(part)).flatMap((part) => PART_COLUMNS[part]);
  const photoLines = new Map<string, { line: number; row: CsvRow }>();
  let specLines = 0;
  let firstSpecLine = 0;

  const log = (line: number, column: string, from: string, result: Normalized) => {
    if (result.note) corrections.push({ line, column, from, to: result.value, note: result.note, level: "info" });
    return result.value;
  };

  const addPhoto = (line: number, r: CsvRow, group: string | null) => {
    if (!group && !r.slug) {
      corrections.push({ line, column: "image_url", from: r.image_url ?? "", to: "", note: "Foto butuh merek dan model (atau slug) di baris yang sama; dilewati.", level: "error" });
      return;
    }
    if (!r.color) {
      corrections.push({ line, column: "color", from: "", to: "", note: "Foto wajib menyebut warnanya di kolom color; foto dilewati.", level: "error" });
      return;
    }
    // Foto yang sama sering diulang per varian atau per toko: dihitung sekali.
    // Urutan, sampul, dan halaman asal dari baris ulangan mengisi yang kosong.
    const key = `${group ?? r.slug}|${r.color.toLowerCase()}|${r.image_url}`;
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
      slug: group ? "" : (r.slug ?? ""),
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

  rows.forEach((raw, index) => {
    const line = index + 2;
    const r = canonicalRow(raw, line, corrections);
    for (const column of excluded) delete r[column];
    const hasSpec = IGNORED_SPEC_COLUMNS.some((column) => r[column]);
    if (hasSpec) {
      specLines += 1;
      firstSpecLine ||= line;
    }

    let group: string | null = null;
    let productName = "";
    if (r.brand && r.model_name) {
      const { brand, model } = canonicalBrandModel(r.brand, r.model_name);
      group = toSlug(brand, model);
      productName = `${brand} ${model}`;
    }

    if (r.image_url) addPhoto(line, r, group);
    const hasOffer = OFFER_TRIGGER_COLUMNS.some((column) => r[column]);
    if (!hasOffer) {
      if (!r.image_url && !hasSpec) {
        corrections.push({ line, column: "-", from: "", to: "", note: "Baris tidak berisi penawaran maupun foto; dilewati.", level: "error" });
      }
      return;
    }

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
    let slug = r.slug ?? "";
    if (group) {
      // Nama selalu ikut: pencocokan memakai nama (akhiran 4G/5G, merek induk).
      offer.product_name = productName;
      if (slug) {
        // Slug yang diisi tangan dicek terhadap merek + model di baris yang
        // sama (2026-10-17: baris vivo Y05 ber-slug samsung-galaxy-a07-4g).
        offer.slug_check = "1";
      } else {
        slug = group;
        corrections.push({ line, column: "slug", from: "", to: slug, note: "Produk dicari lewat merek dan model.", level: "info" });
      }
    }
    if (!slug) {
      corrections.push({ line, column: "slug", from: "", to: "", note: "Penawaran butuh slug, atau merek dan model produk; dilewati.", level: "error" });
      return;
    }
    offerRows.push({ ...offer, slug });
  });

  if (specLines > 0) {
    corrections.push({
      line: firstSpecLine,
      column: "spesifikasi",
      from: "",
      to: "",
      note: `Kolom spesifikasi di ${specLines} baris diabaikan. Produk baru dan spesifikasi diambil lewat Tarik otomatis, lalu disunting di halaman produk.`,
      level: "warning",
    });
  }

  return { offerRows, photoRows, corrections };
}

/** Kunci baris diganti nama kanonik (alias header); sel dirapikan spasinya. */
function canonicalRow(raw: CsvRow, line: number, corrections: Correction[]): CsvRow {
  const row: CsvRow = {};
  for (const [header, value] of Object.entries(raw)) {
    const cell = (value ?? "").trim();
    let column = canonicalHeader(header);
    // Kolom "url" tanpa keterangan dibaca dari isinya: tautan GSMArena adalah
    // sumber spesifikasi (diabaikan), tautan lain adalah listing toko.
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
 * Isi templat CSV gabungan untuk tombol unduh: harga per varian per toko dan
 * foto per warna (sampul dan urutan) untuk produk yang sudah ada di katalog.
 */
export function templateTerpadu(): string {
  const empty = Object.fromEntries(UNIFIED_COLUMNS.map((column) => [column, ""])) as Record<(typeof UNIFIED_COLUMNS)[number], string>;
  const a6c = { ...empty, brand: "OPPO", model_name: "A6c" };
  const rows = [
    // Penawaran: satu baris per varian per toko.
    {
      ...a6c,
      ram_gb: "4",
      storage_gb: "128",
      color: "Biru",
      marketplace: "Situs resmi OPPO Indonesia",
      seller_name: "OPPO Indonesia",
      offer_url: "https://www.oppo.com/id/smartphones/series-a/a6c/",
      price_idr: "Rp 1.999.000",
      observed_at: "10/10/2026 09:00",
    },
    {
      ...a6c,
      ram_gb: "6",
      storage_gb: "128",
      marketplace: "Blibli",
      seller_name: "Toko Contoh",
      offer_url: "https://www.blibli.com/p/contoh",
      price_idr: "",
      observed_at: "2026-10-10T09:00:00+07:00",
      warranty: "Garansi resmi Indonesia",
      listing_status: "aktif",
      seller_verified: "tidak",
    },
    // Foto: satu baris per foto, dikelompokkan per warna.
    { ...a6c, color: "Biru", image_url: "https://fdn2.gsmarena.com/vv/bigpic/contoh-biru-depan.jpg", urutan: "1", is_cover: "ya" },
    { ...a6c, color: "Biru", image_url: "https://fdn2.gsmarena.com/vv/bigpic/contoh-biru-belakang.jpg", urutan: "2" },
    { ...a6c, color: "Hitam", image_url: "https://down-id.img.susercontent.com/file/contoh", urutan: "1", is_cover: "ya", image_source_url: "https://www.blibli.com/p/contoh" },
  ];
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [UNIFIED_COLUMNS.join(","), ...rows.map((row) => UNIFIED_COLUMNS.map((column) => cell(row[column])).join(","))].join("\n") + "\n";
}
