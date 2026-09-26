import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectAll } from "@/lib/backend/paged-read";

/**
 * Memetakan URL listing ke toko terdaftar (tabel `stores`) lewat domainnya,
 * termasuk subdomain (www.oppo.com → oppo.com). Listing dari domain yang belum
 * terdaftar tetap boleh disimpan dengan `store_id` null; tokonya bisa
 * didaftarkan belakangan tanpa mengubah penawarannya.
 */
export type StoreResolver = (url: string) => string | null;

export async function loadStoreResolver(): Promise<StoreResolver> {
  const rows = await selectAll("stores", "id, hosts");
  const stores = rows.map((row) => ({
    id: String(row.id),
    hosts: ((row.hosts as string[] | null) ?? []).map((host) => host.toLowerCase()),
  }));

  return (url) => {
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
    const store = stores.find((entry) =>
      entry.hosts.some((known) => host === known || host.endsWith(`.${known}`))
    );
    return store?.id ?? null;
  };
}

/**
 * Slug lama → id produk, untuk berkas CSV yang masih memakai slug sebelum
 * diganti (mis. "samsung-galaxy-s25" untuk Galaxy S25+). Tabelnya kecil dan
 * tidak punya kolom `id`, jadi dibaca langsung, bukan lewat `selectAll`.
 */
export async function loadSlugRedirects(): Promise<Map<string, string>> {
  const { data, error } = await getInsforgeAdminClient()
    .database.from("product_slug_redirects")
    .select("old_slug, product_id")
    .order("old_slug", { ascending: true })
    .range(0, 4999);
  if (error) throw new Error("Gagal membaca redirect slug produk.");
  return new Map(
    ((data ?? []) as { old_slug: string; product_id: string }[]).map((row) => [
      row.old_slug,
      row.product_id,
    ])
  );
}
