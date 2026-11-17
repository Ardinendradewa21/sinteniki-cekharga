import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { AdSlot, AdUnit, resolveAd } from "@/components/ads/ad-slot";
import { CatalogResults } from "@/components/catalog/catalog-results";
import { DataErrorBoundary, DataUnavailable } from "@/components/data-error";
import { loadOrNull } from "@/lib/catalog/load";
import { DemoNotice } from "@/components/demo-marker";
import { Container } from "@/components/layout/container";
import { isDemoData, searchCatalog } from "@/lib/catalog/queries";
import { parseCatalogQuery } from "@/lib/catalog/search-params";

export const metadata: Metadata = {
  title: "Produk",
  description:
    "Cari smartphone dengan kalimat kebutuhan, nama, merek, harga, RAM, dan penyimpanan.",
};

/**
 * Katalog (PRD FR-02).
 *
 * Hasil katalog dirender langsung di HTML, TANPA `<Suspense>` + skeleton
 * (VD-05). Sebelumnya bagian filter dan hasil mengalir di dalam Suspense:
 * React mengirim skeleton dulu lalu isinya di `<div hidden>` yang baru
 * ditukar oleh JavaScript. Terukur: tanpa JavaScript halaman hanya berisi 13
 * skeleton dan 0 kartu, padahal form katalog dirancang tetap jalan tanpa
 * JavaScript, dan teks utama ikut menunggu JavaScript (antislop R-40).
 * Keuntungan "shell statis" juga tidak terwujud karena layout publik membaca
 * cookie tema, sehingga rute ini sudah dinamis seluruhnya. Pindah filter tetap
 * mulus: navigasi router berjalan sebagai transisi yang mempertahankan hasil
 * lama sampai hasil baru siap.
 */

async function CatalogView({
  searchParams,
}: Pick<PageProps<"/products">, "searchParams">) {
  const query = parseCatalogQuery(await searchParams);
  const now = new Date();
  // Targeting kontekstual: bila katalog disaring ke satu merek, iklan merek
  // itu didahulukan. In-feed dipilih di sini supaya baris kosong tidak dirender.
  // Pencarian dan keputusan iklan tidak saling bergantung, jadi berjalan paralel.
  const adBrand = query.brands.length === 1 ? query.brands[0] : null;
  const [result, inFeedAd] = await Promise.all([
    loadOrNull(() => searchCatalog(now, query)),
    resolveAd("catalog_infeed", { brand: adBrand }),
  ]);
  if (!result) return <DataUnavailable area="Katalog" />;
  const isDemo = isDemoData();

  return (
    <>
      {isDemo ? (
        <DemoNotice className="mb-6">
          Produk, harga, dan waktu pemeriksaan di halaman ini berasal dari
          fixture demo. Merek dan modelnya fiktif karena dataset asli belum
          tersedia.
        </DemoNotice>
      ) : null}

      <CatalogFilters
        query={query}
        facets={result.facets}
        interpretation={result.interpretation}
      />

      <AdSlot code="catalog_top" brand={adBrand} className="mt-6" />

      <div className="mt-5 md:mt-6">
        <CatalogResults
          result={result}
          query={query}
          now={now}
          isDemo={isDemo}
          inFeedAd={inFeedAd ? <AdUnit creative={inFeedAd.creative} slot={inFeedAd.slot} /> : null}
        />
      </div>
    </>
  );
}

export default function ProductsPage(props: PageProps<"/products">) {
  return (
    <Container className="py-6 md:py-8">
      {/* Pengantar dibuat satu kalimat supaya kartu produk terlihat tanpa scroll (UX-24). */}
      <header className="mb-5 max-w-2xl md:mb-6">
        <h1 className="heading-page text-foreground">
          Katalog smartphone
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
          Cari dengan nama, merek, atau kebutuhan, lalu persempit dengan filter.{" "}
          <Link href="/hp" className="font-semibold text-brand-text underline-offset-4 hover:underline">
            Lihat daftar per kebutuhan
          </Link>
        </p>
      </header>

      <DataErrorBoundary area="Katalog">
        <CatalogView searchParams={props.searchParams} />
      </DataErrorBoundary>
    </Container>
  );
}
