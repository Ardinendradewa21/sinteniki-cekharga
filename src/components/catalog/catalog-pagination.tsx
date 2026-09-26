import Link from "next/link";

import { buildCatalogHref, type CatalogQuery } from "@/lib/catalog/search-params";
import { cn } from "@/lib/utils";

/**
 * Navigasi halaman katalog (PRD FR-02).
 *
 * Tautan biasa, bukan tombol berbasis state: halaman tercermin di URL (`?hal=`)
 * sehingga bisa dibagikan, dipulihkan saat reload, dan tetap berfungsi tanpa
 * JavaScript. Seluruh filter aktif ikut terbawa di setiap tautan.
 */

type PageItem = number | "gap";

/** 1 … (p-1) p (p+1) … N, supaya jumlah tautan tetap kecil di katalog besar. */
function pageWindow(current: number, total: number): PageItem[] {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const items: PageItem[] = [];
  for (const page of sorted) {
    const previous = items[items.length - 1];
    if (typeof previous === "number" && page - previous > 1) items.push("gap");
    items.push(page);
  }
  return items;
}

const itemClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring";

export function CatalogPagination({
  query,
  page,
  totalPages,
}: {
  query: CatalogQuery;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  // `#hasil` membawa pengguna ke awal daftar hasil, bukan ke panel filter di
  // atas halaman, sehingga kartu halaman berikutnya langsung terlihat muncul.
  const href = (target: number) =>
    `${buildCatalogHref(query, { page: target })}#hasil`;

  return (
    <nav aria-label="Halaman hasil katalog" className="mt-10">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link
              href={href(page - 1)}
              rel="prev"
              className={cn(itemClass, "border border-border bg-card text-foreground hover:bg-muted")}
            >
              Sebelumnya
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(itemClass, "border border-border text-muted-foreground opacity-50")}
            >
              Sebelumnya
            </span>
          )}
        </li>

        {pageWindow(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-sm text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              {item === page ? (
                <span
                  aria-current="page"
                  className={cn(itemClass, "bg-primary text-primary-foreground")}
                >
                  <span className="sr-only">Halaman </span>
                  {item}
                </span>
              ) : (
                <Link
                  href={href(item)}
                  className={cn(itemClass, "text-foreground hover:bg-muted")}
                >
                  <span className="sr-only">Halaman </span>
                  {item}
                </Link>
              )}
            </li>
          )
        )}

        <li>
          {page < totalPages ? (
            <Link
              href={href(page + 1)}
              rel="next"
              className={cn(itemClass, "border border-border bg-card text-foreground hover:bg-muted")}
            >
              Berikutnya
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(itemClass, "border border-border text-muted-foreground opacity-50")}
            >
              Berikutnya
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
