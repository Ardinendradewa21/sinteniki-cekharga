"use client";

import { MotionConfig } from "motion/react";

/**
 * Batas client tunggal untuk kebijakan motion seluruh situs.
 *
 * `reducedMotion="user"` membaca `prefers-reduced-motion` dari OS pengguna dan
 * otomatis mematikan animasi transform/layout pada semua komponen `motion.*`
 * di bawahnya (opacity tetap jalan) — ini terpisah dari, dan melengkapi, blok
 * `@media (prefers-reduced-motion: reduce)` di globals.css yang menahan
 * animasi CSS biasa. Anak dari provider ini boleh tetap Server Component;
 * MotionConfig hanya menyediakan context, tidak mengubah anaknya jadi client.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
