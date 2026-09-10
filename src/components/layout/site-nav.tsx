"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Menu01Icon } from "@hugeicons/core-free-icons";

import { MAIN_NAV, isActivePath } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Navigasi kapsul (PRD §8). Client Component karena butuh state aktif dari
 * pathname dan menutup menu mobile setelah pindah halaman, interaksi nyata,
 * bukan dekorasi.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <>
      {/* Desktop: kapsul */}
      <nav aria-label="Navigasi utama" className="hidden md:block">
        <ul className="flex items-center gap-1 rounded-pill border border-border bg-card p-1">
          {MAIN_NAV.map((item) => {
            const isActive = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center rounded-pill px-4 text-sm transition-colors duration-150",
                    // Referensi visual: item aktif berupa pill abu lembut di
                    // dalam kapsul putih, bukan pill gelap. Bedanya diperkuat
                    // warna teks dan bobot huruf, plus aria-current untuk
                    // pembaca layar.
                    isActive
                      ? "bg-muted font-semibold text-foreground"
                      : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile: tombol buka/tutup + panel */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="menu-navigasi-mobile"
          className="flex size-11 items-center justify-center rounded-pill border border-border bg-card text-foreground transition-colors duration-150 hover:bg-muted"
        >
          <HugeiconsIcon
            icon={isMenuOpen ? Cancel01Icon : Menu01Icon}
            size={20}
            strokeWidth={1.8}
            aria-hidden
          />
          <span className="sr-only">
            {isMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          </span>
        </button>
      </div>

      <nav
        id="menu-navigasi-mobile"
        aria-label="Navigasi utama (mobile)"
        hidden={!isMenuOpen}
        className="absolute inset-x-0 top-full z-40 border-b border-border bg-card px-4 pb-4 shadow-sm md:hidden"
      >
        <ul className="flex flex-col gap-1 pt-2">
          {MAIN_NAV.map((item) => {
            const isActive = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  // Tutup menu saat pengguna memilih tujuan, bukan lewat effect
                  // yang mengamati pathname.
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex min-h-11 flex-col justify-center rounded-lg px-4 py-2 transition-colors duration-150",
                    isActive ? "bg-muted" : "hover:bg-muted/60"
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
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
