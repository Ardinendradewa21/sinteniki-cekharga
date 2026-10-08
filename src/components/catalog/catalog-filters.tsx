import Form from "next/form";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PARAM,
  SORT_LABELS,
  SORT_OPTIONS,
  buildCatalogHref,
  countActiveFilters,
  type CatalogQuery,
} from "@/lib/catalog/search-params";
import type { CatalogFacets, CatalogSearchResult } from "@/lib/catalog/queries";

/**
 * Panel filter katalog (PRD FR-02).
 *
 * Beberapa keputusan yang sengaja diambil:
 *
 * - Memakai `next/form`. State filter hidup di URL, form biasa sudah cukup, dan
 *   `next/form` menambahkan navigasi sisi klien tanpa mengorbankan form HTML
 *   yang tetap berfungsi kalau JavaScript gagal dimuat.
 *
 * - Kontrolnya native (`input`, `select`, `checkbox`), bukan primitive Radix.
 *   Akibatnya seluruh panel ini bisa tetap Server Component tanpa JS klien sama
 *   sekali (PRD §9: Client Component hanya untuk interaksi nyata). Primitive
 *   Select yang berbasis Radix tetap tersedia untuk kasus yang memang butuh
 *   interaksi, misalnya pemilih varian di halaman detail nanti.
 *
 * - Grup filter dibungkus `<details>`, memenuhi "filter mobile berupa
 *   disclosure" (PRD §8). Isinya berada di dalam form yang sama, jadi filter
 *   yang sedang tertutup TETAP ikut terkirim; menutup panel tidak diam-diam
 *   membatalkan filter. Panel dibuka otomatis ketika ada filter aktif supaya
 *   pengguna melihat apa yang sedang membatasi hasilnya.
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

export function CatalogFilters({
  query,
  facets,
  interpretation,
}: {
  query: CatalogQuery;
  facets: CatalogFacets;
  interpretation: CatalogSearchResult["interpretation"];
}) {
  const activeCount = countActiveFilters(query);

  // Kata kunci terlihat di atas panel disclosure, jadi tidak dihitung di sini.
  const groupFilterCount = activeCount - (query.query ? 1 : 0);

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

  return (
    <Form action="/products" className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="katalog-cari">Cari produk atau kebutuhan</Label>
            <Input
              id="katalog-cari"
              type="search"
              name={PARAM.query}
              defaultValue={query.query}
              maxLength={160}
              placeholder="Contoh: Samsung 5G NFC di bawah 5 juta"
              aria-describedby="katalog-cari-bantuan"
              className="mt-2"
            />
          </div>

          <div className="sm:w-56">
            <Label htmlFor="katalog-urut">Urutkan</Label>
            <select
              id="katalog-urut"
              name={PARAM.sort}
              defaultValue={query.sort}
              className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-4 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {SORT_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" className="sm:mb-0">
            Cari
          </Button>
        </div>
        <p id="katalog-cari-bantuan" className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Satu kolom untuk nama, merek, spesifikasi (mis. AMOLED, IP68, lipat),
          dan kebutuhan: batas harga, RAM/penyimpanan minimal, NFC, 5G, serta
          topik ulasan yang tercatat. Kualitas pemakaian tidak ditebak dari angka
          spesifikasi.
        </p>
      </div>

      {query.query ? (
        <div role="status" className="rounded-xl border border-brand/20 bg-brand-muted/30 p-4 text-sm">
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
            className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-brand underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Hapus pencarian
          </Link>
        </div>
      ) : null}

      <details
        open={groupFilterCount > 0}
        className="rounded-xl border border-border bg-card"
      >
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-5 py-3 text-sm font-semibold text-foreground">
          Filter lainnya
          {groupFilterCount > 0 ? (
            <Badge variant="brand">{groupFilterCount} aktif</Badge>
          ) : null}
        </summary>

        <div className="flex flex-col gap-6 border-t border-border px-5 py-5">
          <CheckboxGroup
            legend="Merek"
            name={PARAM.brand}
            options={facets.brands}
            selected={query.brands}
          />

          <CheckboxGroup
            legend="RAM"
            name={PARAM.ram}
            options={facets.ram}
            selected={query.ram}
            formatLabel={(option) => `${option} GB`}
          />

          <CheckboxGroup
            legend="Penyimpanan"
            name={PARAM.storage}
            options={facets.storage}
            selected={query.storage}
            formatLabel={(option) => `${option} GB`}
          />

          <fieldset>
            <legend className="text-sm font-semibold text-foreground">
              Rentang harga
            </legend>
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

          <div className="flex flex-wrap gap-3 border-t border-border pt-5">
            <Button type="submit">Terapkan filter</Button>
            {activeCount > 0 ? (
              <Button asChild variant="ghost">
                <Link href="/products">Reset semua</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </details>
    </Form>
  );
}
