import { Suspense } from "react";
import type { Metadata } from "next";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { CatalogResults } from "@/components/catalog/catalog-results";
import { DataErrorBoundary, DataUnavailable } from "@/components/data-error";
import { loadOrNull } from "@/lib/catalog/load";
import { DemoNotice } from "@/components/demo-marker";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";
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
 * Struktur render mengikuti model Next.js 16: judul halaman berada di luar
 * `<Suspense>` sehingga ikut ke shell statis, sedangkan bagian yang bergantung
 * pada `searchParams` (filter dan hasil) berada di dalamnya dan mengalir saat
 * request. `searchParams` sengaja tidak di-await di komponen halaman, melainkan
 * diteruskan sebagai promise ke anak di dalam boundary, supaya halaman ini tidak
 * seluruhnya menjadi dinamis. Pola yang sama tetap benar nanti ketika
 * `cacheComponents` diaktifkan.
 */

function CatalogSkeleton() {
  return (
    <div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="mt-4 h-14 w-full" />
      <Skeleton className="mt-8 h-4 w-48" />
      <ul className="-mx-2 mt-6 grid grid-cols-2 gap-2 sm:mx-0 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <li key={index}>
            <Skeleton className="aspect-[3/4.7] w-full rounded-md sm:rounded-lg" />
          </li>
        ))}
      </ul>
    </div>
  );
}

async function CatalogView({
  searchParams,
}: Pick<PageProps<"/products">, "searchParams">) {
  const query = parseCatalogQuery(await searchParams);
  const now = new Date();
  const result = await loadOrNull(() => searchCatalog(now, query));
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

      <div className="mt-8">
        <CatalogResults
          result={result}
          query={query}
          now={now}
          isDemo={isDemo}
        />
      </div>
    </>
  );
}

export default function ProductsPage(props: PageProps<"/products">) {
  return (
    <Container className="py-10 md:py-14">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          Katalog smartphone
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Cari nama, merek, spesifikasi, atau tulis kebutuhanmu dengan kalimat
          biasa di satu kolom, lalu persempit dengan filter. Pilihan tersimpan di alamat halaman,
          jadi hasilnya bisa dibagikan dan dibuka ulang.
        </p>
      </header>

      <DataErrorBoundary area="Katalog">
        <Suspense fallback={<CatalogSkeleton />}>
          <CatalogView searchParams={props.searchParams} />
        </Suspense>
      </DataErrorBoundary>
    </Container>
  );
}
