import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDataTransferHorizontalIcon } from "@hugeicons/core-free-icons";

import { CardPriceMeta, CardPriceValue } from "@/components/price-display";
import { DevicePlaceholder } from "@/components/product/device-placeholder";
import { Button } from "@/components/ui/button";
import type { ProductCardView } from "@/lib/assistant/ai/chat-state";

/**
 * Kartu ringkas produk yang ditanyakan atau dibandingkan di Tanya AI (VD-08).
 * Data dari katalog (halaman detail/perbandingan), bukan dari model. Harga
 * selalu bersama varian acuan dan waktu periksa (PRD §7). Tanpa hook, jadi
 * bisa dipakai di komponen klien.
 */
export function ProductMiniCards({
  products,
  compareHref,
  now,
}: {
  products: ProductCardView[];
  compareHref: string | null;
  now: Date;
}) {
  return (
    <div className="mt-4">
      <ul className={products.length > 1 ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:max-w-sm"}>
        {products.map((product) => (
          <li key={product.slug} data-product-card="">
            <Link
              href={product.detailHref}
              className="flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors duration-150 hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* Panggung foto terang, juga di tema gelap (DESIGN.md §2 butir 2). */}
              <span className="stage relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                {product.image.isGenericIllustration ? (
                  <DevicePlaceholder size="sm" />
                ) : (
                  <Image src={product.image.src} alt="" fill sizes="64px" className="object-contain p-1" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-foreground">{product.name}</span>
                <CardPriceValue price={product.price} className="mt-0.5 block" />
                <CardPriceMeta price={product.price} referenceVariant={product.variantLabel} now={now} className="mt-1" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {compareHref ? (
        <Button asChild variant="outline" className="mt-3">
          <Link href={compareHref}>
            <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={16} strokeWidth={2} aria-hidden />
            Buka perbandingan lengkap
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
