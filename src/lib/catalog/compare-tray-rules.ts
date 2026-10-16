import { MAX_COMPARE_ITEMS } from "@/lib/catalog/compare-params";

/**
 * Aturan baki pilihan bandingkan di katalog (masukan PO 16 Okt 2026).
 * Pengguna memilih produk langsung dari kartu, lalu membuka halaman
 * perbandingan sekali jalan. Batasnya sama dengan halaman perbandingan.
 */

export type TrayItem = {
  slug: string;
  name: string;
  /** `null` bila produk belum punya foto. */
  image: string | null;
};

export type TrayToggle = { items: TrayItem[]; outcome: "added" | "removed" | "full" };

export function toggleTrayItem(items: readonly TrayItem[], item: TrayItem): TrayToggle {
  if (items.some((entry) => entry.slug === item.slug)) {
    return { items: items.filter((entry) => entry.slug !== item.slug), outcome: "removed" };
  }
  // Baki penuh: tolak, jangan diam-diam membuang pilihan lama.
  if (items.length >= MAX_COMPARE_ITEMS) return { items: [...items], outcome: "full" };
  return { items: [...items, item], outcome: "added" };
}

/** Isi sessionStorage bisa rusak atau dari versi lama: saring, jangan percaya. */
export function parseTrayItems(raw: string | null): TrayItem[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const items: TrayItem[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const { slug, name, image } = entry as Record<string, unknown>;
    if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seen.has(slug)) continue;
    if (typeof name !== "string" || !name.trim()) continue;
    seen.add(slug);
    items.push({ slug, name: name.slice(0, 120), image: typeof image === "string" && image ? image : null });
    if (items.length >= MAX_COMPARE_ITEMS) break;
  }
  return items;
}
