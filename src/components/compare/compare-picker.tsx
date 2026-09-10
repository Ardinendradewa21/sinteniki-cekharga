import Link from "next/link";

import type { CompareResult } from "@/lib/catalog/queries";
import { MAX_COMPARE_ITEMS } from "@/lib/catalog/compare-params";

/**
 * Penambah kandidat perbandingan (PRD FR-04: "tambah/hapus pembanding bekerja").
 *
 * Berupa tautan biasa, bukan kontrol berstate, karena pilihan perbandingan
 * memang hidup di URL. Konsekuensinya tombol tambah tetap berfungsi tanpa
 * JavaScript dan hasilnya bisa langsung dibagikan.
 */
export function ComparePicker({
  result,
  selectedCount,
}: {
  result: CompareResult;
  selectedCount: number;
}) {
  if (result.isFull) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">
          Sudah {MAX_COMPARE_ITEMS} kandidat
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Batasnya {MAX_COMPARE_ITEMS} supaya perbandingannya tetap terbaca.
          Hapus salah satu dulu kalau mau menukar kandidat.
        </p>
      </div>
    );
  }

  if (result.addable.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">
          Tidak ada kandidat lain
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Semua produk terpublikasi sudah masuk perbandingan ini.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">
        {selectedCount === 0
          ? "Pilih kandidat pertama"
          : selectedCount === 1
            ? "Tambah satu kandidat lagi untuk mulai membandingkan"
            : "Tambah kandidat"}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Varian bisa diganti setelah kandidatnya masuk.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {result.addable.map((candidate) => (
          <li key={candidate.slug}>
            <Link
              href={candidate.href}
              className="inline-flex min-h-11 items-center rounded-pill border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted"
            >
              {candidate.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
