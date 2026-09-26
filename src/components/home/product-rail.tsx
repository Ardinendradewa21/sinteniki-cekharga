"use client";

import { useReducedMotion } from "motion/react";
import {
  useEffect,
  useRef,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

/** Kecepatan dibuat sengaja pelan agar kartu tetap mudah dibaca. */
const AUTO_SCROLL_PX_PER_SECOND = 14;

/**
 * Jalur produk yang bergerak pelan tanpa menggandakan isi katalog.
 *
 * Gerak berhenti saat pointer berada di area kartu, saat pengguna menyentuhnya,
 * atau ketika tautan di dalamnya menerima fokus keyboard. Preferensi reduced
 * motion mematikan gerak otomatis, tetapi geser manual tetap tersedia.
 */
export function ProductRail({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pauseRef = useRef({
    hover: false,
    focus: false,
    pointer: false,
    offscreen: true,
  });
  const directionRef = useRef<1 | -1>(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || reduceMotion) return;

    let animationFrame = 0;
    let previousTime = performance.now();
    const observer = new IntersectionObserver(([entry]) => {
      pauseRef.current.offscreen = !entry?.isIntersecting;
    });

    observer.observe(viewport);

    const animate = (time: number) => {
      const elapsed = Math.min(time - previousTime, 50);
      const maxScroll = Math.max(
        0,
        viewport.scrollWidth - viewport.clientWidth
      );
      const isPaused = Object.values(pauseRef.current).some(Boolean);

      if (!isPaused && maxScroll > 1) {
        viewport.scrollLeft +=
          directionRef.current *
          AUTO_SCROLL_PX_PER_SECOND *
          (elapsed / 1000);

        if (viewport.scrollLeft >= maxScroll - 1) {
          viewport.scrollLeft = maxScroll;
          directionRef.current = -1;
        } else if (viewport.scrollLeft <= 1) {
          viewport.scrollLeft = 0;
          directionRef.current = 1;
        }
      }

      previousTime = time;
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [reduceMotion]);

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") pauseRef.current.hover = true;
  };

  const handlePointerLeave = () => {
    pauseRef.current.hover = false;
    pauseRef.current.pointer = false;
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      pauseRef.current.focus = false;
    }
  };

  return (
    <div className="relative">
      <div
        ref={viewportRef}
        aria-label="Produk terbaru di katalog. Daftar dapat digeser mendatar."
        className="-mx-4 overflow-x-auto px-4 pb-3 [scrollbar-color:var(--border-strong)_transparent] [scrollbar-width:thin] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={() => {
          pauseRef.current.pointer = true;
        }}
        onPointerUp={() => {
          pauseRef.current.pointer = false;
        }}
        onPointerCancel={() => {
          pauseRef.current.pointer = false;
        }}
        onFocusCapture={() => {
          pauseRef.current.focus = true;
        }}
        onBlurCapture={handleBlur}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-8 bg-linear-to-r from-background to-transparent sm:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-8 bg-linear-to-l from-background to-transparent sm:block"
      />
    </div>
  );
}
