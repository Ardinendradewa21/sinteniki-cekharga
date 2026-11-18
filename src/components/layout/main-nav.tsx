"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Moon02Icon, Search01Icon, Sun02Icon } from "@hugeicons/core-free-icons"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"

import { NAV_ICONS } from "@/components/layout/nav-icons"
import { Button } from "@/components/ui/button"
import { useMotionPreset } from "@/lib/motion"
import { isActivePath } from "@/lib/navigation"
import { setPublicThemeAction } from "@/lib/public/preferences"
import type { PublicTheme } from "@/lib/public/preferences-config"
import { cn } from "@/lib/utils"

type MainNavItem = {
  href: string
  label: string
  description?: string
}

type MainNavBarProps = {
  items: readonly MainNavItem[]
  className?: string
  searchHref?: string
  initialTheme: PublicTheme
}

/**
 * Navigasi publik tema Calda (CD-01, DESIGN.md §7).
 *
 * Desktop: kapsul berisi menu dalam satu "track". Menu aktif adalah kapsul
 * monokrom (`--primary`, sama dengan CTA utama Calda) yang bergeser antarmenu
 * lewat Motion `layoutId` (spring thumb dari src/lib/motion.ts) + `aria-current`,
 * jadi tidak bergantung pada warna saja. Mulai `lg` semua menu berlabel; di
 * `md` hanya menu aktif yang berlabel (pola Calda), sisanya ikon dengan nama
 * yang tetap terbaca pembaca layar dan tooltip.
 *
 * Ponsel: menu ada di tab bar bawah (`mobile-tab-bar.tsx`, dirender di layout
 * publik di luar header karena `backdrop-filter` kapsul header membuat
 * `position: fixed` menempel ke kapsul, bukan ke layar). Di header ponsel
 * hanya tombol cari dan tema.
 *
 * Path aktif berasal dari router, jadi Back/Forward dan deep link selalu
 * menunjukkan tab yang benar. Reduced motion: penanda pindah seketika.
 */
export function MainNavBar({
  items,
  className,
  searchHref = "/products",
  initialTheme,
}: MainNavBarProps) {
  const pathname = usePathname()
  const [theme, setTheme] = React.useState<PublicTheme>(initialTheme)
  const [themePending, startThemeTransition] = React.useTransition()
  const { reduce, transition } = useMotionPreset()

  function applyThemeToPage(nextTheme: PublicTheme) {
    document
      .querySelector<HTMLElement>("[data-public-theme]")
      ?.setAttribute("data-theme", nextTheme)
  }

  function toggleTheme() {
    const previousTheme = theme
    const nextTheme: PublicTheme = theme === "dark" ? "light" : "dark"

    setTheme(nextTheme)
    applyThemeToPage(nextTheme)
    startThemeTransition(async () => {
      try {
        await setPublicThemeAction(nextTheme)
      } catch {
        setTheme(previousTheme)
        applyThemeToPage(previousTheme)
      }
    })
  }

  const themeLabel = theme === "dark" ? "Gunakan tema terang" : "Gunakan tema gelap"
  // Tombol ikon bulat bertepi tipis (gaya Calda), bukan ghost tanpa batas.
  const roundButton = "rounded-pill border-border bg-card/70 shadow-none hover:bg-card"

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <nav aria-label="Navigasi utama" className="hidden md:block">
        <ul className="flex items-center gap-0.5 rounded-pill bg-foreground/5 p-1">
          {items.map((item) => {
            const isActive = isActivePath(pathname, item.href)
            const icon = NAV_ICONS[item.href]
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={isActive ? undefined : item.label}
                  className={cn(
                    "relative isolate flex h-11 items-center gap-2 rounded-pill px-3.5 text-sm font-semibold",
                    "transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  )}
                >
                  {isActive ? (
                    <m.span
                      layoutId="header-nav-aktif"
                      aria-hidden
                      className="absolute inset-0 -z-10 rounded-pill bg-primary"
                      transition={transition("thumb")}
                    />
                  ) : null}
                  {icon ? <HugeiconsIcon icon={icon} size={18} strokeWidth={1.8} aria-hidden /> : null}
                  <span className={cn(!isActive && "sr-only lg:not-sr-only")}>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <Button asChild variant="outline" size="icon" className={roundButton}>
        <Link href={searchHref} aria-label="Cari produk" title="Cari produk">
          <HugeiconsIcon icon={Search01Icon} size={19} strokeWidth={1.8} aria-hidden />
        </Link>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        disabled={themePending}
        aria-label={themeLabel}
        aria-pressed={theme === "dark"}
        title={themeLabel}
        className={roundButton}
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={theme}
            className="flex"
            initial={reduce ? false : { rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={reduce ? undefined : { rotate: 90, opacity: 0 }}
            transition={transition("micro")}
          >
            <HugeiconsIcon icon={theme === "dark" ? Sun02Icon : Moon02Icon} size={19} strokeWidth={1.8} aria-hidden />
          </m.span>
        </AnimatePresence>
      </Button>

    </div>
  )
}
