import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { CatalogPagination } from "@/components/catalog/catalog-pagination";
import { RevealItem } from "@/components/motion/reveal-item";
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
      label: `Hapus pencarian “${query.query}”`,
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

/** Posisi iklan in-feed: setelah 10 produk (dua baris di layar lebar). */
const IN_FEED_AFTER = 10;

export function CatalogResults({
  result,
  query,
  now,
  isDemo,
  inFeedAd,
}: {
  result: CatalogSearchResult;
  query: CatalogQuery;
  now: Date;
  isDemo: boolean;
  /** Slot iklan in-feed (dirender server), opsional. */
  inFeedAd?: ReactNode;
}) {
  const activeCount = countActiveFilters(query);
  const suggestions = buildSuggestions(query);
  const hasReviewTopic = result.interpretation.hasReviewTopic;

  const first = (result.page - 1) * result.pageSize + 1;
  const last = first + result.items.length - 1;
  const range = result.totalPages > 1 ? `${first}-${last} dari ` : "";
  // Pencarian yang seluruh katanya diabaikan tidak menyaring apa pun, jadi
  // "X dari X produk yang cocok" hanya membingungkan.
  const statusText =
    activeCount === 0 || result.matched === result.totalPublished
      ? `Menampilkan ${range}${result.matched} produk.`
      : `Menampilkan ${range}${result.matched} produk yang cocok (dari ${result.totalPublished} produk).`;

  return (
    // Target lompatan pagination: pindah halaman langsung ke awal hasil,
    // bukan ke atas halaman yang masih berisi panel filter.
    <div id="hasil" className="scroll-mt-24">
      {/*
        Judul wilayah hasil. Sengaja hanya untuk pembaca layar: judul ini tidak
        menambah apa pun secara visual karena halaman sudah punya h1 "Katalog
        smartphone", TETAPI tanpa h2 di sini struktur headingnya melompat dari
        h1 langsung ke h3 pada nama produk. Terukur di QA browser.
      */}
      <h2 className="sr-only">Hasil pencarian</h2>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {statusText}
      </p>

      {result.items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-8">
          <h2 className="heading-card text-foreground">
            {hasReviewTopic ? "Belum ada bukti ulasan yang cocok" : "Tidak ada produk yang cocok"}
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {hasReviewTopic
              ? "Tidak ada produk yang memenuhi seluruh syarat dan memiliki ulasan terbit tentang topik ini. Produk tanpa ulasan relevan bukan berarti buruk. Coba lepas salah satu filter berikut."
              : "Katalog versi awal ini masih kecil, jadi kombinasi filter yang spesifik memang gampang tidak menemukan apa pun. Coba lepas salah satu filter berikut."}
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
        <ul className="-mx-2 mt-6 grid grid-cols-2 gap-2 sm:mx-0 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {result.items.map((product, index) => (
            <Fragment key={product.id}>
            {/* Iklan in-feed selebar satu baris, setelah 10 produk pertama:
                terpisah jelas dari hasil, bukan berbentuk kartu produk. */}
            {inFeedAd && index === IN_FEED_AFTER && result.items.length > IN_FEED_AFTER ? (
              <li className="col-span-full px-2 py-2 sm:px-0">{inFeedAd}</li>
            ) : null}
            <RevealItem index={index}>
              <ProductCard
                product={product}
                now={now}
                isDemo={isDemo}
                href={`/products/${product.slug}`}
                eager={index < 5}
              />
              {result.semanticReviews[product.id]?.map((review) => (
                <div key={`${product.id}-${review.channelName}-${review.summary}`} className="mt-2 rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-foreground">
                  <p className="font-semibold text-muted-foreground">Catatan reviewer: {review.channelName}</p>
                  <p className="mt-1 line-clamp-3">{review.summary}</p>
                  {!isDemo && /^https?:\/\//.test(review.videoUrl) ? (
                    <a
                      href={review.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Lihat sumber ulasan
                    </a>
                  ) : null}
                </div>
              ))}
            </RevealItem>
            </Fragment>
          ))}
        </ul>
      )}

      <CatalogPagination
        query={query}
        page={result.page}
        totalPages={result.totalPages}
      />
    </div>
  );
}
