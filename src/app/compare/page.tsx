import { Suspense } from "react";
import type { Metadata } from "next";

import { ComparePicker } from "@/components/compare/compare-picker";
import { CompareSummary } from "@/components/compare/compare-summary";
import { CompareTable } from "@/components/compare/compare-table";
import { DataErrorBoundary, DataUnavailable } from "@/components/data-error";
import { loadOrNull } from "@/lib/catalog/load";
import { DemoNotice } from "@/components/demo-marker";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";
import { getComparison, isDemoData } from "@/lib/catalog/queries";
import {
  MIN_COMPARE_ITEMS,
  parseCompareSelections,
} from "@/lib/catalog/compare-params";

export const metadata: Metadata = {
  title: "Bandingkan",
  description:
    "Sandingkan 2–3 smartphone beserta variannya untuk melihat perbedaan, harga sebanding, dan komprominya.",
};

/**
 * Perbandingan (PRD FR-04).
 *
 * Halaman ini sengaja tidak pernah menyimpulkan. Tidak ada skor, tidak ada
 * peringkat, dan tidak ada penanda pemenang; yang ditampilkan hanya nilainya,
 * di mana nilainya berbeda, dan apa yang belum diketahui.
 *
 * Seperti katalog, kerangka halaman berada di luar `<Suspense>` supaya ikut ke
 * shell, sedangkan bagian yang bergantung pada `searchParams` mengalir di
 * dalamnya.
 */

function CompareSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 2 }, (_, index) => (
        <Skeleton key={index} className="h-[32rem] w-full rounded-xl" />
      ))}
    </div>
  );
}

async function CompareView({
  searchParams,
}: Pick<PageProps<"/compare">, "searchParams">) {
  const selections = parseCompareSelections(await searchParams);
  const now = new Date();
  const result = await loadOrNull(() => getComparison(now, selections));
  if (!result) return <DataUnavailable area="Perbandingan" />;
  const isDemo = isDemoData();

  const hasEnough = result.items.length >= MIN_COMPARE_ITEMS;

  return (
    <>
      {isDemo && result.items.length > 0 ? (
        <DemoNotice className="mb-6">
          Produk, harga, dan ringkasan review di halaman ini berasal dari fixture
          demo. Merek dan modelnya fiktif karena dataset asli belum tersedia.
        </DemoNotice>
      ) : null}

      {result.items.length > 0 ? (
        <div className="mb-8">
          <CompareTable result={result} now={now} isDemo={isDemo} />
        </div>
      ) : null}

      {!hasEnough ? (
        <div className="mb-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">
            {result.items.length === 0
              ? "Belum ada kandidat yang dipilih"
              : "Perlu satu kandidat lagi"}
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {result.items.length === 0
              ? "Pilih minimal dua produk untuk melihat perbedaannya. Kandidat yang sudah dipilih tersimpan di alamat halaman, jadi perbandingannya bisa dibagikan."
              : "Satu kandidat belum cukup untuk dibandingkan. Tambahkan satu lagi di bawah."}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ComparePicker result={result} selectedCount={result.items.length} />
        {hasEnough ? <CompareSummary result={result} /> : null}
      </div>
    </>
  );
}

export default function ComparePage(props: PageProps<"/compare">) {
  return (
    <Container className="py-10 md:py-14">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          Bandingkan kandidat
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Sandingkan dua sampai tiga produk beserta variannya. Halaman ini
          menunjukkan perbedaannya dan apa yang belum diketahui, tanpa menobatkan
          pemenang atau memberi skor.
        </p>
      </header>

      <DataErrorBoundary area="Perbandingan">
        <Suspense fallback={<CompareSkeleton />}>
          <CompareView searchParams={props.searchParams} />
        </Suspense>
      </DataErrorBoundary>
    </Container>
  );
}
