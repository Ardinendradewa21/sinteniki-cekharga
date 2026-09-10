import Image from "next/image";
import Link from "next/link";

import { DemoBadge } from "@/components/demo-marker";
import { CardPriceMeta, CardPriceValue } from "@/components/price-display";
import type { CompareResult, CompareRow } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

/**
 * Tabel perbandingan (PRD FR-04).
 *
 * Yang sengaja TIDAK dilakukan di sini, karena PRD melarangnya:
 *
 * - Tidak ada skor, peringkat, bintang, atau penanda "pemenang". Halaman ini
 *   hanya menunjukkan nilainya dan di mana nilainya berbeda.
 * - Nilai yang tidak diketahui tidak pernah dihitung sebagai kalah. Barisnya
 *   ditandai "belum lengkap", bukan "berbeda", supaya tidak terbaca sebagai
 *   kekurangan salah satu produk.
 *
 * Soal tata letak: label selalu menempel pada nilainya di setiap kolom, jadi di
 * layar kecil kolom-kolomnya menumpuk sebagai kartu yang tetap terbaca. Di layar
 * lebar, kelas `compare-grid`/`compare-column` memakai subgrid supaya baris antar
 * kolom sejajar tanpa perlu memaksa tabel lebar (PRD §8).
 */

function RowCell({
  row,
  index,
  isComparing,
}: {
  row: CompareRow;
  index: number;
  isComparing: boolean;
}) {
  const value = row.values[index] ?? null;
  const highlight = isComparing && row.state === "different";

  return (
    <div
      className={cn(
        "border-t border-border px-5 py-3",
        highlight && "border-l-2 border-l-brand bg-brand-muted/40"
      )}
    >
      <dt className="text-xs text-muted-foreground">
        {row.label}
        {isComparing && row.state === "different" ? (
          <span className="sr-only"> (berbeda antar kandidat)</span>
        ) : null}
        {isComparing && row.state === "incomplete" ? (
          <span className="sr-only"> (data belum lengkap)</span>
        ) : null}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-sm",
          highlight ? "font-semibold text-foreground" : "text-foreground"
        )}
      >
        {value ?? (
          <span className="text-muted-foreground italic">Belum diketahui</span>
        )}
      </dd>
    </div>
  );
}

export function CompareTable({
  result,
  now,
  isDemo,
}: {
  result: CompareResult;
  now: Date;
  isDemo: boolean;
}) {
  const { items, rows } = result;
  const isComparing = items.length >= 2;
  const incompleteCount = rows.filter(
    (row) => row.state === "incomplete"
  ).length;

  return (
    <div>
      {isComparing ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Baris yang bergaris tepi menandai atribut yang{" "}
          <span className="font-semibold text-foreground">berbeda</span> antar
          kandidat.
          {incompleteCount > 0
            ? ` ${incompleteCount} atribut belum lengkap datanya dan sengaja tidak dinilai.`
            : ""}
        </p>
      ) : null}

      <div
        className="compare-grid grid gap-4"
        style={
          {
            "--compare-cols": items.length,
            "--compare-rows": rows.length + 1,
          } as React.CSSProperties
        }
      >
        {items.map((item, index) => (
          <dl
            key={item.slug}
            className="compare-column overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.brand}
                  </p>
                  <p className="text-base font-bold tracking-tight text-foreground">
                    {item.model}
                  </p>
                </div>
                {isDemo ? <DemoBadge /> : null}
              </div>

              <div className="mt-4 flex items-center justify-center rounded-lg bg-muted py-4">
                <Image
                  src={item.image.src}
                  alt={item.image.alt}
                  width={72}
                  height={108}
                  className="h-20 w-auto"
                />
              </div>

              {/*
                Varian selalu disebut bersama harga. Tanpa ini, dua kolom bisa
                terbaca sebanding padahal basis harganya varian berbeda
                (PRD §7 butir 3 dan FR-04).
              */}
              <p className="mt-4 text-xs text-muted-foreground">
                {item.variantLabel
                  ? `Varian ${item.variantLabel}`
                  : "Varian acuan belum ada"}
              </p>

              <div className="mt-1">
                <CardPriceValue price={item.price} />
                <CardPriceMeta
                  price={item.price}
                  referenceVariant={item.variantLabel}
                  now={now}
                  className="mt-1"
                />
              </div>

              {item.variantOptions.length > 1 ? (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Ganti varian</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.variantOptions.map((option) => (
                      <li key={option.key}>
                        <Link
                          href={option.href}
                          replace
                          aria-current={
                            option.key === item.variantKey ? "true" : undefined
                          }
                          className={cn(
                            "flex min-h-11 items-center rounded-pill border px-3 text-xs font-medium transition-colors duration-150",
                            option.key === item.variantKey
                              ? "border-foreground bg-foreground text-background"
                              : "border-border-strong bg-card text-foreground hover:bg-muted"
                          )}
                        >
                          {option.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={item.detailHref}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
                >
                  Lihat detail
                </Link>
                <Link
                  href={item.removeHref}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
                >
                  Hapus dari perbandingan
                </Link>
              </div>
            </div>

            {rows.map((row) => (
              <RowCell
                key={row.label}
                row={row}
                index={index}
                isComparing={isComparing}
              />
            ))}
          </dl>
        ))}
      </div>
    </div>
  );
}
