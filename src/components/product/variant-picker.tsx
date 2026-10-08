import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Pemilih varian bersama untuk halaman detail dan perbandingan (audit UX-08).
 *
 * Berbasis tautan, bukan state klien: varian hidup di URL (PRD FR-03/FR-04),
 * jadi pilihan bisa dibagikan, Back/Forward bekerja, dan tanpa JavaScript pun
 * tetap berfungsi. Pilihan aktif ditandai `aria-current` + token `primary`
 * (charcoal, sama dengan CTA utama), bukan warna saja.
 *
 * - `detail`: dua baris (ukuran + status harga varian itu), untuk halaman detail.
 * - `compact`: satu baris, untuk kolom perbandingan yang sempit.
 * Bentuk, ukuran sentuh (44px), dan warna aktif sama di kedua mode.
 */
export type VariantPickerOption = {
  key: string;
  label: string;
  href: string;
  selected: boolean;
  /** Baris kedua di mode detail, mis. "Ada penawaran" / "Harga belum tersedia". */
  note?: string;
};

export function VariantPicker({
  options,
  mode = "detail",
  scroll = true,
  className,
}: {
  options: VariantPickerOption[];
  mode?: "detail" | "compact";
  /** `false` di halaman perbandingan supaya posisi gulir tidak melompat. */
  scroll?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => (
        <li key={option.key}>
          <Link
            href={option.href}
            replace
            scroll={scroll}
            aria-current={option.selected ? "true" : undefined}
            className={cn(
              "flex min-h-11 flex-col justify-center rounded-xl border px-4 py-1.5 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              option.selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-strong bg-card text-foreground hover:bg-muted"
            )}
          >
            <span className="font-semibold">{option.label}</span>
            {mode === "detail" && option.note ? (
              <span
                className={cn(
                  "text-xs",
                  option.selected ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                {option.note}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
