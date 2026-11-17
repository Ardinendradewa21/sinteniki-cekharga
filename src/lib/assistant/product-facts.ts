import "server-only";

import type { ProductCardView } from "@/lib/assistant/ai/chat-state";
import { buildCompareHref } from "@/lib/catalog/compare-href";
import { formatIdr, type PriceResolution } from "@/lib/catalog/pricing";
import { getComparison, getProductDetail } from "@/lib/catalog/queries";

/**
 * Fakta produk yang disebut pengguna, untuk menjawab pertanyaan tentang satu
 * produk ("harga Redmi Note 17 berapa?") atau perbandingan ("A6 Pro vs Redmi
 * Note 17 buat foto?") (VD-08).
 *
 * Sumbernya fungsi yang sama dengan halaman detail dan halaman perbandingan,
 * jadi angka yang dikatakan asisten identik dengan yang dilihat pengguna saat
 * membuka tautannya. Model hanya menerima teks fakta ini; nama dan angka di
 * balasannya diperiksa validator terhadap `allowedNames`/`allowedAmounts`.
 */

export type ProductFacts = {
  /** Teks fakta untuk model. */
  text: string;
  allowedNames: string[];
  allowedAmounts: number[];
  cards: ProductCardView[];
  /** Halaman perbandingan bila produknya dua atau tiga. */
  compareHref: string | null;
};

function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function priceText(price: PriceResolution): string {
  if (price.status === "available") return `${formatIdr(price.priceIdr)} (diperiksa ${dateLabel(price.checkedAt)})`;
  if (price.status === "stale") {
    return `harga terakhir tercatat ${formatIdr(price.priceIdr)} pada ${dateLabel(price.observedAt)}, belum diperiksa ulang`;
  }
  return "harga belum tersedia";
}

const priceAmount = (price: PriceResolution) => (price.status === "unavailable" ? null : price.priceIdr);

export async function productFacts(now: Date, slugs: readonly string[]): Promise<ProductFacts | null> {
  if (slugs.length === 0) return null;
  return slugs.length === 1 ? singleProduct(now, slugs[0]!) : comparison(now, slugs);
}

async function singleProduct(now: Date, slug: string): Promise<ProductFacts | null> {
  const detail = await getProductDetail(now, slug);
  if (!detail) return null;

  const lines = [`PRODUK: ${detail.name}`, "Varian dan harga (harga per kapasitas, bukan per warna):"];
  for (const variant of detail.variants) lines.push(`- ${variant.label}: ${priceText(variant.price)}`);
  const known = detail.specs.filter((row) => row.value !== null);
  const unknown = detail.specs.filter((row) => row.value === null).map((row) => row.label);
  lines.push("Spesifikasi tercatat:");
  for (const row of known) lines.push(`- ${row.label}: ${row.value}`);
  if (unknown.length) lines.push(`Belum diketahui: ${unknown.join(", ")}.`);
  lines.push(`Sumber spesifikasi: ${detail.specsSource}.`);
  if (detail.colors.length) lines.push(`Warna tercatat: ${detail.colors.map((color) => color.name).join(", ")}.`);
  if (detail.reviews.length) {
    lines.push("Ringkasan reviewer (pendapat, bukan pengujian CekHarga):");
    for (const review of detail.reviews.slice(0, 4)) {
      const extra = [
        review.strengths.length ? `kelebihan: ${review.strengths.join("; ")}` : null,
        review.limitations.length ? `keterbatasan: ${review.limitations.join("; ")}` : null,
      ].filter(Boolean);
      lines.push(
        `- ${review.channelName} (${review.aspect}${review.isSponsored ? ", video bersponsor" : ""}): ${review.summary}${extra.length ? ` (${extra.join(". ")})` : ""}`
      );
    }
  } else {
    lines.push("Belum ada ringkasan reviewer untuk produk ini.");
  }

  const base = detail.selectedVariant ?? detail.variants[0] ?? null;
  return {
    text: lines.join("\n"),
    allowedNames: [detail.name, detail.model],
    allowedAmounts: detail.variants.map((variant) => priceAmount(variant.price)).filter((value): value is number => value !== null),
    cards: [
      {
        slug: detail.slug,
        name: detail.name,
        variantLabel: base?.label ?? null,
        price: base?.price ?? detail.price,
        detailHref: `/products/${detail.slug}`,
        image: detail.image,
      },
    ],
    compareHref: null,
  };
}

async function comparison(now: Date, slugs: readonly string[]): Promise<ProductFacts | null> {
  const result = await getComparison(
    now,
    slugs.map((slug) => ({ slug, variantKey: null }))
  );
  if (result.items.length < 2) {
    return result.items.length === 1 ? singleProduct(now, result.items[0]!.slug) : null;
  }

  const names = result.items.map((item) => item.name);
  const lines = [
    `PERBANDINGAN: ${names.join(" vs ")}`,
    "Varian acuan dan harganya:",
    ...result.items.map((item) => `- ${item.name} ${item.variantLabel ?? "(varian acuan belum ada)"}: ${priceText(item.price)}`),
  ];
  if (result.priceSpread) {
    lines.push(
      result.priceSpread.differenceIdr === 0
        ? `Harga varian acuan sama: ${formatIdr(result.priceSpread.lowestPriceIdr)}.`
        : `Selisih harga varian acuan: ${result.priceSpread.mostExpensiveName} lebih tinggi ${formatIdr(result.priceSpread.differenceIdr)} daripada ${result.priceSpread.cheapestName}.`
    );
  }
  if (result.itemsWithoutPrice.length) lines.push(`Belum punya harga yang baru diperiksa: ${result.itemsWithoutPrice.join(", ")}.`);
  lines.push("Spesifikasi (urutan nilai sama dengan urutan produk di atas; [beda] = nilainya berbeda):");
  for (const row of result.rows) {
    if (row.values.every((value) => value === null)) continue;
    const values = row.values.map((value) => value ?? "belum diketahui").join(" | ");
    lines.push(`- ${row.label}${row.state === "different" ? " [beda]" : ""}: ${values}`);
  }
  const notes = result.items.flatMap((item) =>
    item.reviewNotes.map((note) => `- ${item.name}, ${note.channelName} (${note.aspect}): ${note.summary}`)
  );
  lines.push(notes.length ? "Ringkasan reviewer:" : "Belum ada ringkasan reviewer untuk produk ini.");
  lines.push(...notes);

  const amounts = [
    ...result.items.map((item) => priceAmount(item.price)),
    result.priceSpread?.differenceIdr ?? null,
    result.priceSpread?.lowestPriceIdr ?? null,
  ].filter((value): value is number => value !== null && value > 0);

  return {
    text: lines.join("\n"),
    allowedNames: result.items.flatMap((item) => [item.name, item.model]),
    allowedAmounts: amounts,
    cards: result.items.map((item) => ({
      slug: item.slug,
      name: item.name,
      variantLabel: item.variantLabel,
      price: item.price,
      detailHref: item.detailHref,
      image: item.image,
    })),
    compareHref: buildCompareHref(result.items.map((item) => ({ slug: item.slug, variantKey: item.variantKey }))),
  };
}
