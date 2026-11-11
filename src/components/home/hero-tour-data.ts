import { formatCheckedAt, formatIdr } from "@/lib/catalog/pricing";
import type { ComparisonExample, ProductSummary } from "@/lib/catalog/queries";

/**
 * Data untuk cuplikan fitur di hero (Sprint 13 S13-3).
 *
 * Semua angka berasal dari katalog aktif dan sudah diformat di server, supaya
 * label waktu relatif tidak berbeda antara render server dan klien. Adegan yang
 * datanya tidak ada bernilai `null` dan tidak ditampilkan, alih-alih diisi
 * contoh karangan.
 */

export type HeroTourData = {
  search: {
    query: string;
    filterLabel: string;
    results: { name: string; price: string; variant: string | null }[];
  } | null;
  compare: {
    items: { name: string; price: string }[];
    rows: { label: string; values: [string, string] }[];
  } | null;
  price: {
    brand: string;
    model: string;
    price: string;
    variant: string | null;
    checked: string;
    fresh: boolean;
  } | null;
};

const SEARCH_BUDGET_IDR = 5_000_000;

function priceLabel(price: ProductSummary["price"]): string {
  if (price.status === "available") return formatIdr(price.priceIdr);
  if (price.status === "stale") return `Terakhir ${formatIdr(price.priceIdr)}`;
  return "Harga belum tersedia";
}

export function buildHeroTour(
  products: readonly ProductSummary[],
  comparison: ComparisonExample | null,
  heroProduct: ProductSummary | null,
  now: Date
): HeroTourData {
  const underBudget = products
    .filter((product) => product.price.status === "available" && product.price.priceIdr <= SEARCH_BUDGET_IDR)
    .sort((a, b) => (a.price.status === "available" && b.price.status === "available" ? a.price.priceIdr - b.price.priceIdr : 0))
    .slice(0, 3);

  const search =
    underBudget.length > 0
      ? {
          query: "HP di bawah 5 juta",
          filterLabel: `Harga maksimum ${formatIdr(SEARCH_BUDGET_IDR)}`,
          results: underBudget.map((product) => ({
            name: product.name,
            price: priceLabel(product.price),
            variant: product.priceReferenceVariant,
          })),
        }
      : null;

  let compare: HeroTourData["compare"] = null;
  const [first, second] = comparison?.items ?? [];
  if (first && second) {
    const rows = first.attributes
      .map((attribute) => {
        const other = second.attributes.find((item) => item.label === attribute.label);
        return attribute.value && other?.value
          ? { label: attribute.label, values: [attribute.value, other.value] as [string, string] }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      // Baris yang berbeda didahulukan: di situlah komprominya terlihat.
      .sort((a, b) => Number(a.values[0] === a.values[1]) - Number(b.values[0] === b.values[1]))
      .slice(0, 3);
    if (rows.length > 0) {
      compare = {
        items: [first, second].map((item) => ({ name: item.name, price: priceLabel(item.price) })),
        rows,
      };
    }
  }

  const heroPrice = heroProduct?.price;
  const price =
    heroProduct && heroPrice && heroPrice.status !== "unavailable"
      ? {
          brand: heroProduct.brand,
          model: heroProduct.model,
          price: formatIdr(heroPrice.priceIdr),
          variant: heroProduct.priceReferenceVariant,
          checked:
            heroPrice.status === "available"
              ? `Diperiksa ${formatCheckedAt(heroPrice.checkedAt, now)}`
              : `Tercatat ${formatCheckedAt(heroPrice.observedAt, now)}, belum diperiksa ulang`,
          fresh: heroPrice.status === "available",
        }
      : null;

  return { search, compare, price };
}
