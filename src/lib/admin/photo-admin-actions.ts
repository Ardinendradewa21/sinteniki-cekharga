"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/auth/dal";
import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { normalizeColorName } from "@/lib/import/colors";
import { galleryLimitIssue, groupPhotosByColor, movePhoto, type ManagedPhoto } from "@/lib/import/photo-rules";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/import/product-images";

/**
 * Aksi panel foto per warna di halaman admin produk (2026-10-12): ubah
 * urutan, jadikan sampul, pindah ke warna lain, dan hapus. Semua dicek hak
 * aksesnya di server (hanya admin), dicatat di audit, dan menginvalidasi
 * cache katalog supaya situs publik langsung mengikuti.
 */

export type PhotoActionState = { error: string | null; message: string | null };

const UUID = /^[0-9a-f-]{36}$/i;

function db() {
  return getInsforgeAdminClient().database;
}

type PhotoRow = ManagedPhoto & { product_id: string; storage_key: string | null };

async function productPhotos(productId: string): Promise<PhotoRow[] | null> {
  const { data, error } = await db()
    .from("product_assets")
    .select("id, product_id, original_url, color, sort_order, is_cover, created_at, storage_key")
    .eq("product_id", productId)
    .eq("kind", "photo");
  return error ? null : ((data ?? []) as PhotoRow[]);
}

function refresh(productId: string) {
  invalidateCatalogCache();
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/products", "layout");
}

function read(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  return UUID.test(productId) && UUID.test(photoId) ? { productId, photoId } : null;
}

/** Naik/turun satu posisi di antara foto non-sampul warna yang sama. */
export async function movePhotoAction(_prev: PhotoActionState, formData: FormData): Promise<PhotoActionState> {
  const admin = await requireStaff([]);
  const ids = read(formData);
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!ids) return { error: "Foto tidak dikenal.", message: null };
  const photos = await productPhotos(ids.productId);
  const photo = photos?.find((row) => row.id === ids.photoId);
  if (!photos || !photo) return { error: "Foto tidak ditemukan.", message: null };
  const group = groupPhotosByColor(photos).find((g) => g.photos.some((row) => row.id === photo.id))!;
  // Sampul selalu di depan; urutan hanya berlaku untuk foto lainnya.
  const order = group.photos.filter((row) => !row.is_cover).map((row) => row.id);
  const next = movePhoto(order, photo.id, direction);
  if (!next) return { error: null, message: null };
  const { error } = await db().rpc("admin_set_photo_order", { p_product: ids.productId, p_ids: next });
  if (error) return { error: "Urutan foto gagal disimpan.", message: null };
  await recordAudit(admin, "foto.urutan", "product", ids.productId, { foto: photo.id, arah: direction, warna: photo.color });
  refresh(ids.productId);
  return { error: null, message: "Urutan foto disimpan." };
}

export async function setCoverAction(_prev: PhotoActionState, formData: FormData): Promise<PhotoActionState> {
  const admin = await requireStaff([]);
  const ids = read(formData);
  if (!ids) return { error: "Foto tidak dikenal.", message: null };
  const { data, error } = await db().rpc("admin_set_photo_cover", { p_id: ids.photoId });
  if (error || data === false) return { error: "Sampul gagal disimpan.", message: null };
  await recordAudit(admin, "foto.sampul", "product", ids.productId, { foto: ids.photoId });
  refresh(ids.productId);
  return { error: null, message: "Sampul warna diperbarui." };
}

/** Pindah ke warna lain (atau "tanpa warna"); tunduk pada batas per warna. */
export async function changePhotoColorAction(_prev: PhotoActionState, formData: FormData): Promise<PhotoActionState> {
  const admin = await requireStaff([]);
  const ids = read(formData);
  if (!ids) return { error: "Foto tidak dikenal.", message: null };
  const raw = String(formData.get("color") ?? "");
  const color = raw === "" ? null : normalizeColorName(raw);
  if (raw !== "" && !color) return { error: "Nama warna tidak valid.", message: null };
  const photos = await productPhotos(ids.productId);
  const photo = photos?.find((row) => row.id === ids.photoId);
  if (!photos || !photo) return { error: "Foto tidak ditemukan.", message: null };
  if ((photo.color ?? "").toLowerCase() === (color ?? "").toLowerCase()) return { error: null, message: null };
  const others = photos.filter((row) => row.id !== photo.id);
  const limit = galleryLimitIssue(others, color);
  if (limit) return { error: limit, message: null };
  const target = others.filter((row) => (row.color ?? "").toLowerCase() === (color ?? "").toLowerCase());
  const { error } = await db()
    .from("product_assets")
    .update({ color, is_cover: false, sort_order: target.reduce((max, row) => Math.max(max, row.sort_order + 1), 0) })
    .eq("id", photo.id)
    .eq("product_id", ids.productId);
  if (error) return { error: "Warna foto gagal diubah.", message: null };
  await recordAudit(admin, "foto.pindah-warna", "product", ids.productId, { foto: photo.id, dari: photo.color, ke: color });
  refresh(ids.productId);
  return { error: null, message: color ? `Foto dipindah ke warna ${color}.` : "Foto dijadikan foto umum (tanpa warna)." };
}

/** Hapus permanen: baris aset lalu objek storage-nya (foto bukan riwayat harga). */
export async function deletePhotoAction(_prev: PhotoActionState, formData: FormData): Promise<PhotoActionState> {
  const admin = await requireStaff([]);
  const ids = read(formData);
  if (!ids) return { error: "Foto tidak dikenal.", message: null };
  const { data, error } = await db()
    .from("product_assets")
    .delete()
    .eq("id", ids.photoId)
    .eq("product_id", ids.productId)
    .eq("kind", "photo")
    .select("storage_key, original_url, color");
  const removed = ((data ?? []) as { storage_key: string | null; original_url: string | null; color: string | null }[])[0];
  if (error || !removed) return { error: "Foto gagal dihapus.", message: null };
  if (removed.storage_key) {
    const gone = await getInsforgeAdminClient().storage.from(PRODUCT_IMAGE_BUCKET).remove(removed.storage_key);
    if (gone.error) console.error("[foto] objek storage gagal dihapus:", removed.storage_key, gone.error);
  }
  await recordAudit(admin, "foto.hapus", "product", ids.productId, {
    foto: ids.photoId,
    warna: removed.color,
    url_asli: removed.original_url,
  });
  refresh(ids.productId);
  return { error: null, message: "Foto dihapus." };
}
