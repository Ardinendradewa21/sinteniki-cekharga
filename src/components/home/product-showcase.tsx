import Link from "next/link";

import { StaggerItem, StaggerList } from "@/components/motion/reveal";
import { ProductCard } from "@/components/product-card";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import type { ProductSummary } from "@/lib/catalog/queries";

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
  return (
    <Section
      title="Produk yang sudah tercatat"
      description="Ditampilkan apa adanya dari katalog terpublikasi, tanpa peringkat dan tanpa klaim terlaris."
      action={
        <Button asChild variant="outline">
          <Link href="/products">Lihat semua</Link>
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
        <StaggerList className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <StaggerItem key={product.id}>
              <ProductCard
                product={product}
                now={now}
                isDemo={isDemo}
                href={`/products/${product.slug}`}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </Section>
  );
}
