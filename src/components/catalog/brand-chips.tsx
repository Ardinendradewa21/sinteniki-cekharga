"use client"

import Link from "next/link"
import * as m from "motion/react-m"

import { useMotionPreset } from "@/lib/motion"
import { cn } from "@/lib/utils"

export type BrandChip = {
  label: string
  count: number
  href: string
  active: boolean
}

/**
 * Chip merek berjumlah di atas hasil katalog (CD-02, pola chip filter Calda:
 * "All 22 · Lights 9").
 *
 * - Jumlah = produk terpublikasi per merek di seluruh katalog, dihitung dari
 *   data (`facets.brandCounts`), bukan popularitas atau peringkat (PRD FR-01).
 *   Urutan abjad, bukan menurut jumlah.
 * - Satu ketukan = saring ke satu merek; pilihan banyak merek tetap lewat
 *   filter "Merek". Chip aktif = kapsul monokrom `--primary` yang bergeser
 *   (`layoutId`) + `aria-current`.
 * - Di ponsel baris ini bergulir menyamping di dalam dirinya sendiri, bukan
 *   halaman (tanpa overflow horizontal halaman, antislop R-03).
 */
export function BrandChips({ chips, className }: { chips: BrandChip[]; className?: string }) {
  const { transition } = useMotionPreset()
  if (chips.length <= 2) return null

  return (
    <nav aria-label="Saring cepat per merek" className={cn("-mx-4 sm:mx-0", className)}>
      <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible sm:px-0">
        {chips.map((chip) => (
          <li key={chip.label} className="shrink-0">
            <Link
              href={chip.href}
              scroll={false}
              aria-current={chip.active ? "page" : undefined}
              className={cn(
                "relative isolate inline-flex h-11 items-center gap-2 rounded-pill border px-4 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                chip.active
                  ? "border-transparent text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              )}
            >
              {chip.active ? (
                <m.span
                  layoutId="chip-merek-aktif"
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-pill bg-primary"
                  transition={transition("thumb")}
                />
              ) : null}
              {chip.label}
              <span className={cn("tabular text-xs", chip.active ? "text-primary-foreground/75" : "text-muted-foreground")}>
                {chip.count}
                <span className="sr-only"> produk</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
