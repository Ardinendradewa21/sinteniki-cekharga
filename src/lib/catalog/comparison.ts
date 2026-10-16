import "server-only";

import { priceDifference, resolveStartingPrice, type PriceResolution, type StartingPriceResolution } from "@/lib/catalog/pricing";
import { buildCompareHref, MAX_COMPARE_ITEMS, type CompareSelection } from "@/lib/catalog/compare-params";
import { type ProductSummary, formatVariantLabel, findProductBySlug, loadPublishedCatalog } from "@/lib/catalog/core";
import { buildProductDetail } from "@/lib/catalog/product-detail";

/** Perbandingan produk (PRD FR-04): contoh di beranda dan halaman /compare. Tanpa skor atau pemenang. */

export type ComparisonItem = {
  id: string;
  slug: string;
  name: string;
  /** Varian yang menjadi basis harga, spesifikasi di bawah mengikuti varian ini. */
  variantLabel: string | null;
  price: StartingPriceResolution;
  attributes: { label: string; value: string | null }[];
};

export type ComparisonExample = {
  items: ComparisonItem[];
  /**
   * Selisih harga hanya terisi bila KEDUA harga layak (PRD FR-04). `null`
   * berarti tidak dapat dihitung, bukan nol.
   */
  differenceIdr: number | null;
};

/**
 * Contoh perbandingan untuk beranda. Sengaja memakai jalur data dan aturan yang
 * sama dengan halaman perbandingan nanti, supaya yang ditampilkan di beranda
 * bukan ilustrasi karangan.
 *
 * Spesifikasi yang ditampilkan mengikuti varian basis harga, supaya harga dan
 * spesifikasi tidak berasal dari varian berbeda (PRD §7 butir 3).
 */
export async function getComparisonExample(
  now: Date,
  slugs: readonly [string, string]
): Promise<ComparisonExample | null> {
  const catalog = await loadPublishedCatalog(now);

  const items: ComparisonItem[] = [];

  for (const slug of slugs) {
    const product = catalog.products.find((candidate) => candidate.slug === slug);
    if (!product) return null;

    const variants = catalog.variants.filter(
      (variant) => variant.productId === product.id
    );

    const price = resolveStartingPrice({
      variants,
      offers: catalog.offers,
      observations: catalog.priceObservations,
      checks: catalog.priceChecks,
      now,
    });

    const variant =
      variants.find((candidate) => candidate.id === price.referenceVariantId) ??
      null;

    items.push({
      id: product.id,
      slug: product.slug,
      name: `${product.brand} ${product.model}`,
      variantLabel: variant ? formatVariantLabel(variant) : null,
      price,
      attributes: [
        { label: "RAM", value: variant ? `${variant.ramGb} GB` : null },
        {
          label: "Penyimpanan",
          value: variant ? `${variant.storageGb} GB` : null,
        },
        {
          label: "Layar",
          value: product.specs.displayInches
            ? `${product.specs.displayInches}" ${product.specs.displayTechnology ?? ""}`.trim()
            : null,
        },
        {
          label: "Baterai",
          value: product.specs.batteryMah
            ? `${product.specs.batteryMah} mAh`
            : null,
        },
        { label: "Garansi", value: variant?.region ?? null },
      ],
    });
  }

  const [first, second] = items;

  return {
    items,
    differenceIdr:
      first && second ? priceDifference(first.price, second.price) : null,
  };
}


type CompareRowState = "same" | "different" | "incomplete";

/** Ikon garis per atribut; digambar sendiri di `compare/spec-icons.tsx`. */
export type CompareSpecIcon =
  | "display"
  | "refresh"
  | "chip"
  | "os"
  | "camera"
  | "lenses"
  | "battery"
  | "charging"
  | "memory"
  | "storage"
  | "weight"
  | "water"
  | "palette"
  | "network"
  | "nfc"
  | "jack"
  | "calendar"
  | "shield";

export type CompareRow = {
  label: string;
  state: CompareRowState;
  /** Nilai per item, urutannya sama dengan urutan item. */
  values: (string | null)[];
  icon: CompareSpecIcon;
  /** Nilai pendek yang ditampilkan besar (mis. "5G", "5000 mAh"). */
  headline: boolean;
};

export type CompareSection = {
  id: string;
  title: string;
  rows: CompareRow[];
};

export type CompareItem = {
  slug: string;
  name: string;
  brand: string;
  model: string;
  image: ProductSummary["image"];
  variantLabel: string | null;
  variantKey: string | null;
  price: PriceResolution;
  detailHref: string;
  removeHref: string;
  /** Varian lain untuk produk ini, supaya bisa ditukar tanpa keluar halaman. */
  variantOptions: {
    key: string;
    label: string;
    href: string;
    ramGb: number;
    storageGb: number;
  }[];
  /** Konteks pengalaman reviewer (PRD FR-04 meminta ini ikut ditampilkan). */
  reviewNotes: { channelName: string; aspect: string; summary: string }[];
};

export type CompareResult = {
  items: CompareItem[];
  /** Semua baris, datar. Sama isinya dengan gabungan `sections`. */
  rows: CompareRow[];
  /** Baris yang dikelompokkan per bagian (Layar, Kamera, ...). */
  sections: CompareSection[];
  /** Pilihan yang sudah diselesaikan, untuk menukar produk per kolom. */
  selections: CompareSelection[];
  /**
   * Selisih harga hanya terisi bila MINIMAL DUA item punya harga layak
   * (PRD FR-04). Item tanpa harga layak tidak pernah ikut dihitung.
   */
  priceSpread: {
    differenceIdr: number;
    cheapestName: string;
    mostExpensiveName: string;
    comparedCount: number;
  } | null;
  /** Nama item yang tidak punya harga layak, dinyatakan terbuka. */
  itemsWithoutPrice: string[];
  /** Produk lain yang masih bisa ditambahkan. */
  addable: { slug: string; name: string; href: string }[];
  isFull: boolean;
};

/**
 * Susunan bagian perbandingan, meniru pola "Spesifikasi Utama" situs resmi
 * produsen: dikelompokkan per topik, bukan satu daftar panjang. Label baris
 * sama dengan label `ProductDetail.specs`, kecuali RAM, Penyimpanan, dan
 * Garansi yang diambil dari varian terpilih.
 */
const COMPARE_SECTIONS: {
  id: string;
  title: string;
  rows: { label: string; icon: CompareSpecIcon; headline?: boolean }[];
}[] = [
  {
    id: "layar",
    title: "Layar",
    rows: [
      { label: "Layar", icon: "display" },
      { label: "Refresh rate", icon: "refresh" },
    ],
  },
  {
    id: "kamera",
    title: "Kamera",
    rows: [
      { label: "Kamera utama", icon: "camera", headline: true },
      { label: "Susunan kamera", icon: "lenses" },
    ],
  },
  {
    id: "performa",
    title: "Performa",
    rows: [
      { label: "Chipset", icon: "chip" },
      { label: "Sistem operasi", icon: "os" },
    ],
  },
  {
    id: "baterai",
    title: "Baterai",
    rows: [
      { label: "Baterai", icon: "battery", headline: true },
      { label: "Pengisian", icon: "charging" },
    ],
  },
  {
    id: "memori",
    title: "Memori varian terpilih",
    rows: [
      { label: "RAM", icon: "memory", headline: true },
      { label: "Penyimpanan", icon: "storage", headline: true },
    ],
  },
  {
    id: "desain",
    title: "Desain dan ketahanan",
    rows: [
      { label: "Bobot", icon: "weight" },
      { label: "Ketahanan (IP rating)", icon: "water" },
      { label: "Pilihan warna", icon: "palette" },
    ],
  },
  {
    id: "konektivitas",
    title: "Konektivitas",
    rows: [
      { label: "Jaringan", icon: "network", headline: true },
      { label: "NFC", icon: "nfc" },
      { label: "Jack headphone 3.5mm", icon: "jack" },
    ],
  },
  {
    id: "lainnya",
    title: "Lainnya",
    rows: [
      { label: "Tahun rilis", icon: "calendar" },
      { label: "Garansi", icon: "shield" },
    ],
  },
];

/**
 * Menyusun perbandingan 2-3 kandidat (PRD FR-04).
 *
 * Yang ditegakkan di sini:
 *
 * - Tidak ada skor, peringkat, atau pemenang. Fungsi ini hanya melaporkan
 *   nilainya dan apakah nilainya berbeda.
 * - Atribut yang salah satu nilainya tidak diketahui ditandai `incomplete`,
 *   bukan `different`, supaya UI tidak menampilkannya seolah keunggulan atau
 *   kekurangan.
 * - Spesifikasi mengikuti varian yang dipilih untuk tiap produk, sehingga
 *   harga dan spesifikasi selalu berasal dari varian yang sama.
 */
export async function getComparison(
  now: Date,
  selections: CompareSelection[]
): Promise<CompareResult> {
  const catalog = await loadPublishedCatalog(now);

  const details = selections
    .map((selection) => {
      // Tautan bandingkan lama dengan slug yang sudah diganti tetap berfungsi.
      const product = findProductBySlug(catalog, selection.slug);
      if (!product) return null;
      return {
        selection,
        detail: buildProductDetail(
          catalog,
          product,
          selection.variantKey ?? undefined,
          now
        ),
      };
    })
    .filter((entry) => entry !== null);

  const resolvedSelections: CompareSelection[] = details.map((entry) => ({
    slug: entry.detail.slug,
    variantKey: entry.detail.selectedVariant?.key ?? null,
  }));

  const items: CompareItem[] = details.map((entry, index) => {
    const { detail } = entry;

    const others = resolvedSelections.filter((_, other) => other !== index);

    return {
      slug: detail.slug,
      name: detail.name,
      brand: detail.brand,
      model: detail.model,
      image: detail.image,
      variantLabel: detail.selectedVariant?.label ?? null,
      variantKey: detail.selectedVariant?.key ?? null,
      price: detail.price,
      detailHref: detail.selectedVariant
        ? `/products/${detail.slug}?varian=${detail.selectedVariant.key}`
        : `/products/${detail.slug}`,
      removeHref: buildCompareHref(others),
      variantOptions: detail.variants.map((variant) => ({
        key: variant.key,
        label: variant.label,
        ramGb: variant.ramGb,
        storageGb: variant.storageGb,
        href: buildCompareHref(
          resolvedSelections.map((selection, other) =>
            other === index
              ? { slug: detail.slug, variantKey: variant.key }
              : selection
          )
        ),
      })),
      reviewNotes: detail.reviews.map((review) => ({
        channelName: review.channelName,
        aspect: review.aspect,
        summary: review.summary,
      })),
    };
  });

  const buildRow = ({
    label,
    icon,
    headline = false,
  }: (typeof COMPARE_SECTIONS)[number]["rows"][number]): CompareRow => {
    const values = details.map((entry) => {
      const { detail } = entry;

      if (label === "RAM") {
        return detail.selectedVariant
          ? `${detail.selectedVariant.ramGb} GB`
          : null;
      }
      if (label === "Penyimpanan") {
        return detail.selectedVariant
          ? `${detail.selectedVariant.storageGb} GB`
          : null;
      }
      if (label === "Garansi") {
        return detail.selectedVariant?.region ?? null;
      }
      return detail.specs.find((spec) => spec.label === label)?.value ?? null;
    });

    const hasUnknown = values.some((value) => value === null);
    const allEqual = values.every((value) => value === values[0]);

    return {
      label,
      values,
      icon,
      headline,
      state: hasUnknown ? "incomplete" : allEqual ? "same" : "different",
    };
  };
  const sections: CompareSection[] = COMPARE_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    rows: section.rows.map(buildRow),
  }));
  const rows = sections.flatMap((section) => section.rows);

  const priced = items.filter(
    (item): item is CompareItem & { price: { priceIdr: number } } =>
      item.price.status === "available"
  );

  const priceSpread =
    priced.length >= 2
      ? (() => {
          const sorted = [...priced].sort(
            (a, b) => a.price.priceIdr - b.price.priceIdr
          );
          const cheapest = sorted[0];
          const mostExpensive = sorted[sorted.length - 1];
          return {
            differenceIdr: mostExpensive.price.priceIdr - cheapest.price.priceIdr,
            cheapestName: cheapest.name,
            mostExpensiveName: mostExpensive.name,
            comparedCount: priced.length,
          };
        })()
      : null;

  const chosenSlugs = new Set(items.map((item) => item.slug));

  const addable = catalog.products
    .filter((product) => !chosenSlugs.has(product.slug))
    .map((product) => ({
      slug: product.slug,
      name: `${product.brand} ${product.model}`,
      href: buildCompareHref([
        ...resolvedSelections,
        { slug: product.slug, variantKey: null },
      ]),
    }));

  return {
    items,
    rows,
    sections,
    selections: resolvedSelections,
    priceSpread,
    itemsWithoutPrice: items
      .filter((item) => item.price.status !== "available")
      .map((item) => item.name),
    addable,
    isFull: items.length >= MAX_COMPARE_ITEMS,
  };
}
