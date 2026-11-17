"use client";

import { animate } from "motion/react";
import { useLayoutEffect, useRef, type ReactNode } from "react";

import { useHydrated } from "@/components/motion/use-hydrated";
import { ENTRANCE_OFFSET_Y, staggerDelay, transition } from "@/lib/motion";

/**
 * Kartu yang muncul bertahap saat data NYATA tiba setelah interaksi, mis.
 * hasil Tanya AI (VD-08, DESIGN.md §8). Berbeda dari Reveal (saat digulir):
 * ini berjalan sekali saat komponen dipasang setelah hydration. Konten yang
 * sudah ada saat halaman dibuka, tanpa JavaScript, atau dengan reduced
 * motion tampil seketika.
 *
 * `selector` memilih elemen yang dianimasikan di dalamnya (maks. 8 dijeda).
 */
export function ArrivalStagger({
  children,
  selector = "article, [data-product-card]",
  className,
}: {
  children: ReactNode;
  selector?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  // Nilai saat pertama dipasang: dipasang saat hydration = konten awal halaman.
  const animateOnMount = useRef(hydrated);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !animateOnMount.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = Array.from(element.querySelectorAll<HTMLElement>(selector));
    if (targets.length === 0) return;
    for (const target of targets) {
      target.style.opacity = "0";
      target.style.transform = `translateY(${ENTRANCE_OFFSET_Y}px)`;
    }
    const controls = animate(
      targets,
      { opacity: [0, 1], y: [ENTRANCE_OFFSET_Y, 0] },
      { ...transition.entrance, delay: (index: number) => staggerDelay(index) }
    );
    return () => {
      controls.stop();
      for (const target of targets) {
        target.style.opacity = "";
        target.style.transform = "";
      }
    };
  }, [selector]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
