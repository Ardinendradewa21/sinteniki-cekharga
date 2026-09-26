import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { ComparePicker } from "@/components/compare/compare-picker";
import { CompareSummary } from "@/components/compare/compare-summary";
import { CompareTable } from "@/components/compare/compare-table";
import { DataErrorBoundary, DataUnavailable } from "@/components/data-error";
import { loadOrNull } from "@/lib/catalog/load";
import { DemoNotice } from "@/components/demo-marker";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getComparison, isDemoData } from "@/lib/catalog/queries";
import {
  MIN_COMPARE_ITEMS,
  parseCompareSelections,
} from "@/lib/catalog/compare-params";

export const metadata: Metadata = {
  title: "Bandingkan",
  description:
    "Sandingkan 2-3 smartphone beserta variannya untuk melihat perbedaan, harga sebanding, dan komprominya.",
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

      <ComparePicker result={result} />

      {!hasEnough ? (
        <div role="status" className="mt-5 rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
          <h2 className="text-sm font-bold text-foreground">
            {result.items.length === 0
              ? "Mulai dengan memilih produk pertama"
              : "Perlu satu kandidat lagi"}
          </h2>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {result.items.length === 0
              ? "Cari produk pada daftar di atas. Pilihan akan tersimpan di alamat halaman."
              : "Satu produk belum cukup untuk dibandingkan. Cari satu produk lagi di atas."}
          </p>
        </div>
      ) : null}

      {result.items.length > 0 ? (
        <section aria-labelledby="hasil-bandingkan" className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Langkah 2</p>
            <h2 id="hasil-bandingkan" className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
              {hasEnough ? "Lihat perbedaan" : "Produk yang dipilih"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasEnough
                ? "Nilai spesifikasi disandingkan tanpa skor atau penanda pemenang."
                : "Detail produk pertama muncul di sini; tambahkan satu lagi untuk melihat perbedaannya."}
            </p>
          </div>
          <CompareTable result={result} now={now} isDemo={isDemo} />
        </section>
      ) : null}

      {hasEnough ? (
        <section aria-labelledby="konteks-bandingkan" className="mt-10">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">Langkah 3</p>
          <h2 id="konteks-bandingkan" className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
            Baca konteksnya
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Selisih harga dan catatan reviewer memberi konteks, bukan keputusan akhir.
          </p>
          <CompareSummary result={result} />
        </section>
      ) : null}
    </>
  );
}

export default function ComparePage(props: PageProps<"/compare">) {
  return (
    <Container className="py-8 md:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">CekHarga / Bandingkan</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Bandingkan produk
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Cari dua sampai tiga smartphone, lalu lihat spesifikasi dan harga secara berdampingan.
            Tidak ada skor atau penanda pemenang.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/products">Lihat katalog</Link>
        </Button>
      </header>

      <DataErrorBoundary area="Perbandingan">
        <Suspense fallback={<CompareSkeleton />}>
          <CompareView searchParams={props.searchParams} />
        </Suspense>
      </DataErrorBoundary>
    </Container>
  );
}
