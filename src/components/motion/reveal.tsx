"use client";

import { useRef, type ReactNode } from "react";

import { useRevealOnScroll } from "./use-reveal";

/**
 * Entrance saat elemen memasuki viewport, dipakai untuk daftar/grid berisi
 * data nyata (kartu produk, kartu perbandingan, FAQ), bukan diagram konsep.
 *
 * Perilaku (DESIGN.md §8, lihat `useRevealOnScroll`):
 * - Server mengirim konten terlihat; hanya elemen di bawah lipatan pertama
 *   yang disembunyikan lalu dimunculkan sekali saat discroll.
 * - Entrance 450ms ease-out-quint, geser 12px. Daftar memakai stagger 50ms
 *   per item, maksimal 8 item yang dijeda; urutannya membantu mata memindai,
 *   bukan sekadar bergerak.
 * - Reduced motion: tanpa animasi.
 */

export function StaggerList({
  children,
  className,
  as = "ul",
}: {
  children: ReactNode;
  className?: string;
  as?: "ul" | "div" | "dl";
}) {
  // Satu ref untuk ketiga elemen yang mungkin dirender (ul, div, dl).
  const ref = useRef<HTMLUListElement & HTMLDivElement & HTMLDListElement>(null);
  useRevealOnScroll(ref, { mode: "children" });
  const Component = as;
  return (
    <Component ref={ref} className={className}>
      {children}
    </Component>
  );
}

/**
 * Anak langsung `StaggerList`. Tidak membawa animasi sendiri: induknya yang
 * menganimasikan anak-anak langsungnya secara berurutan.
 */
export function StaggerItem({
  children,
  className,
  as = "li",
}: {
  children: ReactNode;
  className?: string;
  as?: "li" | "div";
}) {
  const Component = as;
  return <Component className={className}>{children}</Component>;
}

/** Entrance tunggal untuk elemen yang bukan bagian dari daftar. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useRevealOnScroll(ref, { mode: "self", delay });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
