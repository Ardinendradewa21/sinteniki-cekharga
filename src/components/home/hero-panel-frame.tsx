import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Bingkai kaca Hero Price Panel (DESIGN.md §6.3).
 *
 * Sejak latar foto diganti gradasi (18 November 2026), panel ini kaca warna
 * biasa di atas gradasi: tanpa foto blur dan tanpa ResizeObserver yang
 * menyejajarkan posisinya. Tidak ada teks yang langsung di atas kaca ini;
 * isinya kartu solid dan kontrol bertrack solid.
 */
export function HeroPanelFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("hero-panel glass rounded-xl p-2.5 sm:p-3", className)}>{children}</div>;
}
