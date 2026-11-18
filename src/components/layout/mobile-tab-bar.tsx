"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "motion/react"

import { NAV_ICONS } from "@/components/layout/nav-icons"
import { Button } from "@/components/ui/button"
import { useMotionPreset } from "@/lib/motion"
import { isActivePath, MAIN_NAV, MORE_NAV } from "@/lib/navigation"
import { cn } from "@/lib/utils"

/** Tab utama ponsel dan label pendeknya (lebar tiap tab sekitar 68px). */
const TABS: readonly { href: string; label: string }[] = [
  { href: "/", label: "Beranda" },
  { href: "/products", label: "Produk" },
  { href: "/compare", label: "Bandingkan" },
  { href: "/assistant", label: "Tanya AI" },
]

/**
 * Tab bar bawah situs publik di ponsel (CD-01, pola Calda).
 *
 * - Lima tab: Beranda, Produk, Bandingkan, Tanya AI, Lainnya. Hanya tujuan
 *   yang ada di `MAIN_NAV`/`MORE_NAV` (route nyata, antislop R-24).
 * - Tab aktif: kapsul monokrom (`--primary`) yang bergeser lewat `layoutId`
 *   + `aria-current`; reduced motion pindah seketika.
 * - "Lainnya" membuka lembar bawah (dialog modal): fokus awal ke tautan
 *   pertama, Tab berputar di dalam, Escape dan latar menutup, fokus kembali
 *   ke tombol "Lainnya".
 * - Dirender di layout publik, di luar header: `backdrop-filter` kapsul header
 *   akan membuat `position: fixed` menempel ke kapsul, bukan ke layar.
 * - Tingginya dicadangkan lewat `--tabbar-offset` (globals.css) untuk halaman,
 *   compare tray, banner persetujuan, dan composer Tanya AI.
 */
export function MobileTabBar() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = React.useState(false)
  const { reduce, transition } = useMotionPreset()
  const moreButtonRef = React.useRef<HTMLButtonElement>(null)
  const sheetRef = React.useRef<HTMLDivElement>(null)
  const tabs = TABS.filter((tab) => MAIN_NAV.some((item) => item.href === tab.href))
  const moreActive =
    !tabs.some((tab) => isActivePath(pathname, tab.href)) &&
    MORE_NAV.some((item) => isActivePath(pathname, item.href))

  function closeSheet() {
    setMoreOpen(false)
    moreButtonRef.current?.focus()
  }

  React.useEffect(() => {
    if (!moreOpen) return
    const sheet = sheetRef.current
    sheet?.querySelector<HTMLElement>("a[href]")?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false)
        moreButtonRef.current?.focus()
        return
      }
      if (event.key !== "Tab" || !sheet) return
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const closeOnDesktop = () => {
      if (window.innerWidth >= 768) setMoreOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("resize", closeOnDesktop)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", closeOnDesktop)
    }
  }, [moreOpen])

  const tabClass =
    // px-0.5 + tracking-tight: "Bandingkan" muat utuh di 375px tanpa turun di
    // bawah 12px (batas TC-A11Y-06).
    "relative isolate flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-xs font-semibold tracking-tight outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring"

  const activePill = (
    <motion.span
      layoutId="tabbar-aktif"
      aria-hidden
      className="absolute inset-0 -z-10 rounded-2xl bg-primary"
      transition={transition("thumb")}
    />
  )

  return (
    <>
      <nav
        aria-label="Navigasi utama ponsel"
        className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden print:hidden"
      >
        <ul className="glass-text glass-float mx-auto grid max-w-md grid-cols-5 gap-0.5 rounded-[1.75rem] p-1.5">
          {tabs.map((tab) => {
            const isActive = isActivePath(pathname, tab.href)
            const icon = NAV_ICONS[tab.href]
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(tabClass, isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {isActive ? activePill : null}
                  {icon ? <HugeiconsIcon icon={icon} size={20} strokeWidth={1.8} aria-hidden /> : null}
                  <span className="max-w-full truncate">{tab.label}</span>
                </Link>
              </li>
            )
          })}
          <li>
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-controls="lembar-lainnya"
              className={cn(tabClass, moreActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {moreActive ? activePill : null}
              <HugeiconsIcon icon={MoreHorizontalIcon} size={20} strokeWidth={1.8} aria-hidden />
              <span>Lainnya</span>
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {moreOpen ? (
          <motion.div
            key="lembar-lainnya"
            className="fixed inset-0 z-70 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition("micro")}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label="Tutup menu lainnya"
              onClick={closeSheet}
              className="absolute inset-0 bg-scrim"
            />
            <motion.div
              ref={sheetRef}
              id="lembar-lainnya"
              role="dialog"
              aria-modal="true"
              aria-labelledby="judul-lembar-lainnya"
              initial={reduce ? { opacity: 0 } : { y: "100%" }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: "100%" }}
              transition={transition("entrance")}
              className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[1.75rem] border border-border bg-card p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 id="judul-lembar-lainnya" className="heading-card text-foreground">
                  Lainnya
                </h2>
                <Button type="button" variant="ghost" size="icon" aria-label="Tutup" onClick={closeSheet}>
                  <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={1.8} aria-hidden />
                </Button>
              </div>
              <ul className="mt-2 space-y-1">
                {MORE_NAV.map((item) => {
                  const isActive = isActivePath(pathname, item.href)
                  const icon = NAV_ICONS[item.href]
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                          isActive ? "bg-brand-muted" : "hover:bg-muted"
                        )}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-muted text-foreground">
                          {icon ? <HugeiconsIcon icon={icon} size={19} strokeWidth={1.8} aria-hidden /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                          <span className="block text-xs text-muted-foreground">{item.description}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
