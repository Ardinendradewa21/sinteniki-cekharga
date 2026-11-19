"use client"

import { useState } from "react"
import { Popover } from "radix-ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, HelpCircleIcon } from "@hugeicons/core-free-icons"

import type { SpecGuideEntry } from "@/lib/catalog/spec-guide"

/**
 * Ikon (?) di samping label spesifikasi (RV-03, keputusan PO 19 Nov 2026).
 *
 * Menggantikan panel panjang "Apa arti spesifikasi ini?": pembaca membuka
 * penjelasan hanya untuk baris yang ia tanyakan, tepat di tempatnya.
 * Isi bertingkat (progressive disclosure): "Intinya" 1 kalimat + "Perlu
 * diperhatikan" 1 tips, lalu "Selengkapnya" membuka penjelasan lengkap dari
 * bank materi yang sama dengan Tanya AI.
 *
 * Radix Popover: fokus berpindah ke isi, Esc dan ketuk di luar menutup,
 * `aria-expanded` di tombol. Isi di permukaan solid (bukan kaca) dan
 * dipasang di dalam wadah tema publik supaya token warnanya ikut.
 */
export function SpecHint({ entry }: { entry: SpecGuideEntry }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setExpanded(false)
      }}
    >
      <Popover.Trigger
        // Area sentuh 44px (R-03); -my-3 supaya tinggi baris tabel tidak bertambah.
        className="-my-3 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted-foreground transition-colors duration-150 hover:text-brand-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:text-brand-text"
        aria-label={`Apa arti ${entry.label}?`}
      >
        <HugeiconsIcon icon={HelpCircleIcon} size={17} strokeWidth={2} aria-hidden />
      </Popover.Trigger>
      {open ? (
        <Popover.Portal container={document.querySelector<HTMLElement>("[data-public-theme]") ?? undefined}>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={4}
            // Jarak aman dari header menempel (atas) dan tab bar ponsel (bawah).
            collisionPadding={{ top: 88, bottom: 96, left: 16, right: 16 }}
            className="z-60 flex max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[min(20rem,calc(100vw-2rem))] flex-col rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-lg outline-none"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="pt-2 font-semibold">{entry.label}</p>
              <Popover.Close
                aria-label="Tutup penjelasan"
                className="-mt-1 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} aria-hidden />
              </Popover.Close>
            </div>
            <div className="min-h-0 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground">Intinya</p>
              <p className="mt-0.5 leading-relaxed">{entry.short}</p>
              <p className="mt-3 text-xs font-semibold text-muted-foreground">Perlu diperhatikan</p>
              <p className="mt-0.5 leading-relaxed">{entry.tip}</p>
              {expanded ? (
                <div
                  // Tombol "Selengkapnya" hilang saat diklik: fokus dipindah ke
                  // penjelasan lengkap supaya posisi keyboard/pembaca layar tidak hilang.
                  ref={(element) => element?.focus()}
                  tabIndex={-1}
                  className="mt-3 border-t border-border pt-3 outline-none"
                >
                  <p className="leading-relaxed">{entry.what}</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-relaxed text-muted-foreground">
                    {entry.reality.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {entry.reference ? <p className="mt-2 text-xs text-muted-foreground">Rujukan: {entry.reference}</p> : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="mt-2 inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand-text underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Selengkapnya
                </button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      ) : null}
    </Popover.Root>
  )
}
