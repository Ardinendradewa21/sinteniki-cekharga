import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DemoNotice } from "@/components/demo-marker";
import { Container } from "@/components/layout/container";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { loadNeedPage, needPageQuery } from "@/lib/catalog/need-page-data";
import { findNeedPage, MIN_FRESH_PRODUCTS, needPagePath } from "@/lib/catalog/need-pages";
import { monthLabel } from "@/lib/catalog/product-seo";
import { isDemoData } from "@/lib/catalog/queries";
import { buildCatalogHref } from "@/lib/catalog/search-params";
import { siteUrl } from "@/lib/site-url";

/**
 * Halaman kebutuhan (PB-29). Isinya hasil pencarian katalog biasa, urut dari
 * harga terendah. Bila produk berharga segar yang lolos kurang dari batas,
 * halaman 404 (bukan halaman tipis yang menyesatkan).
 */

async function load(slug: string, now: Date) {
  const page = findNeedPage(slug);
  if (!page) return null;
  const { result, qualifies } = await loadNeedPage(page, now);
  return qualifies ? { page, result } : null;
}

export async function generateMetadata(props: PageProps<"/hp/[kebutuhan]">): Promise<Metadata> {
  const { kebutuhan } = await props.params;
  const now = new Date();
  const loaded = await load(kebutuhan, now);
  if (!loaded) return { title: "Halaman tidak ditemukan" };
  const { page, result } = loaded;
  const title = `${page.title} (${monthLabel(now.toISOString())})`;
  const description = `${result.matched} smartphone ${page.title.replace(/^HP /, "").toLowerCase()} dengan harga yang diperiksa dalam 30 jam terakhir. ${page.intro}`;
  return {
    title,
    description,
    ...(siteUrl() ? { alternates: { canonical: needPagePath(page) } } : {}),
    openGraph: { title, description },
  };
}

export default async function NeedPageView(props: PageProps<"/hp/[kebutuhan]">) {
  const { kebutuhan } = await props.params;
  const now = new Date();
  const loaded = await load(kebutuhan, now);
  if (!loaded) notFound();
  const { page, result } = loaded;
  const isDemo = isDemoData();

  return (
    <Container className="py-6 md:py-10">
      <header className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-text">CekHarga / Kebutuhan</p>
        <h1 className="mt-2 heading-page text-foreground">{page.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">{page.intro}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {result.matched} produk, urut dari harga terendah. Hanya harga yang diperiksa dalam 30 jam terakhir yang dihitung;
          halaman ini otomatis tidak tampil bila produknya kurang dari {MIN_FRESH_PRODUCTS}. Urutan harga bukan peringkat
          kualitas.
        </p>
      </header>

      {isDemo ? <DemoNotice className="mt-6">Data di halaman ini berasal dari fixture demo.</DemoNotice> : null}

      {/* h2 untuk pembaca layar: judul kartu (h3) tidak melompat dari h1. */}
      <h2 className="sr-only">Daftar produk</h2>
      <ul className="-mx-2 mt-6 grid grid-cols-2 gap-2 sm:mx-0 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {result.items.map((product, index) => (
          <li key={product.id}>
            {/* href wajib: tanpa itu kartu tidak tertaut ke detail dan tidak
                punya tombol Bandingkan (mode tanpa href khusus style guide). */}
            <ProductCard
              product={product}
              now={now}
              isDemo={isDemo}
              eager={index < 4}
              href={`/products/${product.slug}`}
            />
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={buildCatalogHref(needPageQuery(page), {})}>Persempit di katalog</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/hp">Kebutuhan lain</Link>
        </Button>
      </div>
    </Container>
  );
}
