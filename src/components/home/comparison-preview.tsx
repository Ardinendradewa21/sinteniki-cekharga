import Link from "next/link";

import { StaggerItem, StaggerList } from "@/components/motion/reveal";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/demo-marker";
import { CardPriceMeta, CardPriceValue } from "@/components/price-display";
import { formatIdr } from "@/lib/catalog/pricing";
import type { ComparisonExample } from "@/lib/catalog/queries";
import { buildCompareHref } from "@/lib/catalog/compare-params";

/**
 * Contoh perbandingan di beranda, PRD §4 menyebut beranda memuat "contoh
 * perbandingan".
 *
 * Aturan FR-04 yang ditegakkan di sini:
 * - Tidak ada pemenang tunggal dan tidak ada skor. Yang ditampilkan hanya
 *   perbedaannya.
 * - Atribut yang berbeda ditandai supaya tidak terbaca setara.
 * - Nilai yang tidak diketahui ditulis apa adanya, tidak dianggap nol atau
 *   lebih buruk.
 * - Selisih harga hanya muncul bila KEDUA harga layak; kalau tidak, alasannya
 *   dinyatakan.
 */
export function ComparisonPreview({
  example,
  now,
  isDemo,
}: {
  example: ComparisonExample;
  now: Date;
  isDemo: boolean;
}) {
  const [first, second] = example.items;
  if (!first || !second) return null;

  const differingLabels = new Set(
    first.attributes
      .filter((attribute, index) => {
        const other = second.attributes[index];
        return other && attribute.value !== other.value;
      })
      .map((attribute) => attribute.label)
  );

  return (
    <Section
      title="Contoh membandingkan dua kandidat"
      description="Perbandingan menunjukkan perbedaannya, bukan menobatkan pemenang. Yang tidak diketahui tetap ditulis tidak diketahui."
      action={
        <Button asChild variant="outline">
          {/*
            Membawa dua produk yang sedang dicontohkan, jadi halaman
            perbandingan langsung menampilkan yang sama, bukan halaman kosong.
          */}
          <Link
            href={buildCompareHref(
              example.items.map((item) => ({
                slug: item.slug,
                variantKey: null,
              }))
            )}
          >
            Buka perbandingan
          </Link>
        </Button>
      }
    >
      <StaggerList as="div" className="grid gap-5 sm:grid-cols-2">
        {example.items.map((item) => (
          <StaggerItem
            as="div"
            key={item.id}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  {item.name}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.variantLabel
                    ? `Varian ${item.variantLabel}`
                    : "Varian acuan belum ada"}
                </p>
              </div>
              {isDemo ? <DemoBadge /> : null}
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <CardPriceValue price={item.price} />
              <CardPriceMeta
                price={item.price}
                referenceVariant={item.variantLabel}
                now={now}
                className="mt-1"
              />
            </div>

            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              {item.attributes.map((attribute) => (
                <div
                  key={attribute.label}
                  className="flex items-baseline justify-between gap-3"
                >
                  <dt className="text-muted-foreground">
                    {attribute.label}
                    {differingLabels.has(attribute.label) ? (
                      <span className="ml-1.5 rounded-pill bg-brand-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold text-brand">
                        beda
                      </span>
                    ) : null}
                  </dt>
                  <dd className="text-right font-medium text-foreground">
                    {attribute.value ?? (
                      <span className="font-normal text-muted-foreground italic">
                        Belum diketahui
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </StaggerItem>
        ))}
      </StaggerList>

      <p className="mt-5 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        {example.differenceIdr === null ? (
          <>
            Selisih harga belum bisa dihitung karena tidak kedua produk punya
            penawaran yang memenuhi syarat saat ini. Selisih tidak dikira-kira.
          </>
        ) : (
          <>
            Selisih harga{" "}
            <span className="tabular font-semibold text-foreground">
              {formatIdr(Math.abs(example.differenceIdr))}
            </span>
            , dihitung dari varian acuan masing-masing. Angka ini hanya berlaku
            selama kedua penawaran masih tercatat dan cukup baru.
          </>
        )}
      </p>
    </Section>
  );
}
