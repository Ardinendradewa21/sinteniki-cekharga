import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";

import { AdSlot } from "@/components/ads/ad-slot";
import { DemoBadge, DemoNotice } from "@/components/demo-marker";
import { Container } from "@/components/layout/container";
import { PriceDisplay } from "@/components/price-display";
import { ProductGallery } from "@/components/product/product-gallery";
import { OfferList } from "@/components/product/offer-list";
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

/**
 * Detail produk (PRD FR-03, dengan penawaran mengikuti FR-05).
 *
 * Urutan bagian mengikuti PRD §8: di desktop visual di kiri dan ringkasan
 * keputusan di kanan; di mobile berurutan visual, identitas dan varian, harga
 * dan waktu pemeriksaan, aksi, lalu penawaran dan bukti.
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

  return {
    title: detail.name,
    description: `Spesifikasi, varian, penawaran tercatat, dan ringkasan pengalaman reviewer untuk ${detail.name}.`,
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

  const now = new Date();
  const detail = await getProductDetail(now, slug, requestedVariant);

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
      <nav aria-label="Remah roti" className="mb-6">
        <Link
          href="/products"
          className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          Kembali ke katalog
        </Link>
      </nav>

      {isDemo ? (
        <DemoNotice className="mb-8">
          Produk, harga, penawaran, dan ringkasan review di halaman ini berasal
          dari fixture demo. Merek dan modelnya fiktif karena dataset asli belum
          tersedia.
        </DemoNotice>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductGallery
          photos={detail.gallery}
          fallback={detail.image}
          name={detail.name}
        />

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              {detail.brand}
            </p>
            {isDemo ? <DemoBadge /> : null}
          </div>

          <h1 className="mt-1 heading-page text-foreground">
            {detail.model}
          </h1>

          {detail.image.isGenericIllustration ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Gambar di halaman ini adalah ilustrasi generik, bukan foto produk
              sebenarnya.
            </p>
          ) : null}

          <div className="mt-8">
            <VariantSelector variants={detail.variants} />
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card p-5">
            <PriceDisplay
              price={detail.price}
              referenceVariant={detail.selectedVariant?.label ?? null}
              now={now}
              showStartingLabel={false}
            />
            <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Harga ini terikat pada varian yang sedang dipilih. Mengganti varian
              akan mengganti harga dan daftar penawarannya.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="#penawaran">
                Lihat penawaran ({detail.offers.length})
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              {/*
                Membawa varian yang sedang dilihat, supaya perbandingan memakai
                basis harga yang sama dengan yang barusan dibaca pengguna.
              */}
              <Link
                href={buildCompareHref([
                  {
                    slug: detail.slug,
                    variantKey: detail.selectedVariant?.key ?? null,
                  },
                ])}
              >
                Bandingkan
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div id="penawaran" className="mt-16 scroll-mt-8">
        <OfferList
          offers={detail.offers}
          variantLabel={detail.selectedVariant?.label ?? null}
          now={now}
        />
      </div>

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
