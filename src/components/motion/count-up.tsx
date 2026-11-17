"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";

import { formatIdr } from "@/lib/catalog/pricing";
import { transition } from "@/lib/motion";
import { cn } from "@/lib/utils";

type CountUpFormat = "idr" | "number";

function formatValue(value: number, format: CountUpFormat): string {
  const rounded = Math.round(value);
  // Sama dengan formatIdr (tanpa Intl) supaya hasil server dan klien identik.
  return format === "idr" ? formatIdr(rounded) : formatIdr(rounded).slice(2);
}

/**
 * Angka yang bergulir dari nilai lama ke nilai baru (DESIGN.md §8.4).
 *
 * - Render pertama, termasuk HTML server, selalu nilai akhir. Tidak pernah
 *   mulai dari 0 dan tidak pernah menampilkan "Rp0" (PRD §7: harga kosong
 *   bukan nol), dan harga LCP tidak menunggu JavaScript (antislop R-40).
 * - Animasi hanya saat `value` berubah setelah mount, misalnya pengguna
 *   mengganti varian kapasitas. Interupsi aman: animasi baru mulai dari angka
 *   yang sedang tampil.
 * - Teks diperbarui Motion langsung lewat MotionValue, tanpa render ulang React.
 * - Angka yang bergulir `aria-hidden`; pembaca layar hanya menerima nilai akhir
 *   lewat elemen `sr-only` ber-`aria-live="polite"`.
 * - Reduced motion: nilai langsung berganti.
 *
 * Hanya untuk angka yang ada. Harga yang tidak tersedia ditangani pemanggil
 * ("Harga belum tersedia"), bukan dianimasikan.
 */
export function CountUp({
  value,
  format = "idr",
  className,
}: {
  value: number;
  format?: CountUpFormat;
  className?: string;
}) {
  const current = useMotionValue(value);
  const display = useTransform(current, (latest) => formatValue(latest, format));
  const reduce = useReducedMotion();

  useEffect(() => {
    if (current.get() === value) return;
    if (reduce) {
      current.jump(value);
      return;
    }
    const controls = animate(current, value, transition.dataReveal);
    return () => controls.stop();
  }, [current, value, reduce]);

  return (
    <span className={cn("tabular-nums", className)}>
      <motion.span aria-hidden="true">{display}</motion.span>
      <span className="sr-only" aria-live="polite">
        {formatValue(value, format)}
      </span>
    </span>
  );
}
