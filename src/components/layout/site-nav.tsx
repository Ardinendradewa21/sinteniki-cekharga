"use client";

import { MainNavBar } from "@/components/layout/main-nav";
import { MAIN_NAV } from "@/lib/navigation";
import type { PublicTheme } from "@/lib/public/preferences-config";

/**
 * Navigasi kapsul (PRD §8). Client Component karena butuh state aktif dari
 * pathname dan menutup menu mobile setelah pindah halaman, interaksi nyata,
 * bukan dekorasi.
 */
export function SiteNav({ initialTheme }: { initialTheme: PublicTheme }) {
  return (
    <MainNavBar items={MAIN_NAV} initialTheme={initialTheme} />
  );
}
