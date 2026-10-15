import { productSpecsSchema, type ProductSpecs } from "@/lib/catalog/schema";
import type { CsvRow } from "@/lib/import/csv-parser";
import { mapRow, type ImportCandidate } from "@/lib/import/gsmarena";
import {
  hasColumn,
  looksLikeShopeeHeaders,
  prepareOfferRow,
  readErafoneListing,
  type ListingImageRef,
  type OfferCatalogProduct,
  type OfferRow,
  type OfferSourceFormat,
} from "@/lib/import/offers";
import { looksLikeGalleryHeaders } from "@/lib/import/photo-gallery-rows";
import { looksLikeUnifiedHeaders } from "@/lib/import/unified";

/**
 * Bentuk baris internal impor (langkah 2 rancangan impor terpadu, 2026-10-10).
 *
 * Setiap format masuk (dataset spesifikasi GSMArena, templat penawaran
 * CekHarga, hasil scraper Shopee, ekspor Erafone) diterjemahkan oleh
 * adaptornya menjadi `CanonicalRow` yang sama. Tahap persiapan, pratinjau,
 * dan penulisan hanya membaca bentuk ini, jadi format baru (termasuk templat
 * terpadu pada langkah 3) cukup menambah satu adaptor.
 *
 * Satu baris bisa membawa bagian produk, bagian penawaran, atau keduanya.
 * Format yang ada sekarang selalu membawa salah satu; bentuknya sudah
 * disiapkan untuk templat terpadu yang membawa keduanya sekaligus.
 *
 * Modul ini murni (tanpa jaringan dan database): pencocokan penawaran
 * memakai katalog yang sudah dibaca pemanggil.
 */

type SourceFormat = "gsmarena-spec" | OfferSourceFormat;
type ImportKind = "specs" | "offers" | "photos";

type CanonicalProduct = {
  candidate: ImportCandidate;
  /** Spesifikasi yang sudah lolos gerbang Zod katalog. */
  specs: ProductSpecs;
};

type CanonicalOffer = {
  row: OfferRow;
  origin: "manual" | "automatic";
  /** True bila judul tidak menyebut memori dan varian dasar disimpulkan. */
  inferredBaseVariant: boolean;
  image: ListingImageRef | null;
  imageIssue?: string;
  color: string | null;
  reviewNote: string | null;
};

type CanonicalRow = {
  /** Posisi baris di berkas (0-based). */
  rowIndex: number;
  format: SourceFormat;
  label: string;
  product: CanonicalProduct | null;
  offer: CanonicalOffer | null;
  /** Alasan baris tidak bisa dipakai; null bila valid. */
  issue: string | null;
};

/* ------------------------------------------------------- deteksi berkas */

type FileDetection =
  | { kind: ImportKind; format: SourceFormat | "mixed-offers" | "photo-gallery" }
  /** Templat terpadu (unified.ts): spesifikasi dan penawaran dalam satu berkas. */
  | { kind: "unified"; format: "unified" }
  | { kind: null; reason: string };

/** Jumlah baris yang diperiksa untuk mengenali ekspor Erafone (kolomnya tanpa nama tetap). */
const ERAFONE_SAMPLE_ROWS = 20;

/**
 * Mengenali jenis berkas dari header dan contoh baris, supaya berkas yang
 * diunggah ke formulir yang salah tetap diproses sebagai jenisnya yang benar
 * (keluhan "impornya berbeda template"). Hanya header dan beberapa baris
 * pertama yang dibaca, jadi biayanya tetap kecil berapa pun ukuran berkas.
 */
export function detectFileKind(headers: readonly string[], rows: readonly CsvRow[]): FileDetection {
  // Templat terpadu dikenali lebih dulu: kolomnya (offer_url, gsmarena_url,
  // brand + ram_gb) tidak dipakai format lama mana pun.
  // Galeri foto: merek, model, warna, dan foto tanpa kolom varian atau harga.
  if (looksLikeGalleryHeaders(headers)) return { kind: "photos", format: "photo-gallery" };
  if (looksLikeUnifiedHeaders(headers)) return { kind: "unified", format: "unified" };
  const spec = hasColumn(headers, "brand") && hasColumn(headers, "model_name");
  const template = hasColumn(headers, "slug") || hasColumn(headers, "source_key");
  const shopee = looksLikeShopeeHeaders(headers);
  const erafone = rows.slice(0, ERAFONE_SAMPLE_ROWS).some((row) => readErafoneListing(row) !== null);
  const offers = template || shopee || erafone;

  if (spec && offers) {
    return {
      kind: null,
      reason:
        "Berkas mencampur kolom spesifikasi format lama dengan kolom penawaran. Gunakan templat terpadu (kolom gsmarena_url, ram_gb, storage_gb, offer_url) untuk menggabungkan keduanya.",
    };
  }
  if (spec) return { kind: "specs", format: "gsmarena-spec" };
  if (template) return { kind: "offers", format: "template" };
  // Shopee dan Erafone sama-sama dibaca per baris oleh adaptor penawaran.
  if (shopee && erafone) return { kind: "offers", format: "mixed-offers" };
  if (shopee) return { kind: "offers", format: "shopee-scrape" };
  if (erafone) return { kind: "offers", format: "erafone-scrape" };
  return {
    kind: null,
    reason:
      "Format berkas tidak dikenali. Gunakan templat spesifikasi (kolom brand dan model_name) atau templat penawaran (kolom slug, ram_gb, storage_gb).",
  };
}

/* --------------------------------------------------------------- adaptor */

/** Adaptor dataset spesifikasi (format GSMArena / templat spesifikasi). */
export function productRowsToCanonical(rows: readonly CsvRow[]): CanonicalRow[] {
  return rows.map((row, rowIndex) => {
    const outcome = mapRow(row);
    if (!outcome.ok) {
      return { rowIndex, format: "gsmarena-spec", label: outcome.label, product: null, offer: null, issue: outcome.reason };
    }
    // Spesifikasi tetap melewati gerbang Zod yang sama dengan sumber lain,
    // supaya berkas CSV yang aneh tidak bisa menyelundupkan bentuk data baru.
    const specs = productSpecsSchema.safeParse(outcome.candidate.specs);
    if (!specs.success) {
      return {
        rowIndex,
        format: "gsmarena-spec",
        label: outcome.candidate.slug,
        product: null,
        offer: null,
        issue: `Spesifikasi tidak lolos validasi: ${specs.error.issues[0]?.message}`,
      };
    }
    return {
      rowIndex,
      format: "gsmarena-spec",
      label: `${outcome.candidate.brand} ${outcome.candidate.model}`,
      product: { candidate: outcome.candidate, specs: specs.data },
      offer: null,
      issue: null,
    };
  });
}

/** Adaptor penawaran: templat CekHarga, scraper Shopee, dan ekspor Erafone (dikenali per baris). */
export function offerRowsToCanonical(
  rows: readonly CsvRow[],
  products: readonly OfferCatalogProduct[],
  defaults: { observedAt: string; sellerName?: string }
): CanonicalRow[] {
  return rows.map((raw, rowIndex) => {
    const outcome = prepareOfferRow(raw, products, defaults);
    if (!outcome.ok) {
      return { rowIndex, format: outcome.format, label: outcome.label, product: null, offer: null, issue: outcome.reason };
    }
    return {
      rowIndex,
      format: outcome.format,
      label: `${outcome.row.slug} ${outcome.row.ramGb}/${outcome.row.storageGb}`,
      product: null,
      offer: {
        row: outcome.row,
        origin: outcome.origin,
        inferredBaseVariant: outcome.inferredBaseVariant,
        image: outcome.image,
        ...(outcome.imageIssue ? { imageIssue: outcome.imageIssue } : {}),
        color: outcome.color,
        reviewNote: outcome.reviewNote,
      },
      issue: null,
    };
  });
}
