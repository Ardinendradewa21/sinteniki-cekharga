import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { AdSlot } from "@/components/ads/ad-slot";
import { CompareSummary } from "@/components/compare/compare-summary";
import { CompareTable } from "@/components/compare/compare-table";
import { DemoNotice } from "@/components/demo-marker";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { buildCompareHref } from "@/lib/catalog/compare-params";
import { findPair, pairPath } from "@/lib/catalog/compare-pair-rules";
import { listComparePairs, type ComparePair } from "@/lib/catalog/compare-pairs";
import { monthLabel } from "@/lib/catalog/product-seo";
import { getComparison, isDemoData, type CompareResult } from "@/lib/catalog/queries";
import { siteUrl } from "@/lib/site-url";

/**
 * Halaman "A vs B" (PB-28) untuk pasangan yang dipilih admin.
 *
 * Isinya komponen perbandingan yang sama dengan /compare: nilai disandingkan,
 * perbedaan ditandai, tanpa skor dan tanpa label pemenang (PRD FR-04).
 * Alamat dengan urutan terbalik dialihkan permanen ke urutan pilihan admin,
 * supaya satu pasangan hanya punya satu alamat untuk mesin pencari.
 */

type Loaded = { pair: ComparePair; result: CompareResult };

async function load(segment: string, now: Date): Promise<Loaded | null> {
  const pairs = await listComparePairs().catch(() => []);
  const found = findPair(decodeURIComponent(segment), pairs);
  if (!found) return null;
  if (found.reversed) permanentRedirect(pairPath(found.pair));
  const result = await getComparison(now, [
    { slug: found.pair.a, variantKey: null },
    { slug: found.pair.b, variantKey: null },
  ]);
  return result.items.length === 2 ? { pair: found.pair, result } : null;
}

/** Bulan pemeriksaan harga segar paling baru, hanya bila kedua produk punya harga segar. */
function freshMonth(result: CompareResult): string | null {
  const checks = result.items.map((item) => (item.price.status === "available" ? item.price.checkedAt : null));
  if (checks.some((checkedAt) => checkedAt === null)) return null;
  const latest = (checks as string[]).sort().at(-1)!;
  return monthLabel(latest);
}

export async function generateMetadata(props: PageProps<"/bandingkan/[pasangan]">): Promise<Metadata> {
  const { pasangan } = await props.params;
  const loaded = await load(pasangan, new Date());
  if (!loaded) return { title: "Perbandingan tidak ditemukan" };
  const { pair, result } = loaded;
  const month = freshMonth(result);
  const title = `${pair.nameA} vs ${pair.nameB}: Beda Spesifikasi dan Harga${month ? ` ${month}` : ""}`;
  const description = `Bandingkan ${pair.nameA} dan ${pair.nameB}: spesifikasi berdampingan, harga per varian beserta waktu pemeriksaannya, dan catatan reviewer. Tanpa skor atau pemenang.`;
  return {
    title,
    description,
    ...(siteUrl() ? { alternates: { canonical: pairPath(pair) } } : {}),
    openGraph: { title, description },
  };
}

export default async function ComparePairPage(props: PageProps<"/bandingkan/[pasangan]">) {
  const { pasangan } = await props.params;
  const now = new Date();
  const loaded = await load(pasangan, now);
  if (!loaded) notFound();
  const { pair, result } = loaded;
  const isDemo = isDemoData();

  return (
    <Container className="py-8 md:py-12">
      <header className="mb-8 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">CekHarga / Bandingkan</p>
        <h1 className="mt-2 heading-page text-foreground">
          {pair.nameA} vs {pair.nameB}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Spesifikasi dan harga keduanya disandingkan. Perbedaan ditandai, tanpa skor atau penanda pemenang. Harga
          mengikuti varian acuan masing-masing dan waktu pemeriksaannya.
        </p>
      </header>

      {isDemo ? (
        <DemoNotice className="mb-6">Data di halaman ini berasal dari fixture demo.</DemoNotice>
      ) : null}

      <CompareTable result={result} now={now} isDemo={isDemo} />

      <section aria-labelledby="konteks-pasangan" className="mt-10">
        <h2 id="konteks-pasangan" className="heading-section text-foreground">
          Baca konteksnya
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Selisih harga dan catatan reviewer memberi konteks, bukan keputusan akhir.
        </p>
        <CompareSummary result={result} />
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={buildCompareHref(result.selections)}>Ganti varian atau tambah pembanding</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/products">Lihat katalog</Link>
        </Button>
      </div>

      <AdSlot code="compare_bottom" className="mt-12" />
    </Container>
  );
}
