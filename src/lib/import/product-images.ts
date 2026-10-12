import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import type { CsvRow } from "@/lib/import/csv-parser";
import { IMAGE_HOST_ISSUE, imageSourceName, safeHttpsImageUrl } from "@/lib/import/image-hosts";
import { removePlainBackground } from "@/lib/import/image-matte";
import { isImageUsageBasis, type ImageRights } from "@/lib/import/image-rights";
import { normalizeColorName } from "@/lib/import/colors";
import { findSamePhoto, galleryLimitIssue, shouldBecomeCover, storageColorSuffix } from "@/lib/import/photo-rules";

export const PRODUCT_IMAGE_BUCKET = "product-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_OPTIMIZED_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_IMAGE_DIMENSION = 1_200;
const DOWNLOAD_TIMEOUT_MS = 15_000;
/**
 * Batas waktu pemrosesan satu tahap sharp (libvips), dihitung sejak gambar
 * dibuka. Gambar yang sengaja dibuat berat tidak boleh menahan worker foto
 * sampai batas waktu fungsi serverless.
 */
const SHARP_TIMEOUT_SECONDS = 20;
const MAX_REDIRECTS = 3;
const WEBP_QUALITY = 80;
const WEBP_FALLBACK_QUALITY = 68;
/**
 * Ikut membentuk key Storage. Menaikkan versi membuat impor berikutnya (dan
 * tombol "proses ulang foto") memproses ulang foto lama dari URL aslinya.
 * v2: latar putih polos dihapus menjadi transparan (lihat image-matte.ts).
 */
const IMAGE_PIPELINE_VERSION = "webp-v2-matte";

const IMAGE_COLUMNS = [
  "image_url",
  "marketplace_image_url",
  "product_image_url",
  "image_src",
] as const;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_DECODED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ProductImageCandidate = {
  imageUrl: string;
  /** Nama sumber yang ditampilkan sebagai asal foto: GSMArena, Shopee, Erafone. */
  source: string;
  sourceUrl: string;
  alt: string;
  /** Hak pakai khusus foto ini (mis. kolom CSV); null = pakai pilihan form. */
  rights: ImageRights | null;
  /** Warna yang ditampilkan foto ini, apa adanya dari sumber; null = tidak diketahui. */
  color: string | null;
  /** Urutan di dalam warnanya (kecil = lebih dulu). Hanya dipakai saat foto dibuat. */
  sortOrder?: number;
  /** Diminta menjadi sampul warnanya; diabaikan bila warna itu sudah punya sampul. */
  isCover?: boolean;
};

export type ProductImageReading = {
  candidate: ProductImageCandidate | null;
  issue: string | null;
};

export type ProductImageImportResult =
  | { ok: true; outcome: "created" | "updated" | "unchanged" }
  | { ok: false; reason: string };

function firstValue(row: CsvRow, columns: readonly string[]): string {
  for (const column of columns) {
    const value = (row[column] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/**
 * Membaca kandidat gambar dari CSV spesifikasi tanpa menganggap semua URL
 * aman atau semua hasil pencocokan marketplace benar.
 */
export function readProductImage(
  row: CsvRow,
  {
    brand,
    model,
    specsSourceUrl,
  }: { brand: string; model: string; specsSourceUrl: string | null }
): ProductImageReading {
  const rawUrl = firstValue(row, IMAGE_COLUMNS);
  if (!rawUrl) return { candidate: null, issue: null };

  const matchStatus = (row.match_status ?? "").trim().toLowerCase();
  if (matchStatus && matchStatus !== "matched_exact") {
    return {
      candidate: null,
      issue: `Gambar dilewati karena pencocokan marketplace berstatus "${matchStatus}", bukan matched_exact.`,
    };
  }

  const imageUrl = safeHttpsImageUrl(rawUrl);
  if (!imageUrl) {
    return { candidate: null, issue: IMAGE_HOST_ISSUE };
  }

  const source = imageSourceName(imageUrl);
  // Foto Shopee merujuk listing-nya, foto GSMArena merujuk halaman spesifikasi;
  // sumber lain (mis. situs resmi brand) merujuk URL fotonya sendiri.
  const sourceUrl =
    source === "Shopee"
      ? (row.marketplace_link ?? "").trim() || imageUrl.href
      : source === "GSMArena"
        ? (specsSourceUrl ?? imageUrl.href)
        : imageUrl.href;
  const usageRights = firstValue(row, [
    "image_usage_rights",
    "asset_usage_rights",
  ]);
  // Kolom teks lama tanpa dasar hak dicatat apa adanya: pernyataan admin.
  const basisColumn = firstValue(row, ["image_usage_basis"]);
  const usageBasis = isImageUsageBasis(basisColumn) ? basisColumn : "admin-declared";

  return {
    candidate: {
      imageUrl: imageUrl.href,
      source,
      sourceUrl,
      alt: `Foto ${brand} ${model}`,
      rights: usageRights ? { basis: usageBasis, text: usageRights } : null,
      color: normalizeColorName(firstValue(row, ["image_color", "color"])),
    },
    issue: null,
  };
}

function validateRedirectTarget(value: string, base: URL): URL | null {
  const target = safeHttpsImageUrl(new URL(value, base).href);
  return target;
}

async function downloadImage(imageUrl: string): Promise<
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: string }
> {
  let current = safeHttpsImageUrl(imageUrl);
  if (!current) return { ok: false, reason: "URL gambar tidak diizinkan." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/jpeg,image/png,image/webp" },
        cache: "no-store",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) {
          return { ok: false, reason: "Redirect gambar terlalu banyak atau tidak valid." };
        }
        const target = validateRedirectTarget(location, current);
        if (!target) {
          return { ok: false, reason: "Redirect gambar menuju host yang tidak diizinkan." };
        }
        current = target;
        continue;
      }

      if (!response.ok || !response.body) {
        return { ok: false, reason: `Sumber gambar merespons HTTP ${response.status}.` };
      }

      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        return { ok: false, reason: `Format gambar "${contentType || "tidak diketahui"}" tidak didukung.` };
      }

      const declaredSize = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) {
        return { ok: false, reason: "Ukuran gambar melebihi batas 5 MB." };
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel();
          return { ok: false, reason: "Ukuran gambar melebihi batas 5 MB." };
        }
        chunks.push(value);
      }

      if (total === 0) return { ok: false, reason: "Berkas gambar kosong." };

      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return { ok: true, bytes };
    }
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      reason: timedOut ? "Pengambilan gambar melewati batas 15 detik." : "Gambar gagal diunduh dari sumber.",
    };
  } finally {
    clearTimeout(timeout);
  }

  return { ok: false, reason: "Gambar gagal diunduh dari sumber." };
}

type Raster = { data: Uint8Array; width: number; height: number };

/** Dekode, putar sesuai EXIF, perkecil, lalu hapus latar polos (bila aman). */
async function prepareRaster(bytes: Uint8Array): Promise<Raster> {
  const { data, info } = await sharp(bytes, {
    failOn: "warning",
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .autoOrient()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .timeout({ seconds: SHARP_TIMEOUT_SECONDS })
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  removePlainBackground(pixels, info.width, info.height);
  return { data: pixels, width: info.width, height: info.height };
}

async function encodeWebp(raster: Raster, quality: number) {
  return sharp(raster.data, {
    raw: { width: raster.width, height: raster.height, channels: 4 },
  })
    .webp({ quality, alphaQuality: 90, effort: 4, smartSubsample: true })
    .timeout({ seconds: SHARP_TIMEOUT_SECONDS })
    .toBuffer({ resolveWithObject: true });
}

async function optimizeImage(bytes: Uint8Array): Promise<
  | { ok: true; blob: Blob }
  | { ok: false; reason: string }
> {
  try {
    const metadata = await sharp(bytes, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();

    if (
      !metadata.width ||
      !metadata.height ||
      !metadata.format ||
      !ALLOWED_DECODED_FORMATS.has(metadata.format)
    ) {
      return { ok: false, reason: "Isi berkas bukan gambar JPEG, PNG, atau WebP yang valid." };
    }

    if ((metadata.pages ?? 1) > 1) {
      return { ok: false, reason: "Gambar animasi atau multi-halaman tidak didukung." };
    }

    const raster = await prepareRaster(bytes);
    let optimized = await encodeWebp(raster, WEBP_QUALITY);
    if (optimized.info.size > MAX_OPTIMIZED_IMAGE_BYTES) {
      optimized = await encodeWebp(raster, WEBP_FALLBACK_QUALITY);
    }
    if (optimized.info.size > MAX_OPTIMIZED_IMAGE_BYTES) {
      return { ok: false, reason: "Hasil optimasi gambar masih melebihi batas 2 MB." };
    }

    // Salin ke Uint8Array biasa agar Blob tidak bergantung pada backing Buffer
    // Node. Sharp membuang EXIF/metadata lain secara default saat menulis ulang.
    const webpBytes = new Uint8Array(optimized.data);
    return {
      ok: true,
      blob: new Blob([webpBytes], { type: "image/webp" }),
    };
  } catch {
    return {
      ok: false,
      reason: "Gambar rusak, terlalu besar untuk diproses, atau format aslinya tidak cocok.",
    };
  }
}

function storageKeyFor(productId: string, imageUrl: string, color: string | null): string {
  // Satu URL untuk dua warna = dua objek storage, supaya menghapus foto satu
  // warna tidak menghapus berkas foto warna lain.
  const hash = createHash("sha256")
    .update(`${IMAGE_PIPELINE_VERSION}:${imageUrl}${storageColorSuffix(color)}`)
    .digest("hex")
    .slice(0, 24);
  return `products/${productId}/${hash}.webp`;
}

/** Unduh → optimasi → unggah. Mengembalikan key dan URL publik objek baru. */
async function storeImage(
  storageKey: string,
  imageUrl: string
): Promise<
  | { ok: true; key: string; publicUrl: string }
  | { ok: false; reason: string }
> {
  const downloaded = await downloadImage(imageUrl);
  if (!downloaded.ok) return downloaded;

  const optimized = await optimizeImage(downloaded.bytes);
  if (!optimized.ok) return optimized;

  const bucket = getInsforgeAdminClient().storage.from(PRODUCT_IMAGE_BUCKET);
  const uploaded = await bucket.upload(storageKey, optimized.blob);
  if (uploaded.error || !uploaded.data) {
    console.error("[foto] unggah ke Storage gagal:", storageKey, uploaded.error);
    return { ok: false, reason: "Gambar gagal disimpan ke Storage." };
  }

  const stored = uploaded.data as { key?: string; url?: string };
  const key = stored.key || storageKey;
  const publicUrl = stored.url || bucket.getPublicUrl(key).data?.publicUrl;
  if (!publicUrl) {
    await bucket.remove(key);
    return { ok: false, reason: "Storage tidak mengembalikan URL publik gambar." };
  }
  return { ok: true, key, publicUrl };
}

function removeStoredImage(key: string) {
  return getInsforgeAdminClient().storage.from(PRODUCT_IMAGE_BUCKET).remove(key);
}

type PhotoRow = {
  id: string;
  storage_key: string | null;
  original_url: string | null;
  color: string | null;
  is_cover: boolean;
};

async function productPhotos(productId: string): Promise<PhotoRow[] | null> {
  const { data, error } = await getInsforgeAdminClient()
    .database.from("product_assets")
    .select("id, storage_key, original_url, color, is_cover")
    .eq("product_id", productId)
    .eq("kind", "photo")
    .is("variant_id", null)
    .order("created_at", { ascending: true });
  return error ? null : ((data ?? []) as PhotoRow[]);
}

/**
 * Foto yang sama sudah tersimpan: berkas tidak diunduh ulang, tetapi warna
 * yang baru diketahui dicatat, dan sampul dipasang bila warnanya belum punya.
 * Warna kosong tidak menghapus warna lama; urutan pilihan admin tidak diubah.
 */
async function updateMetadataOnly(
  photo: PhotoRow,
  photos: readonly PhotoRow[],
  candidate: ProductImageCandidate
): Promise<ProductImageImportResult> {
  const patch: Record<string, unknown> = {};
  const color = photo.color ?? candidate.color;
  if (candidate.color && !photo.color) patch.color = candidate.color;
  if (!photo.is_cover && shouldBecomeCover(photos, color, Boolean(candidate.isCover))) patch.is_cover = true;
  if (Object.keys(patch).length === 0) return { ok: true, outcome: "unchanged" };
  const { error } = await getInsforgeAdminClient().database.from("product_assets").update(patch).eq("id", photo.id);
  return error ? { ok: false, reason: "Warna atau sampul foto gagal dicatat." } : { ok: true, outcome: "updated" };
}

/**
 * Menulis catatan aset untuk objek yang baru diunggah: memperbarui `existing`
 * (lalu menghapus objek lamanya) atau membuat baris baru.
 */
async function saveAssetRow(
  productId: string,
  candidate: ProductImageCandidate,
  rights: ImageRights,
  retrievedAt: string,
  stored: { key: string; publicUrl: string },
  existing: PhotoRow | undefined,
  batchId: string | null,
  photos: readonly PhotoRow[] = []
): Promise<ProductImageImportResult> {
  const db = getInsforgeAdminClient().database;
  const color = candidate.color ?? existing?.color ?? null;
  const payload = {
    product_id: productId,
    variant_id: null,
    kind: "photo",
    src: stored.publicUrl,
    alt: candidate.alt,
    source: candidate.source,
    source_url: candidate.sourceUrl,
    retrieved_at: retrievedAt,
    usage_rights: rights.text,
    usage_basis: rights.basis,
    storage_key: stored.key,
    original_url: candidate.imageUrl,
    // Warna kosong tidak menghapus warna yang sudah tercatat di foto yang diganti.
    color,
  };

  if (existing) {
    const updated = await db.from("product_assets").update(payload).eq("id", existing.id);
    if (updated.error) {
      await removeStoredImage(stored.key);
      return { ok: false, reason: "Gambar tersimpan tetapi catatan aset gagal diperbarui." };
    }
    if (existing.storage_key && existing.storage_key !== stored.key) {
      await removeStoredImage(existing.storage_key);
    }
    return { ok: true, outcome: "updated" };
  }

  // Hanya foto yang DIBUAT diberi tanda batch: undo boleh menghapusnya. Foto
  // yang diganti di tempat tidak ditandai, karena isi lamanya sudah hilang.
  // Urutan dan sampul hanya diisi saat dibuat; setelah itu milik admin.
  const inserted = await db.from("product_assets").insert([
    {
      ...payload,
      created_by_batch_id: batchId,
      sort_order: Math.max(0, Math.trunc(candidate.sortOrder ?? 0)),
      is_cover: shouldBecomeCover(photos, color, Boolean(candidate.isCover)),
    },
  ]);
  if (inserted.error) {
    await removeStoredImage(stored.key);
    return { ok: false, reason: "Gambar tersimpan tetapi catatan aset gagal dibuat." };
  }
  return { ok: true, outcome: "created" };
}

/**
 * Foto UTAMA dari impor spesifikasi: satu per produk. Foto tertua menjadi
 * foto utama dan diganti di tempat, sehingga foto galeri yang ditambahkan
 * belakangan (listing toko) tidak tertimpa.
 */
export async function importProductImage({
  productId,
  candidate,
  defaultRights,
  retrievedAt,
  batchId = null,
}: {
  productId: string;
  candidate: ProductImageCandidate;
  /** Pilihan form; dipakai bila fotonya tidak membawa hak pakai sendiri. */
  defaultRights: ImageRights | null;
  retrievedAt: string;
  /** Batch impor asal antrean foto ini (jejak asal untuk undo). */
  batchId?: string | null;
}): Promise<ProductImageImportResult> {
  const photos = await productPhotos(productId);
  if (!photos) return { ok: false, reason: "Foto lama produk gagal diperiksa." };

  // Foto yang sama sudah ada di galeri (mis. dari listing toko): jangan dobel.
  const sameSource = findSamePhoto(photos, candidate.imageUrl, candidate.color);
  const storageKey = storageKeyFor(productId, candidate.imageUrl, sameSource?.color ?? candidate.color);
  if (sameSource?.storage_key === storageKey) return updateMetadataOnly(sameSource, photos, candidate);
  // Foto utama menggantikan foto umum (tanpa warna) tertua, bukan foto warna
  // dari listing toko; tanpa foto umum, foto utama ditambahkan.
  const existing = sameSource ?? photos.find((photo) => photo.color === null);
  if (!existing) {
    const limit = galleryLimitIssue(photos, candidate.color);
    if (limit) return { ok: false, reason: limit };
  }

  const rights = candidate.rights ?? defaultRights;
  if (!rights) {
    return {
      ok: false,
      reason: "Dasar hak pakai foto belum dipilih; spesifikasi tetap diimpor tetapi gambarnya dilewati.",
    };
  }

  const stored = await storeImage(storageKey, candidate.imageUrl);
  if (!stored.ok) return stored;
  return saveAssetRow(productId, candidate, rights, retrievedAt, stored, existing, batchId, photos);
}

/**
 * Foto TAMBAHAN untuk galeri (mis. foto tiap warna dari listing toko).
 * Dikenali dari URL asli + warnanya: foto yang sama tidak diunggah dua kali,
 * dan galeri dibatasi per warna (photo-rules.ts).
 */
export async function importGalleryImage({
  productId,
  candidate,
  retrievedAt,
  batchId = null,
}: {
  productId: string;
  candidate: ProductImageCandidate;
  retrievedAt: string;
  batchId?: string | null;
}): Promise<ProductImageImportResult> {
  const rights = candidate.rights;
  if (!rights) return { ok: false, reason: "Dasar hak pakai foto belum dipilih." };

  const photos = await productPhotos(productId);
  if (!photos) return { ok: false, reason: "Foto lama produk gagal diperiksa." };

  const existing = findSamePhoto(photos, candidate.imageUrl, candidate.color);
  const storageKey = storageKeyFor(productId, candidate.imageUrl, existing?.color ?? candidate.color);
  if (existing?.storage_key === storageKey) return updateMetadataOnly(existing, photos, candidate);
  if (!existing) {
    const limit = galleryLimitIssue(photos, candidate.color);
    if (limit) return { ok: false, reason: limit };
  }

  const stored = await storeImage(storageKey, candidate.imageUrl);
  if (!stored.ok) return stored;
  return saveAssetRow(productId, candidate, rights, retrievedAt, stored, existing, batchId, photos);
}

export type OutdatedPhoto = {
  id: string;
  product_id: string;
  storage_key: string | null;
  original_url: string | null;
  alt: string;
  source: string;
  source_url: string | null;
  usage_rights: string;
  usage_basis: string;
  color: string | null;
};

/**
 * Foto yang dibuat pipeline versi lama (mis. sebelum latar putih dihapus) dan
 * masih punya URL asli, sehingga bisa diproses ulang otomatis.
 */
export async function listOutdatedPhotos(): Promise<
  { outdated: OutdatedPhoto[]; withoutOrigin: number } | { error: string }
> {
  const db = getInsforgeAdminClient().database;
  const rows: OutdatedPhoto[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("product_assets")
      .select("id, product_id, storage_key, original_url, alt, source, source_url, usage_rights, usage_basis, color")
      .eq("kind", "photo")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) return { error: "Daftar foto produk gagal dibaca." };
    rows.push(...((data ?? []) as OutdatedPhoto[]));
    if ((data ?? []).length < 1000) break;
  }
  return {
    withoutOrigin: rows.filter((row) => row.storage_key && !row.original_url).length,
    outdated: rows.filter(
      (row) => row.original_url && row.storage_key !== storageKeyFor(row.product_id, row.original_url, row.color)
    ),
  };
}

/**
 * Memproses ulang satu foto yang sudah tercatat, dengan hak pakai yang sudah
 * tercatat. Foto yang ternyata sudah versi terbaru dilewati sebagai "unchanged".
 */
export async function reprocessAssetPhoto(assetId: string, retrievedAt: string): Promise<ProductImageImportResult> {
  const { data, error } = await getInsforgeAdminClient()
    .database.from("product_assets")
    .select("id, product_id, storage_key, original_url, alt, source, source_url, usage_rights, usage_basis, color")
    .eq("id", assetId)
    .limit(1);
  const row = (data ?? [])[0] as OutdatedPhoto | undefined;
  if (error || !row) return { ok: false, reason: "Foto ini sudah tidak ada." };
  if (!row.original_url) return { ok: false, reason: "Foto tidak menyimpan URL asli; impor ulang lewat CSV spesifikasi." };

  const storageKey = storageKeyFor(row.product_id, row.original_url, row.color);
  if (row.storage_key === storageKey) return { ok: true, outcome: "unchanged" };
  const stored = await storeImage(storageKey, row.original_url);
  if (!stored.ok) return stored;
  const rights: ImageRights = {
    basis: isImageUsageBasis(row.usage_basis) ? row.usage_basis : "admin-declared",
    text: row.usage_rights,
  };
  return saveAssetRow(
    row.product_id,
    { imageUrl: row.original_url, source: row.source, sourceUrl: row.source_url ?? row.original_url, alt: row.alt, rights, color: row.color },
    rights,
    retrievedAt,
    stored,
    { id: row.id, storage_key: row.storage_key, original_url: row.original_url, color: row.color, is_cover: false },
    null
  );
}
