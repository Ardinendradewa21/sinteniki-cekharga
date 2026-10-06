import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import {
  CONTRACT_FILE_MAX_BYTES,
  CREATIVE_IMAGE_MAX_BYTES,
  CREATIVE_IMAGE_TYPES,
  matchesSlotRatio,
} from "@/lib/ads/admin-schema";

/**
 * Unggahan berkas modul iklan.
 *
 * - Materi iklan → bucket publik `ad-creatives` (ditayangkan ke pengunjung).
 * - PKS bertanda tangan → bucket privat `ad-contracts`; hanya dibuka lewat
 *   signed URL berumur pendek dari route admin.
 *
 * Isi berkas diperiksa dari byte-nya (magic number / sharp), bukan dari
 * nama atau MIME yang dikirim browser.
 */

export const CREATIVE_BUCKET = "ad-creatives";
export const CONTRACT_BUCKET = "ad-contracts";

type Uploaded = { ok: true; key: string; url: string } | { ok: false; reason: string };

function isFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && value.size > 0;
}

export function fileFrom(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return isFile(value) ? value : null;
}

export async function uploadCreativeImage(
  file: File,
  options: { lineItemId: string; slotSize: string | null; label: string; checkRatio: boolean }
): Promise<Uploaded> {
  if (file.size > CREATIVE_IMAGE_MAX_BYTES) {
    return { ok: false, reason: `${options.label}: berat maksimal ${CREATIVE_IMAGE_MAX_BYTES / 1024} KB.` };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(bytes, { animated: true }).metadata();
  } catch {
    return { ok: false, reason: `${options.label}: berkas bukan gambar yang valid.` };
  }
  const mime = meta.format === "jpeg" ? "image/jpeg" : `image/${meta.format}`;
  if (!(CREATIVE_IMAGE_TYPES as readonly string[]).includes(mime) || !meta.width) {
    return { ok: false, reason: `${options.label}: format harus PNG, JPG, WebP, atau GIF.` };
  }
  // Untuk GIF animasi, sharp melaporkan tinggi total semua frame.
  const height = meta.pageHeight ?? meta.height ?? 0;
  if (options.checkRatio && !matchesSlotRatio({ width: meta.width, height }, options.slotSize)) {
    return {
      ok: false,
      reason: `${options.label}: ukuran ${meta.width}×${height} tidak sesuai slot ${options.slotSize?.replace("x", "×")} (boleh 2× untuk layar retina).`,
    };
  }

  const ext = meta.format === "jpeg" ? "jpg" : meta.format;
  const key = `creatives/${options.lineItemId}/${randomUUID()}.${ext}`;
  const bucket = getInsforgeAdminClient().storage.from(CREATIVE_BUCKET);
  const uploaded = await bucket.upload(key, new Blob([bytes], { type: mime }));
  if (uploaded.error || !uploaded.data) {
    return { ok: false, reason: `${options.label}: gagal disimpan ke Storage.` };
  }
  const stored = uploaded.data as { key?: string; url?: string };
  const storedKey = stored.key || key;
  const url = stored.url || bucket.getPublicUrl(storedKey).data?.publicUrl;
  if (!url) {
    await bucket.remove(storedKey);
    return { ok: false, reason: `${options.label}: Storage tidak mengembalikan URL publik.` };
  }
  return { ok: true, key: storedKey, url };
}

export async function uploadContractPdf(file: File, contractNumber: string): Promise<Uploaded> {
  if (file.size > CONTRACT_FILE_MAX_BYTES) {
    return { ok: false, reason: "Berkas PKS maksimal 10 MB." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { ok: false, reason: "Berkas PKS harus PDF." };
  }
  const safe = contractNumber.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "pks";
  const key = `contracts/${safe}-${randomUUID()}.pdf`;
  const bucket = getInsforgeAdminClient().storage.from(CONTRACT_BUCKET);
  const uploaded = await bucket.upload(key, new Blob([bytes], { type: "application/pdf" }));
  if (uploaded.error || !uploaded.data) return { ok: false, reason: "PKS gagal disimpan ke Storage." };
  const stored = uploaded.data as { key?: string };
  return { ok: true, key: stored.key || key, url: "" };
}

export async function removeObjects(bucket: string, keys: (string | null | undefined)[]): Promise<void> {
  const storage = getInsforgeAdminClient().storage.from(bucket);
  for (const key of keys) {
    if (!key) continue;
    const { error } = await storage.remove(key);
    if (error) console.error(`[iklan-admin] gagal menghapus ${bucket}/${key}:`, error);
  }
}

/** Kunci objek dari URL publik bucket ad-creatives (untuk dibersihkan saat materi dihapus). */
export function creativeKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/buckets/${CREATIVE_BUCKET}/objects/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length));
}
