import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectWhereIn } from "@/lib/backend/paged-read";
import type { PairSlugs } from "@/lib/catalog/compare-pair-rules";

/**
 * Pasangan perbandingan pilihan admin (PB-28), dibaca di server.
 *
 * Hanya pasangan yang KEDUA produknya terbit dan belum dihapus yang dikembalikan,
 * jadi halaman "A vs B" otomatis hilang bila salah satu produk ditarik.
 * Tabelnya tertutup untuk anon (RLS), sehingga dibaca dengan kunci server.
 */

export type ComparePair = PairSlugs & {
  id: string;
  nameA: string;
  nameB: string;
  createdAt: string;
};

/**
 * Tag cache pasangan. Pasangan juga ikut tag `catalog`, karena status terbit
 * produk menentukan pasangan mana yang tampil; setiap perubahan katalog ikut
 * menyegarkannya.
 */
const COMPARE_PAIRS_TAG = "compare-pairs";

export const listComparePairs = unstable_cache(fetchComparePairs, ["compare-pairs", "v1"], {
  tags: [COMPARE_PAIRS_TAG, "catalog"],
  revalidate: 3600,
});

/** Dipanggil aksi admin pasangan; request berikutnya langsung membaca data baru. */
export function invalidateComparePairs(): void {
  revalidateTag(COMPARE_PAIRS_TAG, { expire: 0 });
}

async function fetchComparePairs(): Promise<ComparePair[]> {
  const { data, error } = await getInsforgeAdminClient()
    .database.from("compare_pairs")
    .select("id, product_a, product_b, created_at")
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error("Pasangan perbandingan gagal dibaca.");
  const rows = (data ?? []) as { id: string; product_a: string; product_b: string; created_at: string }[];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.flatMap((row) => [row.product_a, row.product_b]))];
  const products = (await selectWhereIn("products", "id, slug, brand, model, status", "id", ids)) as {
    id: string;
    slug: string;
    brand: string;
    model: string;
    status: string;
  }[];
  const published = new Map(products.filter((product) => product.status === "published").map((product) => [product.id, product]));

  return rows.flatMap((row) => {
    const a = published.get(row.product_a);
    const b = published.get(row.product_b);
    if (!a || !b) return [];
    return [
      {
        id: row.id,
        a: a.slug,
        b: b.slug,
        nameA: `${a.brand} ${a.model}`,
        nameB: `${b.brand} ${b.model}`,
        createdAt: row.created_at,
      },
    ];
  });
}
