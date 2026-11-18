"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { transition } from "@/lib/motion";

const format = (value: number) => Math.round(value).toLocaleString("id-ID");

/**
 * Angka KPI admin yang bergulir naik saat dasbor dibuka (gaya Veyla, AV-01).
 *
 * Hanya untuk JUMLAH di admin (produk, draft), bukan harga: aturan "harga
 * tidak pernah dihitung dari 0" (DESIGN.md §8.4) tetap berlaku di publik.
 * HTML server berisi nilai akhir; tanpa JavaScript atau dengan reduced motion
 * angkanya langsung tampil. Teks diubah lewat ref, tanpa render ulang React,
 * dan pembaca layar hanya menerima nilai akhir.
 */
export function KpiCount({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduce || value <= 0) return;
    const controls = animate(0, value, {
      ...transition.dataReveal,
      onUpdate: (latest) => {
        node.textContent = format(latest);
      },
    });
    return () => {
      controls.stop();
      node.textContent = format(value);
    };
  }, [value, reduce]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true">
        {format(value)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
