import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

/**
 * Penanda data demo (PRD §9): "Setiap surface sintetis diberi penanda demo yang
 * jelas". Pengguna harus bisa membedakan data aktual dari contoh tanpa membaca
 * kode (PRD FR-08).
 *
 * Status disampaikan lewat kata, bukan warna saja (PRD §8).
 */

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill bg-warning-muted px-2.5 py-1 text-xs font-semibold text-warning",
        className
      )}
    >
      <HugeiconsIcon
        icon={InformationCircleIcon}
        size={14}
        strokeWidth={2}
        aria-hidden
      />
      Data demo
    </span>
  );
}

export function DemoNotice({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-warning-muted p-4",
        className
      )}
    >
      <HugeiconsIcon
        icon={InformationCircleIcon}
        size={20}
        strokeWidth={1.8}
        className="mt-0.5 shrink-0 text-warning"
        aria-hidden
      />
      <div className="text-sm leading-relaxed text-foreground">
        <p className="font-semibold text-warning">Data demo</p>
        <p className="mt-1 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
