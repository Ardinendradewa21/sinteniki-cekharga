import "server-only";

import { buildColorOptions, type ProductColorOption } from "@/lib/catalog/colors";
import { isFresh, isPriceableListing, lastSuccessfulCheckAt, latestObservation, resolveStartingPrice, resolveVariantPrice, type PriceResolution } from "@/lib/catalog/pricing";
import type { CatalogDataset, Offer, ProductSpecs } from "@/lib/catalog/schema";
import { type ProductSummary, formatVariantLabel, loadPublishedCatalog, variantKey } from "@/lib/catalog/core";

/** View model halaman detail produk (PRD FR-03, FR-05): varian, warna, penawaran, spesifikasi, ulasan. */

export type ProductDetailVariant = {
  id: string;
  key: string;
  label: string;
  ramGb: number;
  storageGb: number;
  /** `null` = atribut pembeda lain tidak tercatat, bukan berarti tidak ada. */
  region: string | null;
  href: string;
  isSelected: boolean;
  /** Harga varian ini sendiri, supaya pemilih varian jujur soal ketersediaan. */
  price: PriceResolution;
};

export type ProductDetailOffer = {
  id: string;
  marketplace: string;
  sellerName: string;
  url: string;
  warranty: string | null;
  listingStatus: Offer["listingStatus"];
  sellerVerified: boolean;
  priceIdr: number | null;
  observedAt: string | null;
  /** Waktu pemeriksaan BERHASIL terakhir; percobaan gagal tidak menggesernya. */
  checkedAt: string | null;
  isFreshPrice: boolean;
  /** Penawaran inilah yang menjadi dasar harga aktif varian terpilih. */
  isPriceBasis: boolean;
  /** Toko terdaftar; `null` bila domain listing belum dikenal. */
  store: { slug: string; name: string; kind: "official" | "marketplace" | "retailer" } | null;
  /** Warna yang tercatat di listing ini; kosong = tidak diketahui. */
  colors: string[];
};

export type ProductDetailColor = ProductColorOption & { href: string };

/** Alamat halaman detail dengan varian dan warna terpilih. */
function detailHref(slug: string, variant: string | null, color: string | null): string {
  const params = new URLSearchParams();
  if (variant) params.set("varian", variant);
  if (color) params.set("warna", color);
  const query = params.toString();
  return query ? `/products/${slug}?${query}` : `/products/${slug}`;
}

export type ProductSpecRow = {
  label: string;
  /** `null` berarti belum diketahui, bukan tidak ada dan bukan nol. */
  value: string | null;
};

export type ProductReview = {
  id: string;
  channelName: string;
  videoUrl: string;
  publishedAt: string;
  timestampSeconds: number | null;
  aspect: string;
  summary: string;
  strengths: string[];
  limitations: string[];
  testContext: string | null;
  /** Review yang terikat varian tertentu, supaya konteksnya tidak digeneralisir. */
  variantLabel: string | null;
};

export type ProductDetail = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  name: string;
  image: ProductSummary["image"];
  /**
   * Semua foto produk asli, foto utama lebih dulu. Kosong bila produk hanya
   * punya ilustrasi generik; ilustrasi tidak pernah dicampur ke galeri foto.
   */
  gallery: { src: string; alt: string; source: string }[];
  /**
   * Warna yang tercatat (foto dan listing toko). Memilih warna hanya mengganti
   * foto; harga tetap per varian memori (PRD §7).
   */
  colors: ProductDetailColor[];
  selectedColor: ProductDetailColor | null;
  specs: ProductSpecRow[];
  specsSource: string;
  specsRetrievedAt: string;
  variants: ProductDetailVariant[];
  selectedVariant: ProductDetailVariant | null;
  /** Harga varian TERPILIH, bukan harga terendah lintas varian (PRD §7 butir 3). */
  price: PriceResolution;
  offers: ProductDetailOffer[];
  /**
   * Ringkasan penawaran SEGAR di semua varian (untuk judul halaman dan data
   * terstruktur). null bila tidak ada harga segar: halaman tidak boleh
   * mengklaim harga terkini dari catatan lama.
   */
  freshOfferSummary: { lowPriceIdr: number; highPriceIdr: number; offerCount: number; storeCount: number; checkedAt: string } | null;
  reviews: ProductReview[];
};

/**
 * Merangkai susunan kamera belakang jadi satu kalimat pendek, mis. "Triple
 * kamera (ultrawide, telefoto 3.5x)". `null` kalau jumlah lensa tidak
 * diketahui — flag ultrawide/telefoto yang diketahui tanpa jumlah lensa tidak
 * cukup untuk menyusun kalimat yang jujur, jadi baris ini ikut kosong.
 */
function formatCameraArrangement(specs: ProductSpecs): string | null {
  if (specs.cameraLensCount === null) return null;

  const COUNT_LABEL: Record<number, string> = {
    1: "Kamera tunggal",
    2: "Dual kamera",
    3: "Triple kamera",
    4: "Quad kamera",
  };
  const base = COUNT_LABEL[specs.cameraLensCount] ?? `${specs.cameraLensCount} kamera`;

  const notes: string[] = [];
  if (specs.cameraHasUltrawide) notes.push("ultrawide");
  if (specs.cameraHasTelephoto) {
    notes.push(
      specs.cameraOpticalZoomX
        ? `telefoto ${specs.cameraOpticalZoomX}x`
        : "telefoto"
    );
  }

  return notes.length > 0 ? `${base} (${notes.join(", ")})` : base;
}

/**
 * Detail satu produk untuk `/products/[slug]` (PRD FR-03 dan FR-05).
 *
 * Yang ditegakkan di sini:
 *
 * - Halaman detail memakai harga VARIAN TERPILIH, bukan "mulai dari" lintas
 *   varian. PRD §7 butir 3 melarang mencampur basis harga diam-diam.
 * - Penawaran yang ditampilkan hanya milik varian terpilih, sehingga listing
 *   varian lain tidak pernah jadi basis harga (PRD FR-05).
 * - Penawaran yang tidak layak (habis, ambigu, nonaktif) tetap ditampilkan agar
 *   pengguna tahu keberadaannya, tapi ditandai dan tidak menjadi dasar harga.
 * - Spesifikasi yang tidak diketahui dikembalikan sebagai `null`, bukan
 *   dihilangkan, supaya UI bisa menandainya secara eksplisit.
 *
 * Mengembalikan `null` bila slug tidak dikenal; pemanggil yang memutuskan
 * memanggil `notFound()`.
 */
export function buildProductDetail(
  catalog: CatalogDataset,
  product: CatalogDataset["products"][number],
  requestedVariantKey: string | undefined,
  now: Date,
  requestedColorKey?: string
): ProductDetail {
  // Kapasitas diurutkan dari kecil ke besar (RAM, lalu penyimpanan), seperti
  // pilihan kapasitas di toko; urutan baris database tidak bermakna.
  const rawVariants = catalog.variants
    .filter((variant) => variant.productId === product.id)
    .sort((a, b) => a.ramGb - b.ramGb || a.storageGb - b.storageGb);

  // Varian default mengikuti basis harga "mulai dari", supaya pengguna yang
  // datang dari kartu katalog melihat harga yang sama dengan yang tadi diklik.
  const startingPrice = resolveStartingPrice({
    variants: rawVariants,
    offers: catalog.offers,
    observations: catalog.priceObservations,
    checks: catalog.priceChecks,
    now,
  });

  const defaultVariant =
    rawVariants.find(
      (variant) => variant.id === startingPrice.referenceVariantId
    ) ??
    rawVariants[0] ??
    null;

  const selectedRaw =
    (requestedVariantKey
      ? rawVariants.find(
          (variant) => variantKey(variant) === requestedVariantKey
        )
      : undefined) ?? defaultVariant;

  const variants: ProductDetailVariant[] = rawVariants.map((variant) => {
    const key = variantKey(variant);
    return {
      id: variant.id,
      key,
      label: formatVariantLabel(variant),
      ramGb: variant.ramGb,
      storageGb: variant.storageGb,
      region: variant.region,
      href: detailHref(product.slug, key, null),
      isSelected: selectedRaw?.id === variant.id,
      price: resolveVariantPrice({
        variantId: variant.id,
        offers: catalog.offers,
        observations: catalog.priceObservations,
        checks: catalog.priceChecks,
        now,
      }),
    };
  });

  const selectedVariant = variants.find((variant) => variant.isSelected) ?? null;

  const price: PriceResolution = selectedVariant
    ? selectedVariant.price
    : { status: "unavailable" };

  const priceBasisOfferId =
    price.status === "available" || price.status === "stale"
      ? price.offerId
      : null;

  const offers: ProductDetailOffer[] = selectedRaw
    ? catalog.offers
        .filter((offer) => offer.variantId === selectedRaw.id)
        .map((offer) => {
          const observation = latestObservation(
            offer.id,
            catalog.priceObservations
          );
          return {
            id: offer.id,
            marketplace: offer.marketplace,
            sellerName: offer.sellerName,
            url: offer.url,
            warranty: offer.warranty,
            listingStatus: offer.listingStatus,
            sellerVerified: offer.sellerVerified,
            store: (() => {
              const store = catalog.stores.find((entry) => entry.id === offer.storeId);
              return store ? { slug: store.slug, name: store.name, kind: store.kind } : null;
            })(),
            priceIdr: observation?.priceIdr ?? null,
            observedAt: observation?.observedAt ?? null,
            checkedAt: lastSuccessfulCheckAt(offer.id, catalog.priceChecks),
            isFreshPrice: observation
              ? isFresh(observation.observedAt, now) && isPriceableListing(offer)
              : false,
            isPriceBasis: offer.id === priceBasisOfferId,
            colors: offer.colors ?? [],
          };
        })
        // Yang menjadi dasar harga ditaruh paling atas, sisanya menyusul.
        .sort((a, b) => Number(b.isPriceBasis) - Number(a.isPriceBasis))
    : [];

  // Penawaran segar di semua varian produk ini (PB-23/PB-12).
  const freshPrices: { priceIdr: number; store: string; observedAt: string }[] = [];
  const productVariantIds = new Set(rawVariants.map((variant) => variant.id));
  for (const offer of catalog.offers) {
    if (!productVariantIds.has(offer.variantId) || !isPriceableListing(offer)) continue;
    const observation = latestObservation(offer.id, catalog.priceObservations);
    if (!observation || !isFresh(observation.observedAt, now)) continue;
    freshPrices.push({ priceIdr: observation.priceIdr, store: offer.storeId ?? offer.marketplace, observedAt: observation.observedAt });
  }
  const freshOfferSummary = freshPrices.length
    ? {
        lowPriceIdr: Math.min(...freshPrices.map((entry) => entry.priceIdr)),
        highPriceIdr: Math.max(...freshPrices.map((entry) => entry.priceIdr)),
        offerCount: freshPrices.length,
        storeCount: new Set(freshPrices.map((entry) => entry.store)).size,
        checkedAt: freshPrices.map((entry) => entry.observedAt).sort().at(-1)!,
      }
    : null;

  const variantLabelById = new Map(
    variants.map((variant) => [variant.id, variant.label])
  );

  const reviews: ProductReview[] = catalog.reviews
    .filter((review) => review.productId === product.id)
    .map((review) => ({
      id: review.id,
      channelName: review.channelName,
      videoUrl: review.videoUrl,
      publishedAt: review.publishedAt,
      timestampSeconds: review.timestampSeconds,
      aspect: review.aspect,
      summary: review.summary,
      strengths: review.strengths,
      limitations: review.limitations,
      testContext: review.testContext,
      variantLabel: review.variantId
        ? (variantLabelById.get(review.variantId) ?? null)
        : null,
    }));

  // Warna: dari foto produk dan listing toko semua varian produk ini.
  const productPhotos = catalog.assets.filter(
    (candidate) => candidate.productId === product.id && candidate.kind === "photo"
  );
  const variantIds = new Set(rawVariants.map((variant) => variant.id));
  const colorChoice = buildColorOptions({
    photos: productPhotos.map((photo) => ({
      src: photo.src,
      // Teks alternatif menyebut warna supaya pembaca layar tahu foto warna apa.
      alt: photo.color && !photo.alt.toLowerCase().includes(photo.color.toLowerCase()) ? `${photo.alt}, warna ${photo.color}` : photo.alt,
      source: photo.provenance.source,
      color: photo.color ?? null,
      isCover: photo.isCover ?? false,
      sortOrder: photo.sortOrder ?? 0,
    })),
    offerColors: catalog.offers
      .filter((offer) => variantIds.has(offer.variantId))
      .map((offer) => offer.colors ?? []),
    selectedVariantOfferColors: offers.map((offer) => offer.colors),
    requestedKey: requestedColorKey,
  });
  const selectedColorKey = colorChoice.selected?.key ?? null;
  // Pilihan warna yang tidak diminta (warna bawaan) tidak ditulis ke URL varian.
  const colorInUrl = requestedColorKey && selectedColorKey === requestedColorKey ? selectedColorKey : null;
  for (const variant of variants) variant.href = detailHref(product.slug, variant.key, colorInUrl);
  const colors: ProductDetailColor[] = colorChoice.options.map((option) => ({
    ...option,
    href: detailHref(product.slug, requestedVariantKey && selectedRaw ? variantKey(selectedRaw) : null, option.key),
  }));
  const selectedColor = colors.find((option) => option.isSelected) ?? null;

  const asset =
    productPhotos[0] ??
    catalog.assets.find((candidate) => candidate.productId === product.id);

  const specs: ProductSpecRow[] = [
    {
      label: "Layar",
      value: product.specs.displayInches
        ? [
            `${product.specs.displayInches} inci`,
            product.specs.displayTechnology,
          ]
            .filter(Boolean)
            .join(", ")
        : null,
    },
    {
      label: "Refresh rate",
      value: product.specs.refreshRateHz
        ? `${product.specs.refreshRateHz} Hz`
        : null,
    },
    { label: "Chipset", value: product.specs.chipset },
    {
      label: "Baterai",
      value: product.specs.batteryMah ? `${product.specs.batteryMah} mAh` : null,
    },
    {
      label: "Pengisian",
      value: product.specs.chargingWatt
        ? `${product.specs.chargingWatt} W`
        : null,
    },
    {
      label: "Kamera utama",
      value: product.specs.mainCameraMp
        ? `${product.specs.mainCameraMp} MP`
        : null,
    },
    {
      // Baris terpisah dari "Kamera utama" dengan sengaja: resolusi dan susunan
      // lensa adalah dua fakta berbeda. Produk bisa punya salah satu diketahui
      // tanpa yang lain (mis. p-note-12: MP diketahui, susunan lensa belum),
      // dan menggabungkannya jadi satu baris akan memaksa salah satunya
      // ditebak atau disembunyikan.
      label: "Susunan kamera",
      value: formatCameraArrangement(product.specs),
    },
    {
      label: "Bobot",
      value: product.specs.weightGrams
        ? `${product.specs.weightGrams} gram`
        : null,
    },
    {
      label: "Tahun rilis",
      value: product.specs.releaseYear
        ? String(product.specs.releaseYear)
        : null,
    },
    {
      label: "Jaringan",
      value:
        product.specs.is5G === null
          ? null
          : product.specs.is5G
            ? "5G"
            : "4G LTE",
    },
    {
      label: "NFC",
      value:
        product.specs.hasNfc === null
          ? null
          : product.specs.hasNfc
            ? "Ada"
            : "Tidak ada",
    },
    { label: "Ketahanan (IP rating)", value: product.specs.ipRating },
    {
      label: "Jack headphone 3.5mm",
      value:
        product.specs.has35mmJack === null
          ? null
          : product.specs.has35mmJack
            ? "Ada"
            : "Tidak ada",
    },
    { label: "Sistem operasi", value: product.specs.osVersion },
    {
      // Bila pemilih warna sudah memakai warna listing toko, daftar dari sumber
      // spesifikasi (sering versi global) diberi label sumber supaya dua daftar
      // yang berbeda tidak terbaca saling bertentangan (UX-22).
      label: colors.length > 0 ? `Warna versi global (${product.specsProvenance.source})` : "Pilihan warna",
      value: product.specs.colorOptions?.length
        ? product.specs.colorOptions.join(", ")
        : null,
    },
  ];

  return {
    id: product.id,
    slug: product.slug,
    brand: product.brand,
    model: product.model,
    name: `${product.brand} ${product.model}`,
    image: {
      src: asset?.src ?? "/images/generic-device.svg",
      alt: asset?.alt ?? "Ilustrasi generik perangkat smartphone",
      isGenericIllustration: asset?.kind !== "photo",
    },
    gallery: colorChoice.gallery.map(({ src, alt, source }) => ({ src, alt, source })),
    colors,
    selectedColor,
    specs,
    specsSource: product.specsProvenance.source,
    specsRetrievedAt: product.specsProvenance.retrievedAt,
    variants,
    selectedVariant,
    price,
    offers,
    freshOfferSummary,
    reviews,
  };
}

export async function getProductDetail(
  now: Date,
  slug: string,
  requestedVariantKey?: string,
  requestedColorKey?: string
): Promise<ProductDetail | null> {
  const catalog = await loadPublishedCatalog(now);
  const product = catalog.products.find((candidate) => candidate.slug === slug);
  if (!product) return null;
  return buildProductDetail(catalog, product, requestedVariantKey, now, requestedColorKey);
}

/** Slug produk terpublikasi, untuk prerender halaman detail saat build. */
