"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

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
 * Jeda kecil per kolom (`index % columns`) membuat satu baris mengalir kiri ke
 * kanan tanpa membuat baris ke-4 menunggu lama. Saat pindah halaman, key
 * produk berganti sehingga kartu baru dipasang ulang dan animasinya berulang.
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
  return (
    <motion.li
      className={className}
      data-reveal=""
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.36,
        ease: [0.16, 1, 0.3, 1],
        delay: (index % columns) * 0.05,
      }}
    >
      {children}
    </motion.li>
  );
}
