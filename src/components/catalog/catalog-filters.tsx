import Form from "next/form";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PARAM,
  SORT_LABELS,
  SORT_OPTIONS,
  countActiveFilters,
  type CatalogQuery,
} from "@/lib/catalog/search-params";
import type { CatalogFacets } from "@/lib/catalog/queries";

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
}: {
  query: CatalogQuery;
  facets: CatalogFacets;
}) {
  const activeCount = countActiveFilters(query);

  // Panel dibuka kalau yang aktif bukan cuma kata kunci, karena kata kunci
  // sudah terlihat di kolom pencarian di atas panel.
  const groupFilterCount = activeCount - (query.query ? 1 : 0);

  return (
    <Form action="/products" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="katalog-cari">Cari produk</Label>
          <Input
            id="katalog-cari"
            type="search"
            name={PARAM.query}
            defaultValue={query.query}
            placeholder="Nama atau merek"
            className="mt-2"
          />
        </div>

        <div className="sm:w-56">
          <Label htmlFor="katalog-urut">Urutkan</Label>
          <select
            id="katalog-urut"
            name={PARAM.sort}
            defaultValue={query.sort}
            className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-4 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" className="sm:mb-0">
          Terapkan
        </Button>
      </div>

      <details
        open={groupFilterCount > 0}
        className="rounded-xl border border-border bg-card"
      >
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-5 py-3 text-sm font-semibold text-foreground">
          Filter lainnya
          {groupFilterCount > 0 ? (
            <span className="rounded-pill bg-brand-muted px-2 py-0.5 text-xs font-semibold text-brand">
              {groupFilterCount} aktif
            </span>
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
