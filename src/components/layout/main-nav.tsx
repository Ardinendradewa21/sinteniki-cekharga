"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Menu01Icon,
  Moon02Icon,
  Search01Icon,
  Sun02Icon,
} from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "motion/react"

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
 * Navigasi kapsul publik (PRD §8: "navigasi kapsul, tombol ikon bulat") di
 * dalam Glass Header (DESIGN.md §7). Kacanya milik kapsul header; navigasi ini
 * tidak menambah latar, bayangan, atau glow sendiri.
 *
 * Menu aktif ditandai latar `--brand-muted` yang bergeser antarmenu (spring
 * thumb dari src/lib/motion.ts) + teks penuh + `aria-current`, jadi tidak
 * bergantung pada warna saja. Reduced motion: pindah seketika.
 *
 * Path aktif berasal dari router, bukan state visual lokal, sehingga tombol
 * Back/Forward dan deep link selalu menunjukkan tab yang benar.
 */
export function MainNavBar({
  items,
  className,
  searchHref = "/products",
  initialTheme,
}: MainNavBarProps) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const [theme, setTheme] = React.useState<PublicTheme>(initialTheme)
  const [themePending, startThemeTransition] = React.useTransition()
  const { reduce: shouldReduceMotion, transition } = useMotionPreset()

  function applyThemeToPage(nextTheme: PublicTheme) {
    document
      .querySelector<HTMLElement>("[data-public-theme]")
      ?.setAttribute("data-theme", nextTheme)
  }

  React.useEffect(() => {
    if (!isMenuOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false)
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [isMenuOpen])

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

  const themeLabel =
    theme === "dark" ? "Gunakan tema terang" : "Gunakan tema gelap"

  const themeIcon = (
    <HugeiconsIcon
      icon={theme === "dark" ? Sun02Icon : Moon02Icon}
      size={20}
      strokeWidth={1.8}
      aria-hidden
    />
  )

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="hidden items-center md:flex">
        <nav aria-label="Navigasi utama">
          <ul className="flex items-center gap-0.5">
            {items.map((item) => {
              const isActive = isActivePath(pathname, item.href)

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative isolate flex h-11 items-center rounded-pill px-4 text-sm font-medium",
                      "transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {isActive ? (
                      // Latar aktif bergeser antarmenu (layoutId); tanpa
                      // bayangan atau glow.
                      <motion.span
                        layoutId="header-nav-active"
                        aria-hidden
                        className="absolute inset-0 -z-10 rounded-pill bg-brand-muted"
                        transition={transition("thumb")}
                      />
                    ) : null}
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <span aria-hidden className="mx-1 h-6 w-px bg-border" />

        <Button asChild variant="ghost" size="icon">
          <Link href={searchHref} aria-label="Cari produk">
            <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.8} aria-hidden />
          </Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          disabled={themePending}
          aria-label={themeLabel}
          aria-pressed={theme === "dark"}
          title={themeLabel}
        >
          {themeIcon}
        </Button>
      </div>

      <div className="flex items-center gap-0.5 md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="menu-navigasi-mobile"
          aria-label={isMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
        >
          <HugeiconsIcon
            icon={isMenuOpen ? Cancel01Icon : Menu01Icon}
            size={20}
            strokeWidth={1.8}
            aria-hidden
          />
        </Button>

        <Button asChild variant="ghost" size="icon">
          <Link href={searchHref} aria-label="Cari produk">
            <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.8} aria-hidden />
          </Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          disabled={themePending}
          aria-label={themeLabel}
          aria-pressed={theme === "dark"}
          title={themeLabel}
        >
          {themeIcon}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {isMenuOpen ? (
          <motion.nav
            id="menu-navigasi-mobile"
            aria-label="Navigasi utama (mobile)"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
            animate={{ opacity: 1, y: 0, transition: transition("micro") }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8, transition: transition("exit") }}
            className="pointer-events-auto absolute inset-x-0 top-full z-40 px-4 pt-1 md:hidden"
          >
            <ul className="glass-text glass-float mx-auto flex max-w-7xl flex-col gap-1 rounded-xl p-2">
              {items.map((item) => {
                const isActive = isActivePath(pathname, item.href)

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                      className={cn(
                        "flex min-h-12 flex-col justify-center rounded-lg px-4 py-2 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                        isActive ? "bg-brand-muted" : "hover:bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm text-foreground",
                          isActive ? "font-semibold" : "font-medium"
                        )}
                      >
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
