import Link from "next/link";

import { ProductRail } from "@/components/home/product-rail";
import { ProductCard } from "@/components/product-card";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import type { ProductSummary } from "@/lib/catalog/queries";

const HOME_PRODUCT_LIMIT = 12;

/**
 * Produk di beranda (PRD FR-01): "Produk yang ditampilkan berasal dari data
 * terpublikasi."
 *
 * Tidak ada klaim popularitas, "terlaris", "pilihan editor", testimonial, atau
 * jumlah pengguna. Urutannya mengikuti urutan katalog apa adanya, dan itu
 * dinyatakan supaya tidak terbaca sebagai peringkat.
 */
export function ProductShowcase({
  products,
  now,
  isDemo,
}: {
  products: ProductSummary[];
  now: Date;
  isDemo: boolean;
}) {
  const previewProducts = products.slice(0, HOME_PRODUCT_LIMIT);

  return (
    <Section
      title="Jelajahi produk di CekHarga"
      description={`Cuplikan ${previewProducts.length} dari ${products.length} produk terpublikasi. Urutannya mengikuti katalog, bukan peringkat atau klaim terlaris.`}
      action={
        <Button asChild variant="outline">
          <Link href="/products">Cari Produk</Link>
        </Button>
      }
    >
      {products.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-base font-semibold text-foreground">
            Belum ada produk terpublikasi
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Katalog akan terisi setelah data produk dipublikasikan.
          </p>
        </div>
      ) : (
        <ProductRail>
          <ul className="flex w-max gap-2 sm:gap-3">
            {previewProducts.map((product) => (
              <li
                key={product.id}
                className="w-[calc((100vw-3rem)/2)] min-w-36 max-w-44 shrink-0 sm:w-52 sm:max-w-none lg:w-56"
              >
                <ProductCard
                  product={product}
                  now={now}
                  isDemo={isDemo}
                  href={`/products/${product.slug}`}
                />
              </li>
            ))}
          </ul>
        </ProductRail>
      )}
    </Section>
  );
}
