/**
 * Pengelompokan dan status pratinjau batch (langkah 5 rancangan impor
 * terpadu). Murni, dipakai komponen tinjauan dan unit test.
 *
 * Pratinjau dikelompokkan PER PRODUK: satu kartu berisi produk (batch
 * spesifikasi) atau semua penawaran produk itu (batch penawaran), supaya admin
 * meninjau satu ponsel sekaligus, bukan baris demi baris yang tercecer.
 */

export type PlanAction = "create" | "update" | "unchanged" | "skip";

export type ReviewItem = {
  id: string;
  entity: "product" | "offer" | "photo";
  action: PlanAction;
  label: string;
  reason: string | null;
  view: Record<string, unknown>;
  changes: { field: string; before: string | null; after: string | null }[];
  /** Diisi setelah batch diantrekan. */
  selected?: boolean;
  result?: "pending" | "done" | "failed" | "skipped" | null;
  resultAction?: "created" | "updated" | "unchanged" | null;
  resultMessage?: string | null;
};

/**
 * Status tinjauan, lebih rinci dari aksi rencana:
 *   stale  = harga lebih tua dari harga terakhir; hanya masuk riwayat;
 *   review = perlu dilihat manusia sebelum diterapkan (varian disimpulkan
 *            dari judul, nama cocok padahal ada model saudara 4G/5G, atau
 *            data terhapus yang akan dipulihkan).
 */
export type ReviewStatus = "create" | "update" | "stale" | "review" | "unchanged" | "skip";

export const REVIEW_STATUS_ORDER: readonly ReviewStatus[] = ["create", "update", "stale", "review", "unchanged", "skip"];

export function reviewStatus(item: Pick<ReviewItem, "action" | "view" | "changes">): ReviewStatus {
  if (item.action === "skip") return "skip";
  if (item.action === "unchanged") return "unchanged";
  if (item.view.priceStale) return "stale";
  const restored = item.changes.some((change) => change.field === "Status data");
  if (item.view.inferredVariant || item.view.productReview || restored) return "review";
  return item.action;
}

/** Terpilih otomatis: baru, berubah, dan harga lama. "Perlu tinjau" dicentang manual. */
export function selectedByDefault(item: ReviewItem): boolean {
  const status = reviewStatus(item);
  return status === "create" || status === "update" || status === "stale";
}

export type ReviewGroup = {
  key: string;
  title: string;
  items: ReviewItem[];
};

function groupOf(item: ReviewItem): { key: string; title: string } {
  if (item.entity === "product") {
    const key = String(item.view.sourceKey ?? item.label);
    return { key: `product:${key}`, title: item.label };
  }
  const product = String(item.view.product ?? item.label);
  // Foto galeri dikelompokkan per produk juga; isinya urut per warna lalu urutan foto.
  return { key: `${item.entity}:${product}`, title: product };
}

/** Kelompok per produk, urut kemunculan pertama di rencana; isi kelompok urut varian. */
export function groupReviewItems(items: readonly ReviewItem[]): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  for (const item of items) {
    const { key, title } = groupOf(item);
    const group = groups.get(key) ?? { key, title, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.items.sort((a, b) => String(a.view.variant ?? "").localeCompare(String(b.view.variant ?? ""), "id", { numeric: true }));
  }
  return [...groups.values()];
}

export function countByStatus(items: readonly ReviewItem[]): Record<ReviewStatus | "all", number> {
  const counts: Record<ReviewStatus | "all", number> = { all: items.length, create: 0, update: 0, stale: 0, review: 0, unchanged: 0, skip: 0 };
  for (const item of items) counts[reviewStatus(item)] += 1;
  return counts;
}
