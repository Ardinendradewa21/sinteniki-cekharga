import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Status Pill (DESIGN.md §7): titik + kata, tidak pernah warna saja.
 *
 * - `fresh`: harga diperiksa dalam batas kebaruan, mis. "Diperiksa 7 jam lalu".
 * - `stale`: lewat batas 30 jam; teksnya memakai istilah PRD §7
 *   "Harga terakhir tercatat ...", warna peringatan.
 *
 * Kontras teks di latar pil: success 4.84:1 / warning 5.38:1 (terang),
 * ≥ 9.6:1 (gelap), DESIGN.md §3.5.
 */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: "fresh" | "stale";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs leading-4 font-semibold",
        tone === "fresh" ? "bg-success-muted text-success" : "bg-warning-muted text-warning",
        className
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone === "fresh" ? "bg-success" : "bg-warning")} />
      {children}
    </span>
  );
}
