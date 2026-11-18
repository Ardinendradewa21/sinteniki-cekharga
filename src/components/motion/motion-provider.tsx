"use client";

import { LazyMotion, MotionConfig } from "motion/react";

// Fitur animasi dimuat setelah render pertama (audit 004 no. 2): sebelumnya
// seluruh pustaka Motion dieksekusi di jalur kritis (terukur 69 KB, ~765 ms
// scripting di Lighthouse mobile) dan menunda LCP beranda.
const loadFeatures = () => import("./motion-features").then((module) => module.default);

/**
 * Batas client tunggal untuk kebijakan motion seluruh situs.
 *
 * - `LazyMotion` + komponen `m.*` (dari "motion/react-m"): kode animasi
 *   dimuat malas. `strict` membuat komponen `motion.*` yang terlewat langsung
 *   error saat diuji, supaya manfaatnya tidak hilang diam-diam.
 * - `reducedMotion="user"` membaca `prefers-reduced-motion` dari OS pengguna
 *   dan mematikan animasi transform/layout pada semua komponen `m.*` di
 *   bawahnya (opacity tetap jalan); ini melengkapi blok
 *   `@media (prefers-reduced-motion: reduce)` di globals.css.
 *
 * Anak dari provider ini boleh tetap Server Component; provider hanya
 * menyediakan context, tidak mengubah anaknya jadi client.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
