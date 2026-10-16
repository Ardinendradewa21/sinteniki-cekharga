import { Suspense } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDataTransferHorizontalIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { AdSlot } from "@/components/ads/ad-slot";
import { ColorPicker } from "@/components/product/color-picker";
import { DemoBadge, DemoNotice } from "@/components/demo-marker";
import { Container } from "@/components/layout/container";
import { PriceDisplay } from "@/components/price-display";
import { ProductGallery } from "@/components/product/product-gallery";
import { OfferList } from "@/components/product/offer-list";
import { PriceHistorySection } from "@/components/product/price-history";
import { ReviewList } from "@/components/product/review-list";
import { SpecTable } from "@/components/product/spec-table";
import { VariantSelector } from "@/components/product/variant-selector";
import { Button } from "@/components/ui/button";
import {
  getProductDetail,
  isDemoData,
  listPublishedSlugs,
  resolveProductSlugRedirect,
} from "@/lib/catalog/queries";
import { buildCompareHref } from "@/lib/catalog/compare-params";
import { productDescription, productJsonLd, productTitle, serializeJsonLd } from "@/lib/catalog/product-seo";
import { siteUrl } from "@/lib/site-url";

/**
 * Detail produk (PRD FR-03, dengan penawaran mengikuti FR-05).
 *
 * Urutan bagian mengikuti PRD §8: di desktop visual di kiri dan ringkasan
 * keputusan di kanan; di mobile berurutan visual, identitas dan varian, harga
 * dan waktu pemeriksaan, aksi, lalu penawaran dan bukti.
 *
 * Tata letak kolom kanan (2026-10-12) mengikuti pola toko yang sudah dikenal
 * pembeli: judul dengan kapasitas dan warna terpilih, harga, pilihan warna,
 * pilihan kapasitas, lalu aksi. Yang sengaja TIDAK ditiru: label "New",
 * "Stok terbatas", harga coret, dan cicilan, karena CekHarga tidak punya
 * datanya dan PRD melarang urgensi buatan.
 *
 * Catatan rendering: berbeda dari katalog yang memisahkan shell statis dari
 * hasil, hampir seluruh isi halaman ini bergantung pada varian terpilih (harga,
 * penawaran, bahkan konteks review), jadi memecahnya ke dalam `<Suspense>` hanya
 * akan menyisakan kerangka kosong sambil menggandakan query. Halaman ini
 * dibiarkan dinamis; pemisahan yang lebih halus baru masuk akal ketika
 * `cacheComponents` diaktifkan nanti.
 */

export async function generateStaticParams() {
  // Dipakai ketika halaman ini kelak bisa diprerender. Sekarang belum berefek
  // karena `searchParams` membuat rute menjadi dinamis, tapi daftarnya sudah
  // benar dan tidak perlu diubah nanti.
  const slugs = await listPublishedSlugs(new Date());
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(
  props: PageProps<"/products/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const detail = await getProductDetail(new Date(), slug);

  if (!detail) {
    return { title: "Produk tidak ditemukan" };
  }

  const title = productTitle(detail);
  const description = productDescription(detail);
  const cover = detail.gallery[0];
  return {
    title,
    description,
    // Canonical tanpa ?varian= / ?warna=: semua pilihan adalah satu halaman
    // produk. Hanya bila domain produksi sudah ditetapkan (SITE_URL).
    ...(siteUrl() ? { alternates: { canonical: `/products/${detail.slug}` } } : {}),
    openGraph: {
      title,
      description,
      ...(cover ? { images: [{ url: cover.src, alt: cover.alt }] } : {}),
    },
  };
}

export default async function ProductDetailPage(
  props: PageProps<"/products/[slug]">
) {
  const { slug } = await props.params;
  const search = await props.searchParams;

  const requestedVariant = Array.isArray(search.varian)
    ? search.varian[0]
    : search.varian;
  const requestedColor = Array.isArray(search.warna) ? search.warna[0] : search.warna;

  const now = new Date();
  const detail = await getProductDetail(now, slug, requestedVariant, requestedColor);

  // Slug yang tidak dikenal adalah 404 sungguhan. Sebaliknya, varian yang tidak
  // dikenal BUKAN 404: produknya tetap ada, jadi lapisan data sudah jatuh ke
  // varian default alih-alih membuang seluruh halaman.
  if (!detail) {
    // Slug lama (mis. sebelum "+" ditulis "-plus", atau iQOO masih di bawah
    // vivo) diarahkan permanen ke slug barunya, varian ikut dibawa.
    const target = await resolveProductSlugRedirect(now, slug);
    if (target) {
      permanentRedirect(
        requestedVariant
          ? `/products/${target}?varian=${encodeURIComponent(requestedVariant)}`
          : `/products/${target}`
      );
    }
    notFound();
  }

  const isDemo = isDemoData();

  return (
    <Container className="py-8 md:py-12">
      {/* Data terstruktur Product (PB-12): tanpa rating/ulasan karangan; penawaran hanya dari harga segar. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            productJsonLd(detail, siteUrl() ? new URL(`/products/${detail.slug}`, siteUrl()!).href : null)
          ),
        }}
      />
      <nav aria-label="Remah roti" className="mb-6">
        <ol className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="inline-flex min-h-11 items-center font-medium transition-colors duration-150 hover:text-foreground">
              Beranda
            </Link>
          </li>
          <li aria-hidden="true">
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
          </li>
          <li>
            <Link href="/products" className="inline-flex min-h-11 items-center font-medium transition-colors duration-150 hover:text-foreground">
              Katalog
            </Link>
          </li>
          <li aria-hidden="true">
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
          </li>
          <li aria-current="page" className="min-w-0 truncate text-foreground">
            {detail.name}
          </li>
        </ol>
      </nav>

      {isDemo ? (
        <DemoNotice className="mb-8">
          Produk, harga, penawaran, dan ringkasan review di halaman ini berasal
          dari fixture demo. Merek dan modelnya fiktif karena dataset asli belum
          tersedia.
        </DemoNotice>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        {/* Kolom foto sengaja tidak menempel saat di-scroll (masukan PO 16 Okt 2026). */}
        <div className="lg:self-start">
          {/* key: ganti warna memulai galeri dari foto pertama warna itu. */}
          <ProductGallery
            key={detail.selectedColor?.key ?? "semua"}
            photos={detail.gallery}
            // Warna terpilih tanpa foto (dan tanpa foto umum): ilustrasi generik
            // berlabel, bukan foto warna lain yang bisa menyesatkan.
            fallback={
              detail.gallery.length === 0 && detail.selectedColor
                ? { src: "/images/generic-device.svg", alt: `Foto ${detail.name} warna ${detail.selectedColor.name} belum tersedia`, isGenericIllustration: true }
                : detail.image
            }
            name={detail.selectedColor ? `${detail.name} ${detail.selectedColor.name}` : detail.name}
          />
        </div>

        <div className="flex flex-col gap-7">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-medium text-muted-foreground">{detail.brand}</p>
                  {isDemo ? <DemoBadge /> : null}
                </div>
                <h1 className="mt-1 heading-page text-foreground">
                  {detail.model}
                  {detail.selectedVariant || detail.selectedColor ? (
                    <span className="mt-1 block text-lg font-semibold tracking-normal text-muted-foreground sm:text-xl">
                      {[detail.selectedVariant?.label, detail.selectedColor?.name].filter(Boolean).join(" – ")}
                    </span>
                  ) : null}
                </h1>
              </div>
              {/*
                Membawa varian yang sedang dilihat, supaya perbandingan memakai
                basis harga yang sama dengan yang barusan dibaca pengguna.
              */}
              <Button asChild variant="outline" className="shrink-0">
                <Link
                  href={buildCompareHref([
                    {
                      slug: detail.slug,
                      variantKey: detail.selectedVariant?.key ?? null,
                    },
                  ])}
                >
                  <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={16} strokeWidth={2} aria-hidden />
                  Bandingkan
                </Link>
              </Button>
            </div>

            {detail.image.isGenericIllustration ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Gambar di halaman ini adalah ilustrasi generik, bukan foto produk
                sebenarnya.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <PriceDisplay
              price={detail.price}
              referenceVariant={detail.selectedVariant?.label ?? null}
              now={now}
              showStartingLabel={false}
            />
          </div>

          <ColorPicker colors={detail.colors} selected={detail.selectedColor} />

          <VariantSelector variants={detail.variants} />

          <p className="text-xs leading-relaxed text-muted-foreground">
            Harga tercatat per kapasitas, bukan per warna. Mengganti kapasitas
            mengganti harga dan daftar penawaran; mengganti warna hanya
            mengganti foto.
          </p>

          <Button asChild size="lg" className="w-full sm:w-auto sm:self-start">
            <Link href="#penawaran">
              Lihat penawaran ({detail.offers.length})
            </Link>
          </Button>
        </div>
      </div>

      <div id="penawaran" className="mt-16 scroll-mt-8">
        <OfferList
          offers={detail.offers}
          variantLabel={detail.selectedVariant?.label ?? null}
          selectedColor={detail.selectedColor?.name ?? null}
          now={now}
        />
      </div>

      {detail.selectedVariant ? (
        // Riwayat dimuat terpisah dan mengalir belakangan supaya tidak menahan bagian atas halaman.
        <Suspense fallback={<div className="mt-12 h-[320px]" aria-hidden />}>
          <PriceHistorySection
            variantId={detail.selectedVariant.id}
            variantLabel={detail.selectedVariant.label}
            now={now}
          />
        </Suspense>
      ) : null}

      <AdSlot code="product_inline" brand={detail.brand} className="mt-12" />

      <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-14">
        <SpecTable specs={detail.specs} source={detail.specsSource} />
        <div className="flex flex-col gap-10">
          <ReviewList reviews={detail.reviews} />
          {/* Sidebar 300×250 hanya di layar lebar (tanpa ukuran mobile). */}
          <AdSlot code="product_sidebar" brand={detail.brand} className="lg:sticky lg:top-24 lg:mx-auto lg:max-w-[300px]" />
        </div>
      </div>
    </Container>
  );
}
