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
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"
import { isActivePath } from "@/lib/navigation"
import { setPublicThemeAction } from "@/lib/public/preferences"
import type { PublicTheme } from "@/lib/public/preferences-config"
import { cn } from "@/lib/utils"

export type GlassmorphismNavItem = {
  href: string
  label: string
  description?: string
}

type GlassmorphismNavBarProps = {
  items: readonly GlassmorphismNavItem[]
  className?: string
  searchHref?: string
  initialTheme: PublicTheme
}

/**
 * Navigasi glassmorphism yang tetap memakai Link untuk perpindahan halaman.
 * Path aktif berasal dari router, bukan state visual lokal, sehingga tombol
 * Back/Forward dan deep link selalu menunjukkan tab yang benar.
 */
export function GlassmorphismNavBar({
  items,
  className,
  searchHref = "/products",
  initialTheme,
}: GlassmorphismNavBarProps) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const [theme, setTheme] = React.useState<PublicTheme>(initialTheme)
  const [themePending, startThemeTransition] = React.useTransition()
  const shouldReduceMotion = useReducedMotion()

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
    <motion.span
      key={theme}
      initial={
        shouldReduceMotion
          ? { opacity: 0 }
          : { opacity: 0, rotate: -35, scale: 0.8 }
      }
      animate={{ opacity: 1, rotate: 0, scale: 1 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.18 }}
    >
      <HugeiconsIcon
        icon={theme === "dark" ? Sun02Icon : Moon02Icon}
        size={20}
        strokeWidth={1.8}
        aria-hidden
      />
    </motion.span>
  )

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "hidden items-center rounded-pill border border-white/70 bg-card/55 p-1 dark:border-white/15",
          "shadow-[0_8px_30px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)]",
          "dark:shadow-[0_8px_30px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.10)]",
          "backdrop-blur-2xl backdrop-saturate-150 md:flex"
        )}
      >
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
                      "transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-white/35 hover:text-foreground dark:hover:bg-white/8"
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        layoutId="header-glass-active"
                        aria-hidden
                        className="absolute inset-0 -z-10 rounded-pill border border-white/75 bg-muted/75 shadow-[0_3px_12px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/15 dark:shadow-[0_3px_12px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.10)]"
                        transition={{ type: "spring", stiffness: 380, damping: 34 }}
                      >
                        <span className="absolute -top-1 left-1/2 h-1 w-7 -translate-x-1/2 rounded-pill bg-brand shadow-[0_0_10px_color-mix(in_oklch,var(--brand)_45%,transparent)]" />
                      </motion.span>
                    ) : null}
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <span aria-hidden className="mx-1 h-6 w-px bg-border/70" />

        <Button
          asChild
          variant="ghost"
          size="icon"
          className="border-0 bg-transparent shadow-none hover:bg-white/40 hover:shadow-none dark:hover:bg-white/8"
        >
          <Link href={searchHref} aria-label="Cari produk">
            <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.8} aria-hidden />
          </Link>
        </Button>

        <span aria-hidden className="mx-1 h-6 w-px bg-border/70" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          disabled={themePending}
          aria-label={themeLabel}
          aria-pressed={theme === "dark"}
          title={themeLabel}
          className="border-0 bg-transparent shadow-none hover:bg-white/40 hover:shadow-none dark:hover:bg-white/8"
        >
          {themeIcon}
        </Button>
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="menu-navigasi-mobile"
          aria-label={isMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          className="border-white/75 bg-card/60 dark:border-white/15"
        >
          <HugeiconsIcon
            icon={isMenuOpen ? Cancel01Icon : Menu01Icon}
            size={20}
            strokeWidth={1.8}
            aria-hidden
          />
        </Button>

        <Button
          asChild
          variant="outline"
          size="icon"
          className="border-white/75 bg-card/60 dark:border-white/15"
        >
          <Link href={searchHref} aria-label="Cari produk">
            <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.8} aria-hidden />
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
          className="border-white/75 bg-card/60 dark:border-white/15"
        >
          {themeIcon}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {isMenuOpen ? (
          <motion.nav
            id="menu-navigasi-mobile"
            aria-label="Navigasi utama (mobile)"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute inset-x-0 top-full z-40 border-b border-white/70 bg-background/95 px-4 pb-4 shadow-[0_18px_36px_rgba(15,23,42,0.12)] backdrop-blur-3xl backdrop-saturate-150 dark:border-white/10 dark:shadow-[0_18px_36px_rgba(0,0,0,0.32)] md:hidden"
          >
            <ul className="mx-auto flex max-w-7xl flex-col gap-1 rounded-2xl border border-white/75 bg-card/90 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
              {items.map((item) => {
                const isActive = isActivePath(pathname, item.href)

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                      className={cn(
                        "flex min-h-12 flex-col justify-center rounded-xl border px-4 py-2 outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
                        isActive
                          ? "border-white/75 bg-muted/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-white/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                          : "border-transparent hover:border-white/55 hover:bg-white/35 dark:hover:border-white/10 dark:hover:bg-white/8"
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
