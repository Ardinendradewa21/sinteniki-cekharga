"use client";

import { GlassmorphismNavBar } from "@/components/ui/glassmorphism-navigation";
import { MAIN_NAV } from "@/lib/navigation";
import type { PublicTheme } from "@/lib/public/preferences-config";

/**
 * Navigasi kapsul (PRD §8). Client Component karena butuh state aktif dari
 * pathname dan menutup menu mobile setelah pindah halaman, interaksi nyata,
 * bukan dekorasi.
 */
export function SiteNav({ initialTheme }: { initialTheme: PublicTheme }) {
  return (
    <GlassmorphismNavBar items={MAIN_NAV} initialTheme={initialTheme} />
  );
}
