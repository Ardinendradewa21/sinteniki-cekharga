import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CompareSearch } from "@/components/compare/compare-search";
import { MAX_COMPARE_ITEMS } from "@/lib/catalog/compare-params";
import type { CompareResult } from "@/lib/catalog/queries";

/** Pilihan kandidat tetap ada di URL agar hasil bandingkan bisa dibagikan. */
export function ComparePicker({ result }: { result: CompareResult }) {
  return (
    <section aria-labelledby="pilih-kandidat" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">Langkah 1</p>
          <h2 id="pilih-kandidat" className="mt-1 heading-section text-foreground">
            Pilih produk
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilih dua atau tiga produk. Varian dapat diganti setelah produk dipilih.
          </p>
        </div>
        <Badge variant="brand" className="px-3 py-1.5">
          {result.items.length}/{MAX_COMPARE_ITEMS} dipilih
        </Badge>
      </div>

      {result.items.length > 0 ? (
        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Produk terpilih</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((item) => (
              <li key={item.slug} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <span className="min-w-0 text-sm font-semibold text-foreground">{item.name}</span>
                <Link
                  href={item.removeHref}
                  aria-label={`Hapus ${item.name} dari perbandingan`}
                  className="inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Hapus
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.isFull ? (
        <p role="status" className="mt-5 rounded-xl bg-muted/50 p-4 text-sm text-foreground">
          Batas {MAX_COMPARE_ITEMS} produk tercapai. Hapus salah satu untuk memilih produk lain.
        </p>
      ) : result.addable.length === 0 ? (
        <p role="status" className="mt-5 rounded-xl bg-muted/50 p-4 text-sm text-foreground">
          Tidak ada produk terbit lain yang bisa ditambahkan.
        </p>
      ) : (
        <CompareSearch candidates={result.addable} />
      )}
    </section>
  );
}
