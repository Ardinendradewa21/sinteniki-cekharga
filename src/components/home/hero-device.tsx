import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";

import { DemoBadge } from "@/components/demo-marker";
import { HeroStory } from "@/components/home/hero-story";
import { formatCheckedAt, formatIdr } from "@/lib/catalog/pricing";
import type { ProductSummary } from "@/lib/catalog/queries";

/**
 * Visual hero: ponsel besar berisi cerita singkat CekHarga (HeroStory), dengan
 * panel harga/freshness kecil di atasnya (PRD §8).
 *
 * Aturan motion PRD §8 ("Hero/SVG boleh bergerak halus sekali; hindari loop,
 * parallax, glow, dan scroll hijacking") dijelaskan di HeroStory. Panel harga
 * memakai entrance `tw-animate-css` 300 ms sekali jalan.
 */
export function HeroDevice({
  product,
  now,
  isDemo,
}: {
  /** `null` bila katalog kosong, visualnya tetap tampil tanpa panel harga. */
  product: ProductSummary | null;
  now: Date;
  isDemo: boolean;
}) {
  /*
    Panel harga/freshness. Ini konten sungguhan dari lapisan data, bukan
    hiasan, karena itu tidak aria-hidden, dan tetap menyebut varian acuan
    serta waktu pemeriksaan sesuai PRD §7.
  */
  const panel = product ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both absolute right-0 bottom-2 delay-300 duration-300 sm:-right-2">
          <div className="w-56 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {product.brand}
              </p>
              {isDemo ? <DemoBadge /> : null}
            </div>
            <p className="mt-0.5 text-sm font-bold tracking-tight text-foreground">
              {product.model}
            </p>

            {product.price.status === "available" ? (
              <>
                <p className="tabular mt-2 text-lg font-extrabold tracking-tight text-foreground">
                  {formatIdr(product.price.priceIdr)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Varian {product.priceReferenceVariant}
                </p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-success">
                  <HugeiconsIcon
                    icon={Clock01Icon}
                    size={13}
                    strokeWidth={2}
                    aria-hidden
                  />
                  Diperiksa {formatCheckedAt(product.price.checkedAt, now)}
                </p>
              </>
            ) : product.price.status === "stale" ? (
              <>
                <p className="mt-2 text-xs text-muted-foreground">Harga terakhir tercatat</p>
                <p className="tabular text-lg font-extrabold tracking-tight text-foreground">
                  {formatIdr(product.price.priceIdr)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Varian {product.priceReferenceVariant}
                </p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-warning">
                  <HugeiconsIcon
                    icon={Clock01Icon}
                    size={13}
                    strokeWidth={2}
                    aria-hidden
                  />
                  Tercatat {formatCheckedAt(product.price.observedAt, now)}, belum diperiksa ulang
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Harga belum tersedia
              </p>
            )}
          </div>
        </div>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-md">
      <HeroStory overlay={panel} />
    </div>
  );
}
