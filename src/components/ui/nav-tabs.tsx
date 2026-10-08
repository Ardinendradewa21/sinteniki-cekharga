import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Tab navigasi antarhalaman/antarparameter URL (audit UX-10).
 *
 * Bukan komponen Tabs Radix: Tabs (`role="tablist"`) untuk panel di halaman
 * yang sama, sedangkan tab admin berpindah alamat (`?tab=…`, sub-rute iklan).
 * Untuk navigasi, pola yang tepat adalah tautan dengan `aria-current="page"`
 * di dalam `<nav>` (sama seperti NavigationMenuLink asChild di shadcn).
 *
 * Tampilan mengikuti varian "line" Tabs shadcn: garis bawah pada tab aktif
 * berwarna `primary` (charcoal), selaras dengan pemilih varian dan CTA.
 */
export type NavTabItem = {
  href: string;
  label: string;
  active: boolean;
  /** Angka kecil di samping label, mis. jumlah materi menunggu review. */
  count?: ReactNode;
};

export function NavTabs({
  items,
  label,
  className,
}: {
  items: NavTabItem[];
  /** Label `<nav>` untuk pembaca layar, mis. "Sumber impor". */
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("flex gap-1 overflow-x-auto border-b border-border", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            item.active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground"
          )}
        >
          {item.label}
          {item.count}
        </Link>
      ))}
    </nav>
  );
}
