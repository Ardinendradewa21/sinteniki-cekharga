"use client";

import Link from "next/link";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import type { CompareResult } from "@/lib/catalog/queries";

type Candidate = CompareResult["addable"][number];

/** Menyaring kandidat yang sudah tersedia tanpa permintaan data tambahan. */
export function CompareSearch({ candidates }: { candidates: Candidate[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.normalize("NFKC").trim().toLocaleLowerCase("id-ID");
  const matches = normalizedQuery
    ? candidates.filter((candidate) =>
        candidate.name.normalize("NFKC").toLocaleLowerCase("id-ID").includes(normalizedQuery)
      )
    : candidates;

  return (
    <div className="mt-5">
      <label htmlFor="cari-pembanding" className="mb-2 block text-sm font-semibold text-foreground">
        Cari produk untuk dibandingkan
      </label>
      <Input
        id="cari-pembanding"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ketik merek atau nama model..."
        autoComplete="off"
      />
      <p role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">
        {normalizedQuery
          ? `${matches.length} produk ditemukan dari ${candidates.length} kandidat tersedia.`
          : `${candidates.length} produk tersedia. Ketik untuk mempersempit daftar.`}
      </p>

      {matches.length === 0 ? (
        <p className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          Produk tidak ditemukan. Coba nama merek atau model lain.
        </p>
      ) : (
        <ul className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((candidate) => (
            <li key={candidate.slug}>
              <Link
                href={candidate.href}
                prefetch={false}
                className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm transition-colors hover:border-brand/50 hover:bg-brand-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 font-semibold text-foreground">{candidate.name}</span>
                <span aria-hidden="true" className="shrink-0 text-xs font-bold text-brand">+ Tambah</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
