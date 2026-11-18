"use client"

import { animate, inView } from "motion/react"
import { useLayoutEffect, useRef, type ReactNode } from "react"

import { easeOutQuint } from "@/lib/motion"

/** Jeda antarkolom; 14 kolom = 0.39 s + durasi 0.4 s, di bawah batas data reveal 1 s (DESIGN.md §8). */
const COLUMN_STEP = 0.03

/**
 * Tile grid pemeriksaan harian muncul sekali, menyapu dari tanggal lama ke
 * baru (CD-04, pola tile Veyla). Tile bertanda `data-tile-col`.
 *
 * Aturan sama dengan `useRevealOnScroll`: HTML server berisi grid lengkap;
 * tile hanya disembunyikan JavaScript bila grid masih di bawah layar dan
 * pengguna tidak memilih reduced motion, lalu dianimasikan saat terlihat.
 * Hanya opacity dan transform.
 */
export function TileSweep({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (element.getBoundingClientRect().top < window.innerHeight) return

    const tiles = Array.from(element.querySelectorAll<HTMLElement>("[data-tile-col]"))
    if (tiles.length === 0) return
    for (const tile of tiles) {
      tile.style.opacity = "0"
      tile.style.transform = "scale(0.6)"
    }

    const stop = inView(
      element,
      () => {
        animate(
          tiles,
          { opacity: [0, 1], scale: [0.6, 1] },
          {
            duration: 0.4,
            ease: easeOutQuint,
            delay: (index: number) => Number(tiles[index]?.dataset.tileCol ?? 0) * COLUMN_STEP,
          }
        )
      },
      { amount: 0.3 }
    )
    return () => stop()
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
