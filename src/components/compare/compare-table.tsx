import Image from "next/image";
import Link from "next/link";

import { CompareColumnSwitch } from "@/components/compare/compare-column-switch";
import { SpecIcon } from "@/components/compare/spec-icons";
import { DemoBadge } from "@/components/demo-marker";
import { CardPriceMeta, CardPriceValue } from "@/components/price-display";
import type {
  CompareItem,
  CompareResult,
  CompareRow,
  CompareSpecIcon,
} from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

/**
 * Perbandingan (PRD FR-04), dengan tata letak ala lembar "Spesifikasi Utama"
 * situs produsen: bar nama produk yang menempel di atas, lalu bagian per topik
 * (Layar, Kamera, ...) dengan ikon, label kecil, dan nilai tebal per kolom.
 *
 * Yang sengaja TIDAK dilakukan, karena PRD melarangnya:
 *
 * - Tidak ada skor, peringkat, bintang, atau penanda "pemenang". Titik kecil
 *   hanya menandai bahwa nilainya BERBEDA, bukan mana yang lebih baik.
 * - Nilai yang tidak diketahui tidak pernah dihitung sebagai kalah dan tidak
 *   ditulis "-" yang bisa terbaca "tidak ada". Atribut yang kosong di SEMUA
 *   kolom disebut terbuka di catatan, bukan diisi baris kosong.
 *
 * Kolom selalu sejajar karena setiap baris adalah grid sendiri dengan jumlah
 * kolom sama dengan jumlah produk. Di layar kecil kolomnya menyempit (teks dan
 * ikon mengecil) alih-alih memaksa tabel lebar yang harus digeser (PRD §8).
 */

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};
const MD_GRID_COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

function formatStorage(gb: number): string {
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}

function SpecCell({
  row,
  item,
  index,
  isComparing,
}: {
  row: CompareRow;
  item: CompareItem;
  index: number;
  isComparing: boolean;
}) {
  const value = row.values[index] ?? null;
  const different = isComparing && row.state === "different";

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <SpecIcon name={row.icon} className="size-8 text-foreground sm:size-12" />
      <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
        {different ? (
          <span
            aria-hidden="true"
            className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-brand align-middle"
          />
        ) : null}
        {row.label}
        <span className="sr-only">
          , {item.name}
          {different ? " (berbeda antar produk)" : ""}
        </span>
      </p>
      <p
        className={cn(
          "mt-1 max-w-full font-bold wrap-break-word text-foreground",
          row.headline && value ? "text-lg tracking-tight sm:text-2xl" : "text-sm sm:text-base"
        )}
      >
        {value ?? (
          <span className="text-xs font-normal text-muted-foreground italic sm:text-sm">
            Belum diketahui
          </span>
        )}
      </p>
    </div>
  );
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
    <ul className="mt-2 space-y-1 text-sm font-bold text-foreground sm:text-base">
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

/** Pilihan varian tercatat, disejajarkan per ukuran seperti lembar produsen. */
function VariantOptions({ items, gridCols }: { items: CompareItem[]; gridCols: string }) {
  const rowsFor = (pick: (option: CompareItem["variantOptions"][number]) => number) => {
    const all = [...new Set(items.flatMap((item) => item.variantOptions.map(pick)))].sort(
      (a, b) => a - b
    );
    return {
      all,
      perItem: items.map((item) => new Set(item.variantOptions.map(pick))),
    };
  };
  const storage = rowsFor((option) => option.storageGb);
  const ram = rowsFor((option) => option.ramGb);
  if (storage.all.length === 0) return null;

  const blocks: {
    label: string;
    icon: CompareSpecIcon;
    data: ReturnType<typeof rowsFor>;
    format: (value: number) => string;
  }[] = [
    { label: "Penyimpanan", icon: "storage", data: storage, format: formatStorage },
    { label: "RAM", icon: "memory", data: ram, format: (value) => `${value} GB` },
  ];

  return (
    <section aria-labelledby="bagian-varian" className="mt-12">
      <h4
        id="bagian-varian"
        className="border-b border-border pb-3 text-lg font-bold text-foreground sm:text-xl"
      >
        Pilihan varian tercatat
      </h4>
      <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
        Kombinasi yang tercatat di katalog. Tanda – berarti ukuran itu tidak
        tercatat untuk produk tersebut, bukan pasti tidak dijual.
      </p>
      <div className="mt-6 space-y-8">
        {blocks.map((block) => (
          <div key={block.label} className={cn("grid gap-3 sm:gap-8", gridCols)}>
            {items.map((item, index) => (
              <div key={item.slug} className="flex min-w-0 flex-col items-center text-center">
                <SpecIcon name={block.icon} className="size-8 text-foreground sm:size-12" />
                <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                  {block.label}
                  <span className="sr-only">, {item.name}</span>
                </p>
                <OptionList
                  values={block.data.all}
                  has={block.data.perItem[index]!}
                  format={block.format}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
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
          <h3 className="text-base font-bold tracking-tight text-foreground">{item.model}</h3>
        </div>
        {isDemo ? <DemoBadge /> : null}
      </div>

      <div className="mt-4 flex items-center justify-center rounded-lg bg-muted/60 py-6">
        <Image
          src={item.image.src}
          alt={item.image.alt}
          width={96}
          height={144}
          className="h-36 w-auto"
        />
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
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {item.variantOptions.map((option) => (
              <li key={option.key}>
                <Link
                  href={option.href}
                  replace
                  scroll={false}
                  aria-current={option.key === item.variantKey ? "true" : undefined}
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
          className="text-center text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
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
          <section
            key={section.id}
            aria-labelledby={`bagian-${section.id}`}
            className="mt-12"
          >
            <h4
              id={`bagian-${section.id}`}
              className="border-b border-border pb-3 text-lg font-bold text-foreground sm:text-xl"
            >
              {section.title}
            </h4>
            <div className="mt-6 space-y-8">
              {section.rows.map((row) => (
                <div key={row.label} className={cn("grid gap-3 sm:gap-8", gridCols)}>
                  {items.map((item, index) => (
                    <SpecCell
                      key={item.slug}
                      row={row}
                      item={item}
                      index={index}
                      isComparing={isComparing}
                    />
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}

        <VariantOptions items={items} gridCols={gridCols} />

        {emptyLabels.length > 0 ? (
          <p className="mt-10 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Belum ada data untuk produk mana pun: {emptyLabels.join(", ")}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
