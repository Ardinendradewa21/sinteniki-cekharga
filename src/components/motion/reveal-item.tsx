"use client";

import { useRef, type ReactNode } from "react";

import { STAGGER_STEP } from "@/lib/motion";

import { useRevealOnScroll } from "./use-reveal";

// Modul terpisah dari reveal.tsx dengan sengaja: menambah export baru ke modul
// "use client" yang sudah dimuat membuat manifest client reference Turbopack
// dev basi ("Lazy element type must resolve to a class or function").

/**
 * Item grid yang muncul sendiri-sendiri saat masuk viewport.
 *
 * Berbeda dari `StaggerList`, yang memicu SELURUH daftar sekaligus begitu
 * ujung atasnya terlihat: di katalog panjang, kartu di baris bawah jadi sudah
 * "selesai muncul" sebelum pengguna sampai ke sana. Di sini setiap kartu
 * dipicu oleh posisinya sendiri, jadi kartu muncul mengikuti scroll.
 *
 * Jeda kecil per kolom (`index % columns`, 50ms) membuat satu baris mengalir
 * kiri ke kanan tanpa membuat baris ke-4 menunggu lama. Kartu yang sudah
 * terlihat saat halaman dibuka tampil langsung (DESIGN.md §8.3). Saat pindah
 * halaman, key produk berganti sehingga kartu baru dipasang ulang.
 */
export function RevealItem({
  children,
  className,
  index = 0,
  columns = 5,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  columns?: number;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useRevealOnScroll(ref, { mode: "self", delay: (index % columns) * STAGGER_STEP });
  return (
    <li ref={ref} className={className}>
      {children}
    </li>
  );
}
