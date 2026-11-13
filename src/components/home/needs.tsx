import Link from "next/link";

import { Section } from "@/components/section";
import { MIN_FRESH_PRODUCTS, needPagePath, type NeedPage } from "@/lib/catalog/need-pages";

/**
 * "Cari HP menurut kebutuhan" (PRD §4: contoh cara memilih; audit 002 no 2).
 *
 * Dulu empat kartu pendekatan (Tanya AI, katalog, bandingkan, reviewer) yang
 * mengulang adegan hero. Sekarang tautan ke halaman kebutuhan PB-29, yang
 * isinya konkret ("HP 5G di bawah Rp3 juta") dan dihitung dari katalog.
 *
 * - Hanya halaman yang layak terbit (`qualifyingNeedPages`) yang ditautkan,
 *   jadi tidak ada tautan ke halaman 404.
 * - Jumlah produk adalah hasil pencarian, bukan popularitas (PRD FR-01).
 *   Urutannya mengikuti `NEED_PAGES`, bukan peringkat.
 */
export function Needs({ pages }: { pages: { page: NeedPage; matched: number }[] }) {
  return (
    <Section
      title="Cari HP menurut kebutuhan"
      description={`Setiap daftar dihitung dari harga yang diperiksa dalam 30 jam terakhir. Daftar dengan kurang dari ${MIN_FRESH_PRODUCTS} produk tidak ditampilkan.`}
    >
      {pages.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
          Belum ada daftar yang memenuhi syarat saat ini, biasanya karena harga sedang menunggu pemeriksaan ulang.{" "}
          <Link href="/products" className="font-semibold text-brand-text underline underline-offset-4">
            Cari di katalog dengan filter sendiri
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2 sm:gap-3">
          {pages.map(({ page, matched }) => (
            <li key={page.slug}>
              <Link
                href={needPagePath(page)}
                className="inline-flex min-h-11 items-center gap-x-2 rounded-pill border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors duration-150 hover:border-brand/40 hover:bg-brand-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {/* Titik satu warna aksen (DESIGN.md §2.6), penanda chip, bukan status. */}
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand" />
                {page.title}
                <span className="shrink-0 font-normal whitespace-nowrap text-muted-foreground tabular">{matched} produk</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
