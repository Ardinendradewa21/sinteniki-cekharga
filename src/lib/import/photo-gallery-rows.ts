import { canonicalBrandModel } from "@/lib/catalog/brands";
import type { CsvRow } from "@/lib/import/csv-parser";
import { colorInOptions, normalizeColorName } from "@/lib/import/colors";
import { IMAGE_HOST_ISSUE, safeHttpsImageUrl } from "@/lib/import/image-hosts";
import { readImageRights, type ImageRights } from "@/lib/import/image-rights";
import { canonicalHeader } from "@/lib/import/normalize";
import { resolveNamedProduct, type OfferCatalogProduct } from "@/lib/import/offers";
import { findSamePhoto, galleryLimitIssue, shouldBecomeCover, type StoredPhoto } from "@/lib/import/photo-rules";

/**
 * Baris foto galeri: satu baris = satu foto untuk satu model + warna. Sejak
 * Sprint 8 (2026-10-17) baris ini dihasilkan dari CSV gabungan
 * (unified.ts); berkas galeri format lama tetap dikenali formulir unggah.
 *
 * Kolom wajib: brand + model_name (atau slug), color, image_url. Opsional:
 * urutan, is_cover, source_url / image_source_url, image_usage_basis,
 * image_usage_rights. Kolom lain diabaikan; host foto tetap diperiksa importer.
 *
 * Pencocokan produk memakai aturan yang sama dengan templat terpadu
 * (`resolveNamedProduct`). Modul murni: tanpa jaringan dan database.
 */

const GALLERY_COLUMNS = [
  "brand",
  "model_name",
  "color",
  "urutan",
  "is_cover",
  "image_url",
  "source_url",
  "image_usage_basis",
  "image_usage_rights",
] as const;

/** Header berkas galeri: merek, model, warna, dan foto, tanpa kolom varian atau harga. */
export function looksLikeGalleryHeaders(headers: readonly string[]): boolean {
  const names = new Set(headers.map(canonicalHeader));
  const required = ["brand", "model_name", "color", "image_url"].every((name) => names.has(name));
  const priceOrVariant = ["ram_gb", "storage_gb", "variant", "offer_url", "price_idr", "memory_variants_summary", "gsmarena_url"].some(
    (name) => names.has(name)
  );
  return required && !priceOrVariant;
}

export type GalleryRow = {
  name: string;
  /** Slug katalog untuk baris yang tidak menyebut merek + model. */
  slug: string | null;
  color: string;
  imageUrl: string;
  sortOrder: number;
  isCover: boolean;
  sourceUrl: string | null;
  /** Hak pakai dari kolom baris; null = pakai pilihan form. */
  rights: ImageRights | null;
};

function canonical(row: CsvRow): CsvRow {
  const out: CsvRow = {};
  for (const [header, value] of Object.entries(row)) {
    const column = canonicalHeader(header);
    if (!out[column]) out[column] = (value ?? "").trim();
  }
  return out;
}

const YES = /^(ya|yes|y|true|1)$/i;

export function readGalleryRow(raw: CsvRow): { ok: true; row: GalleryRow } | { ok: false; label: string; reason: string } {
  const r = canonical(raw);
  // Merek yang sudah tertulis di model ("Samsung" + "Samsung Galaxy A57 5G")
  // tidak digandakan; sama dengan aturan templat terpadu.
  const named = r.brand && r.model_name ? canonicalBrandModel(r.brand, r.model_name) : null;
  const name = named ? `${named.brand} ${named.model}` : [r.brand, r.model_name].filter(Boolean).join(" ");
  const color = normalizeColorName(r.color);
  const label = [name || "(tanpa nama)", color].filter(Boolean).join(" – ");
  const slug = r.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug) ? r.slug : null;
  if ((!r.brand || !r.model_name) && !slug) return { ok: false, label, reason: "Merek dan model (atau slug) wajib diisi." };
  if (!color) return { ok: false, label, reason: "Warna wajib diisi; foto galeri selalu terikat ke satu warna." };
  if (!r.image_url) return { ok: false, label, reason: "Kolom image_url kosong." };
  const order = Number(r.urutan || "0");
  const rights = readImageRights(r.image_usage_basis, r.image_usage_rights);
  if (!rights.ok) return { ok: false, label, reason: rights.error };
  return {
    ok: true,
    row: {
      name: name || (slug ?? ""),
      slug: r.brand && r.model_name ? null : slug,
      color,
      imageUrl: r.image_url,
      sortOrder: Number.isFinite(order) && order >= 0 ? Math.trunc(order) : 0,
      isCover: YES.test(r.is_cover ?? ""),
      sourceUrl: sourceUrlOf(r),
      rights: rights.rights,
    },
  };
}

function sourceUrlOf(r: CsvRow): string | null {
  const value = r.image_source_url || r.source_url || "";
  return /^https?:\/\//i.test(value) ? value : null;
}

/** Produk untuk satu baris foto: lewat slug bila baris tidak menyebut nama, selain itu lewat nama. */
export function resolveGalleryProduct(
  row: GalleryRow,
  products: readonly OfferCatalogProduct[]
): ReturnType<typeof resolveNamedProduct> {
  if (row.slug) {
    const product = products.find((candidate) => candidate.slug === row.slug);
    return product ? { product, reviewNote: null } : null;
  }
  return resolveNamedProduct(row.name, products);
}

export type GalleryPlanItem = {
  rowIndex: number;
  action: "create" | "update" | "unchanged" | "skip";
  label: string;
  reason: string | null;
  product: { id: string; name: string } | null;
  photo: (GalleryRow & { url: string; rights: ImageRights }) | null;
  /**
   * Perlu tinjau: warna di luar daftar warna spesifikasi, atau nama yang
   * cocok padahal ada model saudara 4G/5G. Tetap bisa diterapkan.
   */
  colorReview: boolean;
};

/**
 * Rencana galeri. Foto diproses urut per produk dan warna: sampul dulu, lalu
 * urutan terkecil, supaya saat batas per warna tercapai yang terlewat adalah
 * foto urutan belakang. Foto yang sudah tersimpan atau sudah antre dihitung.
 */
export function planGalleryRows(
  rows: readonly CsvRow[],
  {
    products,
    existing,
    defaultRights,
  }: {
    products: readonly OfferCatalogProduct[];
    /** Foto tersimpan + foto yang masih antre, per id produk. */
    existing: ReadonlyMap<string, readonly StoredPhoto[]>;
    defaultRights: ImageRights | null;
  }
): GalleryPlanItem[] {
  type Parsed = {
    rowIndex: number;
    read: ReturnType<typeof readGalleryRow>;
    product: OfferCatalogProduct | null;
    issue: string | null;
    /** Nama cocok tetapi ada model saudara 4G/5G. */
    nameNote?: string | null;
  };
  const parsed: Parsed[] = rows.map((raw, rowIndex) => {
    const read = readGalleryRow(raw);
    if (!read.ok) return { rowIndex, read, product: null, issue: null };
    const named = resolveGalleryProduct(read.row, products);
    if (named && "error" in named) return { rowIndex, read, product: null, issue: named.error };
    if (!named) {
      return { rowIndex, read, product: null, issue: `Produk "${read.row.name}" tidak ditemukan di katalog; impor spesifikasinya dulu.` };
    }
    return { rowIndex, read, product: named.product, issue: null, nameNote: named.reviewNote };
  });

  // Kunci urut yang konsisten: baris yang bisa dipakai lebih dulu, per produk
  // dan warna, sampul di depan, lalu urutan terkecil.
  const sortKey = (entry: Parsed): [number, string, string, number, number, number] =>
    entry.read.ok && entry.product
      ? [0, entry.product.id, entry.read.row.color.toLowerCase(), entry.read.row.isCover ? 0 : 1, entry.read.row.sortOrder, entry.rowIndex]
      : [1, "", "", 0, 0, entry.rowIndex];
  const order = [...parsed].sort((a, b) => {
    const left = sortKey(a);
    const right = sortKey(b);
    for (let i = 0; i < left.length; i += 1) {
      const l = left[i]!;
      const r = right[i]!;
      if (l !== r) return typeof l === "number" ? l - (r as number) : String(l).localeCompare(String(r));
    }
    return 0;
  });

  // URL foto yang sama untuk dua warna berbeda pada satu produk hampir selalu
  // salah salin di sheet (ditemukan 2026-10-17: vivo Y05, Y31d, iQOO Z11).
  // Tetap boleh diterapkan, tetapi ditandai tinjau.
  const colorsByUrl = new Map<string, Set<string>>();
  for (const entry of parsed) {
    if (!entry.read.ok || !entry.product) continue;
    const key = `${entry.product.id} ${entry.read.row.imageUrl.trim()}`;
    const colors = colorsByUrl.get(key) ?? new Set<string>();
    colors.add(entry.read.row.color);
    colorsByUrl.set(key, colors);
  }

  const simulated = new Map<string, StoredPhoto[]>();
  const items: GalleryPlanItem[] = [];
  for (const entry of order) {
    const { rowIndex, read, product, issue } = entry;
    if (!read.ok) {
      items.push({ rowIndex, action: "skip", label: read.label, reason: read.reason, product: null, photo: null, colorReview: false });
      continue;
    }
    const { row } = read;
    const label = `${product ? `${product.brand} ${product.model}` : row.name} – ${row.color}`;
    const skip = (reason: string) =>
      items.push({
        rowIndex,
        action: "skip",
        label,
        reason,
        product: product ? { id: product.id, name: `${product.brand} ${product.model}` } : null,
        photo: null,
        colorReview: false,
      });
    if (!product) {
      skip(issue ?? "Produk tidak ditemukan.");
      continue;
    }
    const url = safeHttpsImageUrl(row.imageUrl);
    if (!url) {
      skip(IMAGE_HOST_ISSUE);
      continue;
    }
    const rights = row.rights ?? defaultRights;
    if (!rights) {
      skip("Dasar hak pakai foto belum dipilih; pilih di formulir atau isi kolom image_usage_basis.");
      continue;
    }
    const photos = simulated.get(product.id) ?? [...(existing.get(product.id) ?? [])];
    simulated.set(product.id, photos);

    const colorNote = colorInOptions(row.color, product.colorOptions)
      ? null
      : `Warna "${row.color}" tidak ada di daftar warna spesifikasi produk (${product.colorOptions!.join(", ")}). Periksa ejaannya.`;
    const sharedColors = [...(colorsByUrl.get(`${product.id} ${row.imageUrl.trim()}`) ?? [])].filter((color) => color !== row.color);
    const sharedNote = sharedColors.length
      ? `URL foto yang sama juga dipakai untuk warna ${sharedColors.join(", ")}. Pastikan fotonya memang warna ${row.color}.`
      : null;
    const note = [entry.nameNote, colorNote, sharedNote].filter(Boolean).join(" ") || null;
    const colorReview = note !== null;
    const base = { rowIndex, label, product: { id: product.id, name: `${product.brand} ${product.model}` }, colorReview };
    const photo = { ...row, url: url.href, rights };

    const same = findSamePhoto(photos, url.href, row.color);
    if (same) {
      const claims = same.color === null;
      if (claims) same.color = row.color;
      items.push({ ...base, action: claims ? "update" : "unchanged", reason: note, photo });
      continue;
    }
    const limit = galleryLimitIssue(photos, row.color);
    if (limit) {
      skip(limit);
      continue;
    }
    photos.push({ id: `rencana-${rowIndex}`, original_url: url.href, color: row.color, is_cover: shouldBecomeCover(photos, row.color, row.isCover) });
    items.push({ ...base, action: "create", reason: note, photo });
  }
  return items.sort((a, b) => a.rowIndex - b.rowIndex);
}

/** Isi templat galeri foto untuk tombol unduh. */
export function templateGaleri(): string {
  const rows = [
    ["Xiaomi", "Redmi 17", "Lotus Purple", "1", "ya", "https://down-id.img.susercontent.com/file/contoh-sampul", "https://shopee.co.id/contoh", "", ""],
    ["Xiaomi", "Redmi 17", "Lotus Purple", "2", "tidak", "https://i02.appmifile.com/contoh/foto-2.png", "https://shopee.co.id/contoh", "", ""],
    ["Xiaomi", "Redmi 17", "Oak Green", "1", "ya", "https://down-id.img.susercontent.com/file/contoh-hijau", "https://shopee.co.id/contoh", "", ""],
  ];
  return [GALLERY_COLUMNS.join(","), ...rows.map((row) => row.join(","))].join("\n") + "\n";
}
