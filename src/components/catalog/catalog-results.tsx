import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { formatIdr } from "@/lib/catalog/pricing";
import type { CatalogSearchResult } from "@/lib/catalog/queries";
import {
  buildCatalogHref,
  countActiveFilters,
  type CatalogQuery,
} from "@/lib/catalog/search-params";

/**
 * Hasil katalog (PRD FR-02).
 *
 * - Jumlah hasil diumumkan lewat `role="status"` + `aria-live`, supaya
 *   perubahan hasil setelah menerapkan filter terdengar oleh pembaca layar,
 *   bukan hanya terlihat.
 * - Hasil kosong tidak berhenti di "tidak ditemukan". PRD meminta saran
 *   konkret, jadi setiap filter yang sedang aktif ditawarkan untuk dilepas satu
 *   per satu lewat tautan yang benar-benar berfungsi.
 * - Kartu menautkan ke halaman detail produk. Tautannya baru dinyalakan
 *   setelah `/products/[slug]` benar-benar ada, supaya afordansi hover tidak
 *   pernah menjanjikan tujuan yang belum dibangun (PRD §8).
 */

type Suggestion = { label: string; href: string };

function buildSuggestions(query: CatalogQuery): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (query.query) {
    suggestions.push({
      label: `Hapus kata kunci "${query.query}"`,
      href: buildCatalogHref(query, { query: "" }),
    });
  }

  for (const brand of query.brands) {
    suggestions.push({
      label: `Hapus merek ${brand}`,
      href: buildCatalogHref(query, {
        brands: query.brands.filter((item) => item !== brand),
      }),
    });
  }

  for (const ram of query.ram) {
    suggestions.push({
      label: `Hapus RAM ${ram} GB`,
      href: buildCatalogHref(query, {
        ram: query.ram.filter((item) => item !== ram),
      }),
    });
  }

  for (const storage of query.storage) {
    suggestions.push({
      label: `Hapus penyimpanan ${storage} GB`,
      href: buildCatalogHref(query, {
        storage: query.storage.filter((item) => item !== storage),
      }),
    });
  }

  if (query.minPrice !== null || query.maxPrice !== null) {
    const parts: string[] = [];
    if (query.minPrice !== null) parts.push(`dari ${formatIdr(query.minPrice)}`);
    if (query.maxPrice !== null) parts.push(`sampai ${formatIdr(query.maxPrice)}`);
    suggestions.push({
      label: `Hapus batas harga (${parts.join(" ")})`,
      href: buildCatalogHref(query, { minPrice: null, maxPrice: null }),
    });
  }

  return suggestions;
}

export function CatalogResults({
  result,
  query,
  now,
  isDemo,
}: {
  result: CatalogSearchResult;
  query: CatalogQuery;
  now: Date;
  isDemo: boolean;
}) {
  const activeCount = countActiveFilters(query);
  const suggestions = buildSuggestions(query);

  return (
    <div>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {activeCount === 0
          ? `Menampilkan ${result.matched} produk.`
          : `Menampilkan ${result.matched} dari ${result.totalPublished} produk setelah filter.`}
      </p>

      {result.items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-8">
          <h2 className="text-base font-bold text-foreground">
            Tidak ada produk yang cocok
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Katalog versi awal ini masih kecil, jadi kombinasi filter yang
            spesifik memang gampang tidak menemukan apa pun. Coba lepas salah
            satu filter berikut.
          </p>

          {suggestions.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion.href + suggestion.label}>
                  <Link
                    href={suggestion.href}
                    className="inline-flex min-h-11 items-center rounded-pill border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted"
                  >
                    {suggestion.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5">
            <Button asChild variant="outline">
              <Link href="/products">Reset semua filter</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((product) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                now={now}
                isDemo={isDemo}
                href={`/products/${product.slug}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
