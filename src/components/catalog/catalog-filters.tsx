import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, FilterHorizontalIcon } from "@hugeicons/core-free-icons";

import { FilterPopoverDismiss } from "@/components/catalog/filter-popover-dismiss";
import { SegmentedNav } from "@/components/motion/segmented-nav";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIdr } from "@/lib/catalog/pricing";
import {
  PARAM,
  SORT_LABELS,
  SORT_OPTIONS,
  buildCatalogHref,
  type CatalogQuery,
} from "@/lib/catalog/search-params";
import type { CatalogFacets, CatalogSearchResult } from "@/lib/catalog/queries";

/**
 * Pencarian dan filter katalog (PRD FR-02; bilah filter Sprint 13 S13-4).
 *
 * Beberapa keputusan yang sengaja diambil:
 *
 * - Memakai `next/form`. State filter hidup di URL, form biasa sudah cukup, dan
 *   `next/form` menambahkan navigasi sisi klien tanpa mengorbankan form HTML
 *   yang tetap berfungsi kalau JavaScript gagal dimuat.
 *
 * - Kontrolnya native (`input`, `select`, `checkbox`, `details`), bukan
 *   primitive Radix, supaya panel ini tetap Server Component (PRD §9). Satu
 *   komponen klien kecil (FilterPopoverDismiss) hanya menambah perilaku
 *   popover: Escape, klik di luar, satu panel terbuka, urutan langsung jalan.
 *
 * - Filter berupa chip tepat di bawah kotak cari, masing-masing `<details>`
 *   di dalam form yang sama. Panel yang tertutup TETAP ikut terkirim, jadi
 *   menutup panel tidak diam-diam membatalkan filter. Di ponsel panelnya
 *   muncul dari bawah layar, di layar lebar sebagai dropdown di bawah chip.
 *
 * - Filter aktif tampil sebagai chip yang bisa dihapus satu per satu, supaya
 *   pengguna melihat apa yang sedang membatasi hasilnya tanpa membuka panel.
 */

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
  formatLabel,
}: {
  legend: string;
  name: string;
  options: readonly (string | number)[];
  selected: readonly (string | number)[];
  formatLabel?: (option: string | number) => string;
}) {
  if (options.length === 0) return null;

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">
        {legend}
      </legend>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {options.map((option) => (
          <label
            key={String(option)}
            className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground"
          >
            <input
              type="checkbox"
              name={name}
              value={String(option)}
              defaultChecked={selected.includes(option)}
              className="size-4 shrink-0 rounded border-border-strong accent-brand"
            />
            {formatLabel ? formatLabel(option) : String(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FilterChip({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details data-filter-pop="" className="group relative">
      <summary
        className={
          "inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-pill border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden " +
          (count > 0
            ? "border-brand/40 bg-brand-muted text-brand-text hover:bg-brand/15"
            : "border-border-strong bg-card text-foreground hover:bg-muted group-open:bg-muted")
        }
      >
        {label}
        {count > 0 ? (
          <span className="tabular inline-flex min-w-5 items-center justify-center rounded-pill bg-brand px-1.5 text-xs font-bold text-brand-foreground">
            <span className="sr-only">, </span>
            {count}
            <span className="sr-only"> aktif</span>
          </span>
        ) : null}
        <ChevronDownIcon size={16} aria-hidden className="transition-transform duration-150 group-open:rotate-180" />
      </summary>
      {/* Latar redup khusus ponsel: panel muncul dari bawah layar seperti
          lembar, jadi isi di belakangnya diredupkan (audit 001 temuan 8).
          Ketukan di latar menutup panel lewat FilterPopoverDismiss. */}
      <div data-filter-backdrop="" aria-hidden className="fixed inset-0 z-60 bg-scrim sm:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-60 max-h-[75vh] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:max-h-[60vh] sm:w-80 sm:rounded-xl">
        {children}
        <div className="mt-4 border-t border-border pt-4">
          <Button type="submit" className="w-full sm:w-auto">
            Tampilkan hasil
          </Button>
        </div>
      </div>
    </details>
  );
}

export function CatalogFilters({
  query,
  facets,
  interpretation,
}: {
  query: CatalogQuery;
  facets: CatalogFacets;
  interpretation: CatalogSearchResult["interpretation"];
}) {
  const hasReading =
    interpretation.appliedLabels.length > 0 || interpretation.keywords.length > 0;
  const notes = [
    ...interpretation.cautions,
    ...(interpretation.ignoredWords.length > 0
      ? [
          `Tidak ditemukan di nama, merek, maupun spesifikasi produk mana pun, jadi diabaikan: ${interpretation.ignoredWords
            .map((word) => `“${word}”`)
            .join(", ")}.`,
        ]
      : []),
    ...(interpretation.subjectiveWords.length > 0
      ? [
          `Kata penilaian seperti ${interpretation.subjectiveWords
            .map((word) => `“${word}”`)
            .join(", ")} tidak bisa diukur dari data. Tulis batas yang jelas, mis. “di bawah 5 juta”.`,
        ]
      : []),
  ];

  const priceCount = (query.minPrice !== null ? 1 : 0) + (query.maxPrice !== null ? 1 : 0);
  // Menghapus semua filter tetap mempertahankan kata pencarian dan urutan.
  const clearFilters = buildCatalogHref(query, {
    brands: [],
    ram: [],
    storage: [],
    minPrice: null,
    maxPrice: null,
  });
  const activeChips = [
    ...query.brands.map((brand) => ({
      label: brand,
      href: buildCatalogHref(query, { brands: query.brands.filter((item) => item !== brand) }),
    })),
    ...query.ram.map((ram) => ({
      label: `RAM ${ram} GB`,
      href: buildCatalogHref(query, { ram: query.ram.filter((item) => item !== ram) }),
    })),
    ...query.storage.map((storage) => ({
      label: `Penyimpanan ${storage} GB`,
      href: buildCatalogHref(query, { storage: query.storage.filter((item) => item !== storage) }),
    })),
    ...(query.minPrice !== null
      ? [{ label: `Min ${formatIdr(query.minPrice)}`, href: buildCatalogHref(query, { minPrice: null }) }]
      : []),
    ...(query.maxPrice !== null
      ? [{ label: `Maks ${formatIdr(query.maxPrice)}`, href: buildCatalogHref(query, { maxPrice: null }) }]
      : []),
  ];

  const sortLinks = SORT_OPTIONS.map((option) => ({
    // #hasil: setelah urutan berganti, mulai membaca dari awal hasil.
    href: `${buildCatalogHref(query, { sort: option })}#hasil`,
    label: SORT_LABELS[option],
    active: query.sort === option,
  }));

  return (
    <>
      {/*
        Filter Bar (DESIGN.md §7, VD-05). Mulai lg menempel di bawah Glass
        Header sebagai kaca berteks + blur; di bawah lg tetap kartu biasa,
        karena bar setinggi ini memakan layar ponsel dan backdrop-filter
        membuat lembar bawah filter (position: fixed) salah posisi.
        z-[45]: di atas Compare Tray (40), di bawah header (50).
        Form sengaja hanya berisi kontrol; teks bantuan, filter aktif, dan
        tafsiran pencarian ada di luarnya supaya bar tetap ringkas.
      */}
      <Form
        action="/products"
        className="rounded-xl p-3 max-lg:border max-lg:border-border max-lg:bg-card sm:p-5 lg:glass-text lg:glass-float lg:sticky lg:top-(--header-h) lg:z-[45] lg:p-3"
      >
        <FilterPopoverDismiss />
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="katalog-cari" className="lg:sr-only">
              Cari produk atau kebutuhan
            </Label>
            <Input
              id="katalog-cari"
              type="search"
              name={PARAM.query}
              defaultValue={query.query}
              maxLength={160}
              placeholder="Contoh: Samsung 5G NFC di bawah 5 juta"
              aria-describedby="katalog-cari-bantuan"
              className="mt-2 lg:mt-0"
            />
          </div>
          <Button type="submit">Cari</Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <HugeiconsIcon icon={FilterHorizontalIcon} size={16} strokeWidth={2} aria-hidden />
            Filter
          </span>
          {facets.brands.length > 0 ? (
            <FilterChip label="Merek" count={query.brands.length}>
              <CheckboxGroup legend="Merek" name={PARAM.brand} options={facets.brands} selected={query.brands} />
            </FilterChip>
          ) : null}
          {facets.ram.length > 0 ? (
            <FilterChip label="RAM" count={query.ram.length}>
              <CheckboxGroup
                legend="RAM"
                name={PARAM.ram}
                options={facets.ram}
                selected={query.ram}
                formatLabel={(option) => `${option} GB`}
              />
            </FilterChip>
          ) : null}
          {facets.storage.length > 0 ? (
            <FilterChip label="Penyimpanan" count={query.storage.length}>
              <CheckboxGroup
                legend="Penyimpanan"
                name={PARAM.storage}
                options={facets.storage}
                selected={query.storage}
                formatLabel={(option) => `${option} GB`}
              />
            </FilterChip>
          ) : null}
          <FilterChip label="Harga" count={priceCount}>
            <fieldset>
              <legend className="text-sm font-semibold text-foreground">Rentang harga</legend>
              <p className="mt-1 text-xs text-muted-foreground">
                Produk yang harganya belum tersedia tidak ikut disaring ke sini,
                karena harga yang tidak diketahui bukan berarti murah.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="katalog-harga-min" className="text-xs font-normal text-muted-foreground">
                    Minimum (Rupiah)
                  </Label>
                  <Input
                    id="katalog-harga-min"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={100000}
                    name={PARAM.minPrice}
                    defaultValue={query.minPrice ?? ""}
                    placeholder="0"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="katalog-harga-max" className="text-xs font-normal text-muted-foreground">
                    Maksimum (Rupiah)
                  </Label>
                  <Input
                    id="katalog-harga-max"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={100000}
                    name={PARAM.maxPrice}
                    defaultValue={query.maxPrice ?? ""}
                    placeholder="Tanpa batas"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </fieldset>
          </FilterChip>

          {/* Urutan: tautan bersegmen mulai lg (tetap jalan tanpa JavaScript),
              select native di layar lebih kecil. Select tetap ada di form pada
              lg (tersembunyi) supaya tombol Cari membawa urutan yang aktif. */}
          <SegmentedNav label="Urutkan produk" items={sortLinks} className="ml-auto hidden lg:inline-flex" />
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto lg:hidden">
            <Label htmlFor="katalog-urut" className="shrink-0 text-sm font-normal text-muted-foreground">
              Urutkan
            </Label>
            <select
              id="katalog-urut"
              name={PARAM.sort}
              defaultValue={query.sort}
              data-auto-submit=""
              className="h-11 min-w-0 flex-1 cursor-pointer rounded-pill border border-input bg-card px-4 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {SORT_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Form>

      <p id="katalog-cari-bantuan" className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
        Bisa nama, spesifikasi (AMOLED, IP68), atau kebutuhan seperti “NFC di bawah 5 juta”.
        Kualitas pemakaian tidak ditebak dari angka spesifikasi.
      </p>

      {activeChips.length > 0 ? (
        <ul aria-label="Filter aktif" className="mt-3 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <li key={chip.label}>
              <Link
                href={chip.href}
                aria-label={`Hapus filter ${chip.label}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-brand-muted px-3.5 text-sm font-medium text-brand-text transition-colors duration-150 hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {chip.label}
                <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} aria-hidden />
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={clearFilters}
              className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Hapus semua filter
            </Link>
          </li>
        </ul>
      ) : null}

      {query.query ? (
        <div role="status" className="mt-3 rounded-xl border border-brand/20 bg-card p-4 text-sm">
          <p className="font-semibold text-foreground">
            {hasReading ? "Pencarian dibaca sebagai:" : "Pencarian ini belum menjadi filter:"}
          </p>
          {hasReading ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {interpretation.keywords.length > 0 ? (
                <li className="rounded-full border border-brand/20 bg-card px-3 py-1.5 text-xs font-medium text-foreground">
                  Kata kunci: {interpretation.keywords.join(" ")}
                </li>
              ) : null}
              {interpretation.appliedLabels.map((label) => (
                <li key={label} className="rounded-full border border-brand/20 bg-card px-3 py-1.5 text-xs font-medium text-foreground">
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
          {notes.map((note) => (
            <p key={note} className="mt-2 text-xs leading-relaxed text-muted-foreground">{note}</p>
          ))}
          {interpretation.hasReviewTopic ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Hasil dari topik ulasan berarti ada reviewer yang membahasnya, bukan jaminan produk itu cocok; ulasan bisa menyebut kekurangan.
            </p>
          ) : null}
          <Link
            href={buildCatalogHref(query, { query: "" })}
            className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-brand-text underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Hapus pencarian
          </Link>
        </div>
      ) : null}
    </>
  );
}
