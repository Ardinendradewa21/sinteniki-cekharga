"use client";

import { useSyncExternalStore } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { readTray, readTrayOnServer, subscribeTray, toggleTray } from "@/components/compare/compare-tray-store";
import type { TrayItem } from "@/lib/catalog/compare-tray-rules";
import { cn } from "@/lib/utils";

/**
 * Tombol pilih-untuk-bandingkan di kartu produk. Tidak lagi langsung pindah
 * ke /compare; produk masuk ke baki di bawah layar sehingga pengguna bisa
 * memilih beberapa ponsel dari katalog dulu (masukan PO 16 Okt 2026).
 */
export function CompareToggle({ item }: { item: TrayItem }) {
  const items = useSyncExternalStore(subscribeTray, readTray, readTrayOnServer);
  const selected = items.some((entry) => entry.slug === item.slug);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Pilih ${item.name} untuk dibandingkan`}
      onClick={() => toggleTray(item)}
      className={cn(
        "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-brand-muted text-brand-text" : "text-brand-text hover:bg-brand-muted/40"
      )}
    >
      <HugeiconsIcon icon={selected ? Tick02Icon : Add01Icon} size={14} strokeWidth={2.2} aria-hidden />
      {selected ? "Dipilih" : "Bandingkan"}
    </button>
  );
}
