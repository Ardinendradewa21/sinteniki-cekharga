"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, type ReactNode } from "react";

import { useHydrated } from "@/components/motion/use-hydrated";
import { useRevealOnScroll } from "@/components/motion/use-reveal";
import { ENTRANCE_OFFSET_Y, STAGGER_STEP, useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Grid hasil katalog yang bergerak saat hasil berubah (DESIGN.md §8, VD-05).
 *
 * - Halaman dibuka: tidak ada animasi untuk kartu yang terlihat; kartu di
 *   bawah lipatan muncul saat discroll (useRevealOnScroll), sama seperti
 *   sebelumnya.
 * - Filter, urutan, atau pencarian berubah (navigasi klien, komponen ini
 *   bertahan): kartu yang tetap ada bergeser ke posisi barunya dengan layout
 *   animation 450ms, kartu baru muncul fade-up, kartu yang hilang memudar.
 * - Reduced motion: semua seketika.
 *
 * Pengumuman jumlah hasil tetap lewat `role="status"` di CatalogResults.
 */
export function CatalogGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    // relative: kartu yang keluar (mode popLayout) diposisikan absolut di sini.
    <ul className={cn("relative", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </ul>
  );
}

export function CatalogGridItem({
  children,
  index = 0,
  columns = 5,
  className,
}: {
  children: ReactNode;
  index?: number;
  columns?: number;
  className?: string;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const hydrated = useHydrated();
  const { reduce, transition } = useMotionPreset();
  const delay = (index % columns) * STAGGER_STEP;

  // Hanya berpengaruh pada render pertama halaman (kartu di bawah lipatan).
  useRevealOnScroll(ref, { mode: "self", delay });

  return (
    <motion.li
      ref={ref}
      layout={reduce ? false : "position"}
      // Kartu yang ada sejak halaman dibuka: tanpa animasi masuk. Kartu yang
      // muncul setelah hasil berubah: fade-up.
      initial={hydrated && !reduce ? { opacity: 0, y: ENTRANCE_OFFSET_Y } : false}
      animate={{ opacity: 1, y: 0, transition: { ...transition("entrance"), delay: reduce ? 0 : delay } }}
      exit={{ opacity: 0, transition: transition("exit") }}
      transition={transition("layout")}
      className={className}
    >
      {children}
    </motion.li>
  );
}
