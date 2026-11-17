import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/demo-marker";
import { CardPriceMeta, CardPriceValue } from "@/components/price-display";
import { formatIdr } from "@/lib/catalog/pricing";
import type { ComparisonExample } from "@/lib/catalog/queries";
import { buildCompareHref } from "@/lib/catalog/compare-href";
import { cn } from "@/lib/utils";

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

  // "beda" hanya bila KEDUA nilai diketahui dan berbeda. Nilai yang belum
  // diketahui tidak dinilai, sama seperti halaman perbandingan (PRD FR-04:
  // data kosong tidak dianggap lebih buruk atau berbeda).
  // Dicocokkan menurut label, bukan urutan, sama seperti hero (audit 002 no 9).
  const differingLabels = new Set(
    first.attributes
      .filter((attribute) => {
        const other = second.attributes.find((item) => item.label === attribute.label);
        return (
          other !== undefined &&
          attribute.value !== null &&
          other.value !== null &&
          attribute.value !== other.value
        );
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
      {/*
        Tanpa animasi masuk (audit 002 no 8): dua kartu data statis tidak butuh
        reveal, dan pembaca tanpa gulir atau tangkapan halaman penuh tidak
        melihat area kosong.
      */}
      <div className="grid gap-5 sm:grid-cols-2">
        {example.items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-start justify-between gap-3">
              {/* Varian acuan cukup sekali, di baris harga (audit 002 no 5). */}
              <h3 className="heading-card text-foreground">{item.name}</h3>
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

            <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
              {item.attributes.map((attribute) => (
                <div
                  key={attribute.label}
                  // Baris yang berbeda disorot --brand-muted (DESIGN.md, VD-04);
                  // label "beda" tetap ada, jadi tidak bergantung pada warna.
                  className={cn(
                    "-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1",
                    differingLabels.has(attribute.label) && "bg-brand-muted"
                  )}
                >
                  <dt className="text-muted-foreground">
                    {attribute.label}
                    {differingLabels.has(attribute.label) ? (
                      <Badge variant="brand" className="ml-1.5 bg-card">
                        beda
                      </Badge>
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
          </div>
        ))}
      </div>

      <p className="mt-5 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        {example.differenceIdr === null ? (
          <>
            Selisih harga belum bisa dihitung karena salah satu produk belum
            punya penawaran yang memenuhi syarat. Selisih tidak dikira-kira.
          </>
        ) : example.differenceIdr === 0 && first.price.status === "available" ? (
          // Harga sama bukan data rusak; "Selisih Rp0" terbaca begitu (audit 002 no 1).
          <>
            Harga varian acuan keduanya sama,{" "}
            <span className="tabular font-semibold text-foreground">
              {formatIdr(first.price.priceIdr)}
            </span>
            .{differingLabels.size > 0 ? " Perbedaannya ada di spesifikasi yang ditandai beda." : null}
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
