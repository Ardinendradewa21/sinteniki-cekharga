import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { loadOrNull } from "@/lib/catalog/load";
import { qualifyingNeedPages } from "@/lib/catalog/need-page-data";
import { MIN_FRESH_PRODUCTS, needPagePath } from "@/lib/catalog/need-pages";

export const metadata: Metadata = {
  title: "Cari HP Berdasarkan Kebutuhan",
  description: "Daftar smartphone menurut kebutuhan umum seperti 5G, NFC, RAM, dan penyimpanan, dengan harga yang baru diperiksa.",
};

/** Indeks halaman kebutuhan (PB-29): hanya yang saat ini layak terbit. */
export default async function NeedPagesIndex() {
  const pages = (await loadOrNull(() => qualifyingNeedPages(new Date()))) ?? [];

  return (
    <Container className="py-6 md:py-10">
      <header className="max-w-2xl">
        <h1 className="heading-page text-foreground">Cari HP berdasarkan kebutuhan</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
          Setiap daftar dihitung dari katalog dengan harga yang diperiksa dalam 30 jam terakhir. Daftar yang produknya
          kurang dari {MIN_FRESH_PRODUCTS} tidak ditampilkan.
        </p>
      </header>
      {pages.length === 0 ? (
        <p className="mt-8 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Belum ada daftar yang memenuhi syarat saat ini, biasanya karena harga sedang menunggu pemeriksaan ulang. Gunakan{" "}
          <Link href="/products" className="font-semibold text-brand-text underline-offset-4 hover:underline">
            katalog
          </Link>{" "}
          untuk mencari dengan filter sendiri.
        </p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {pages.map(({ page, matched }) => (
            <li key={page.slug}>
              {/* Gaya sama dengan chip kebutuhan di beranda (VD-04): titik aksen
                  sebagai penanda, bukan status; jumlah = hasil pencarian. */}
              <Link
                href={needPagePath(page)}
                className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors duration-150 hover:border-brand/40 hover:bg-brand-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-brand" />
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">{page.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground tabular">{matched} produk</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
