import type * as React from "react";
import Image from "next/image";
import Link from "next/link";

import { CompareColumnSwitch } from "@/components/compare/compare-column-switch";
import { SpecIcon } from "@/components/compare/spec-icons";
import { DemoBadge } from "@/components/demo-marker";
import { CardPriceMeta, CardPriceValue } from "@/components/price-display";
import { DevicePlaceholder } from "@/components/product/device-placeholder";
import { VariantPicker } from "@/components/product/variant-picker";
import type {
  CompareItem,
  CompareResult,
  CompareSpecIcon,
} from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

/**
 * Perbandingan (PRD FR-04): bar nama produk yang menempel di atas, kartu
 * produk, lalu tabel "Spesifikasi utama" per topik (Layar, Kamera, ...).
 *
 * Tabel spesifikasi berbentuk baris per atribut (audit UX-09): label di kiri,
 * nilai tiap produk sejajar di kanannya, sehingga perbandingan dibaca dalam
 * satu garis mata. Semantik tabel lewat peran ARIA (table/row/rowheader/cell)
 * supaya pembaca layar menyebut atribut dan produknya. Di layar kecil label
 * pindah ke baris penuh tepat di atas nilainya: label tetap dekat nilai dan
 * tidak ada tabel lebar yang harus digeser (PRD §8).
 *
 * Yang sengaja TIDAK dilakukan, karena PRD melarangnya:
 *
 * - Tidak ada skor, peringkat, bintang, atau penanda "pemenang". Titik kecil
 *   hanya menandai bahwa nilainya BERBEDA, bukan mana yang lebih baik.
 * - Nilai yang tidak diketahui tidak pernah dihitung sebagai kalah dan tidak
 *   ditulis "-" yang bisa terbaca "tidak ada". Atribut yang kosong di SEMUA
 *   kolom disebut terbuka di catatan, bukan diisi baris kosong.
 */

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};
/** Baris tabel spesifikasi: kolom label + N kolom nilai mulai md. */
const ROW_GRID: Record<number, string> = {
  1: "grid-cols-1 md:grid-cols-[minmax(9rem,13rem)_minmax(0,1fr)]",
  2: "grid-cols-2 md:grid-cols-[minmax(9rem,13rem)_repeat(2,minmax(0,1fr))]",
  3: "grid-cols-3 md:grid-cols-[minmax(9rem,13rem)_repeat(3,minmax(0,1fr))]",
};
const MD_GRID_COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

function formatStorage(gb: number): string {
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}

function OptionList({
  values,
  has,
  format,
}: {
  values: number[];
  has: Set<number>;
  format: (value: number) => string;
}) {
  return (
    <ul className="space-y-0.5">
      {values.map((value) =>
        has.has(value) ? (
          <li key={value}>{format(value)}</li>
        ) : (
          <li key={value} className="font-normal text-muted-foreground">
            <span aria-hidden="true">–</span>
            <span className="sr-only">{format(value)} tidak tercatat</span>
          </li>
        )
      )}
    </ul>
  );
}

type SpecTableRow = {
  label: string;
  icon: CompareSpecIcon;
  different: boolean;
  headline?: boolean;
  cells: React.ReactNode[];
};

/** Satu topik spesifikasi sebagai tabel ARIA: baris = atribut, kolom = produk. */
function SpecTable({
  id,
  title,
  items,
  rows,
  rowGrid,
  note,
}: {
  id: string;
  title: string;
  items: CompareItem[];
  rows: SpecTableRow[];
  rowGrid: string;
  note?: string;
}) {
  return (
    <section aria-labelledby={`bagian-${id}`} className="mt-10">
      <h4 id={`bagian-${id}`} className="heading-card text-foreground">
        {title}
      </h4>
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
      <div
        role="table"
        aria-labelledby={`bagian-${id}`}
        className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
      >
        <div role="row" className="sr-only">
          <span role="columnheader">Atribut</span>
          {items.map((item) => (
            <span key={item.slug} role="columnheader">
              {item.name}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            role="row"
            className={cn("grid items-start gap-x-4 gap-y-1.5 px-4 py-3", rowGrid)}
          >
            <div
              role="rowheader"
              className="col-span-full flex items-center gap-2 text-sm text-muted-foreground md:col-span-1"
            >
              <SpecIcon name={row.icon} className="size-5 shrink-0 text-muted-foreground" />
              <span>
                {row.label}
                {row.different ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="ml-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-brand align-middle"
                    />
                    <span className="sr-only"> (berbeda antar produk)</span>
                  </>
                ) : null}
              </span>
            </div>
            {row.cells.map((cell, index) => (
              <div
                key={items[index]?.slug ?? index}
                role="cell"
                className={cn(
                  "min-w-0 font-semibold wrap-break-word text-foreground",
                  row.headline ? "text-base md:text-lg" : "text-sm"
                )}
              >
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

const UNKNOWN = (
  <span className="text-sm font-normal text-muted-foreground italic">Belum diketahui</span>
);

/** Pilihan varian tercatat, disejajarkan per ukuran seperti lembar produsen. */
function variantRows(items: CompareItem[]): SpecTableRow[] {
  const rowsFor = (pick: (option: CompareItem["variantOptions"][number]) => number) => {
    const all = [...new Set(items.flatMap((item) => item.variantOptions.map(pick)))].sort(
      (a, b) => a - b
    );
    return { all, perItem: items.map((item) => new Set(item.variantOptions.map(pick))) };
  };
  const storage = rowsFor((option) => option.storageGb);
  const ram = rowsFor((option) => option.ramGb);
  if (storage.all.length === 0) return [];

  return [
    { label: "Penyimpanan", icon: "storage", data: storage, format: formatStorage },
    { label: "RAM", icon: "memory", data: ram, format: (value: number) => `${value} GB` },
  ].map((block) => ({
    label: block.label,
    icon: block.icon as CompareSpecIcon,
    different: false,
    cells: items.map((_, index) => (
      <OptionList key={index} values={block.data.all} has={block.data.perItem[index]!} format={block.format} />
    )),
  }));
}

function ProductColumn({
  item,
  now,
  isDemo,
}: {
  item: CompareItem;
  now: Date;
  isDemo: boolean;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{item.brand}</p>
          <h3 className="heading-card text-foreground">{item.model}</h3>
        </div>
        {isDemo ? <DemoBadge /> : null}
      </div>

      <div className="mt-4 flex h-48 items-center justify-center rounded-lg bg-muted/60">
        {item.image.isGenericIllustration ? (
          <DevicePlaceholder size="md" />
        ) : (
          <Image
            src={item.image.src}
            alt={item.image.alt}
            width={96}
            height={144}
            className="h-36 w-auto"
          />
        )}
      </div>

      {/*
        Varian selalu disebut bersama harga. Tanpa ini, dua kolom bisa terbaca
        sebanding padahal basis harganya varian berbeda (PRD §7 butir 3, FR-04).
      */}
      <p className="mt-4 text-xs text-muted-foreground">
        {item.variantLabel ? `Varian ${item.variantLabel}` : "Varian acuan belum ada"}
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
          <VariantPicker
            mode="compact"
            scroll={false}
            className="mt-1.5"
            options={item.variantOptions.map((option) => ({
              key: option.key,
              label: option.label,
              href: option.href,
              selected: option.key === item.variantKey,
            }))}
          />
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-x-4 pt-4">
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
    </article>
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
  const { items, sections } = result;
  const isComparing = items.length >= 2;
  const gridCols = GRID_COLS[items.length] ?? GRID_COLS[3]!;
  const rowGrid = ROW_GRID[items.length] ?? ROW_GRID[3]!;
  const candidates = result.addable.map(({ slug, name }) => ({ slug, name }));

  // Baris yang kosong di semua kolom tidak memberi perbandingan apa pun;
  // disebut di catatan supaya kekosongannya tetap terbuka.
  const visibleSections = sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) => row.values.some((value) => value !== null)),
    }))
    .filter((section) => section.rows.length > 0);
  const emptyLabels = sections.flatMap((section) =>
    section.rows.filter((row) => row.values.every((value) => value === null)).map((row) => row.label)
  );
  const incompleteCount = visibleSections
    .flatMap((section) => section.rows)
    .filter((row) => row.state === "incomplete").length;

  return (
    <div>
      {/* Bar pemilih menempel saat digulir, seperti lembar perbandingan produsen. */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className={cn("grid gap-3 sm:gap-8", gridCols)}>
          {items.map((item, index) => (
            <CompareColumnSwitch
              key={item.slug}
              index={index}
              current={{ slug: item.slug, name: item.name, label: item.model }}
              selections={result.selections}
              candidates={candidates}
            />
          ))}
        </div>
      </div>

      <div className={cn("mt-6 grid gap-4", MD_GRID_COLS[items.length] ?? MD_GRID_COLS[3])}>
        {items.map((item) => (
          <ProductColumn key={item.slug} item={item} now={now} isDemo={isDemo} />
        ))}
      </div>

      <section aria-labelledby="spesifikasi-utama" className="mt-14">
        <h3
          id="spesifikasi-utama"
          className="text-center heading-sub text-foreground"
        >
          Spesifikasi utama
        </h3>
        {isComparing ? (
          <p className="mx-auto mt-2 max-w-prose text-center text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-brand align-middle"
            />
            Titik menandai atribut yang nilainya berbeda antar produk, bukan
            mana yang lebih baik.
            {incompleteCount > 0
              ? ` ${incompleteCount} atribut belum lengkap datanya dan tidak dinilai.`
              : ""}
          </p>
        ) : null}

        {visibleSections.map((section) => (
          <SpecTable
            key={section.id}
            id={section.id}
            title={section.title}
            items={items}
            rowGrid={rowGrid}
            rows={section.rows.map((row) => ({
              label: row.label,
              icon: row.icon,
              different: isComparing && row.state === "different",
              headline: row.headline,
              cells: items.map((_, index) => row.values[index] ?? UNKNOWN),
            }))}
          />
        ))}

        {variantRows(items).length > 0 ? (
          <SpecTable
            id="varian"
            title="Pilihan varian tercatat"
            note="Kombinasi yang tercatat di katalog. Tanda – berarti ukuran itu tidak tercatat untuk produk tersebut, bukan pasti tidak dijual."
            items={items}
            rowGrid={rowGrid}
            rows={variantRows(items)}
          />
        ) : null}

        {emptyLabels.length > 0 ? (
          <p className="mt-10 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Belum ada data untuk produk mana pun: {emptyLabels.join(", ")}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
