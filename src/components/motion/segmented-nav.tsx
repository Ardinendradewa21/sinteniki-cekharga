"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useId, type ReactNode } from "react";

import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Segmented Control versi tautan (DESIGN.md §7, VD-05).
 *
 * Untuk pilihan yang hidup di URL (urutan katalog, kelak varian produk): tiap
 * pilihan adalah `<a href>` dengan `aria-current`, jadi tetap berfungsi tanpa
 * JavaScript dan bisa dibuka di tab baru. Pola aksesibilitasnya navigasi
 * (`<nav>` + `aria-current`), bukan radio group: berpindah pilihan memang
 * berpindah alamat.
 *
 * Thumb bergeser dengan `layoutId` unik per instance saat komponen bertahan
 * di antara navigasi klien; reduced motion = pindah seketika. Status terpilih
 * tidak hanya dari warna: thumb bergaris border-strong (3.5:1 terhadap track)
 * dan `aria-current`.
 */
export function SegmentedNav({
  label,
  items,
  className,
}: {
  /** Nama navigasi untuk pembaca layar, mis. "Urutkan produk". */
  label: string;
  items: readonly { href: string; label: ReactNode; active: boolean }[];
  className?: string;
}) {
  const thumbId = useId();
  const { transition } = useMotionPreset();

  return (
    <nav
      aria-label={label}
      className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-border bg-muted p-1", className)}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={cn(
            "relative inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            item.active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.active ? (
            <motion.span
              aria-hidden="true"
              layoutId={`segmented-nav-thumb-${thumbId}`}
              transition={transition("thumb")}
              className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-border-strong dark:bg-accent"
            />
          ) : null}
          <span className="relative">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
