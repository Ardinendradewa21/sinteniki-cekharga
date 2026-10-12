import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { groupPhotosByColor, type ManagedPhoto } from "@/lib/import/photo-rules";

/**
 * Foto satu produk untuk panel admin, dikelompokkan per warna (photo-rules.ts),
 * beserta pilihan warna untuk "pindah ke warna lain": warna foto yang ada
 * ditambah daftar warna spesifikasi produk.
 */

export type AdminPhoto = ManagedPhoto & {
  src: string;
  alt: string;
  source: string;
  usage_basis: string;
  storage_key: string | null;
};

export async function listProductPhotos(productId: string): Promise<{
  groups: { color: string | null; photos: AdminPhoto[] }[];
  colorChoices: string[];
} | null> {
  const db = getInsforgeAdminClient().database;
  const [photos, product] = await Promise.all([
    db
      .from("product_assets")
      .select("id, src, alt, source, usage_basis, storage_key, original_url, color, sort_order, is_cover, created_at")
      .eq("product_id", productId)
      .eq("kind", "photo"),
    db.from("products").select("specs").eq("id", productId).limit(1),
  ]);
  if (photos.error || product.error) return null;
  const rows = (photos.data ?? []) as AdminPhoto[];
  const specColors = ((product.data ?? [])[0] as { specs?: { colorOptions?: unknown } } | undefined)?.specs?.colorOptions;
  const choices = new Map<string, string>();
  for (const color of [...rows.map((row) => row.color), ...(Array.isArray(specColors) ? specColors : [])]) {
    if (typeof color === "string" && color.trim()) choices.set(color.trim().toLowerCase(), color.trim());
  }
  return { groups: groupPhotosByColor(rows), colorChoices: [...choices.values()].sort((a, b) => a.localeCompare(b, "id")) };
}
