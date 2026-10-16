"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon, Cancel01Icon, SmartPhone01Icon } from "@hugeicons/core-free-icons";

import {
  clearTray,
  readTray,
  readTrayOnServer,
  removeFromTray,
  subscribeTray,
  subscribeTrayFull,
} from "@/components/compare/compare-tray-store";
import { buttonVariants } from "@/components/ui/button-variants";
import { buildCompareHref, MAX_COMPARE_ITEMS, MIN_COMPARE_ITEMS } from "@/lib/catalog/compare-href";
import type { TrayItem } from "@/lib/catalog/compare-tray-rules";
import { cn } from "@/lib/utils";

/** Halaman yang sudah menjadi tempat membandingkan: baki tidak perlu tampil. */
const HIDDEN_ON = ["/compare", "/bandingkan"];

/**
 * Baki pilihan bandingkan di bawah layar (masukan PO 16 Okt 2026), dengan
 * pola lembar bawah ala aplikasi seluler: ringkas saat tertutup (foto mini,
 * jumlah, tombol Bandingkan), dibuka untuk melihat atau menghapus pilihan.
 * Baki muncul hanya bila ada produk yang dipilih.
 */
export function CompareTray() {
  const items = useSyncExternalStore(subscribeTray, readTray, readTrayOnServer);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const panelId = useId();

  useEffect(
    () =>
      subscribeTrayFull(() => {
        setNotice(`Maksimal ${MAX_COMPARE_ITEMS} produk. Hapus salah satu dulu.`);
        setOpen(true);
      }),
    []
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const hidden = items.length === 0 || HIDDEN_ON.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const ready = items.length >= MIN_COMPARE_ITEMS;
  // Teks pendek: di layar 360 px baris ini berbagi tempat dengan foto mini dan tombol.
  const status = ready ? `${items.length} produk dipilih` : `Pilih ${MIN_COMPARE_ITEMS - items.length} lagi`;

  return (
    <>
      {/* Ruang kosong seukuran baki supaya footer tidak tertutup. */}
      {hidden ? null : <div aria-hidden className="h-24 print:hidden" />}
      <AnimatePresence>
        {hidden ? null : (
          <motion.section
            key="baki"
            aria-label="Pilihan untuk dibandingkan"
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] print:hidden"
          >
            <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    id={panelId}
                    key="panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-border"
                  >
                    <ul className="space-y-1 p-2">
                      {Array.from({ length: MAX_COMPARE_ITEMS }, (_, index) => items[index] ?? null).map((item, index) =>
                        item ? (
                          <li key={item.slug} className="flex items-center gap-3 rounded-xl px-2 py-1">
                            <Thumb item={item} />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{item.name}</span>
                            <button
                              type="button"
                              onClick={() => removeFromTray(item.slug)}
                              aria-label={`Hapus ${item.name} dari pilihan`}
                              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} aria-hidden />
                            </button>
                          </li>
                        ) : (
                          <li key={`kosong-${index}`} className="flex min-h-[52px] items-center gap-3 rounded-xl px-2 py-1">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-strong text-muted-foreground">
                              <HugeiconsIcon icon={SmartPhone01Icon} size={16} strokeWidth={1.8} aria-hidden />
                            </span>
                            <span className="text-sm text-muted-foreground">Slot kosong. Pilih dari kartu produk.</span>
                          </li>
                        )
                      )}
                    </ul>
                    <div className="flex justify-end px-3 pb-2">
                      <button
                        type="button"
                        onClick={() => {
                          clearTray();
                          setOpen(false);
                        }}
                        className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Hapus semua
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={open ? panelId : undefined}
                  onClick={() => setOpen((value) => !value)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex shrink-0 -space-x-2">
                    {items.map((item) => (
                      <Thumb key={item.slug} item={item} small />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">{status}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {open ? "Tutup daftar" : `Maks. ${MAX_COMPARE_ITEMS}, ketuk untuk ubah`}
                    </span>
                  </span>
                  <HugeiconsIcon icon={open ? ArrowDown01Icon : ArrowUp01Icon} size={18} strokeWidth={2} className="shrink-0 text-muted-foreground" aria-hidden />
                </button>
                {ready ? (
                  <Link
                    href={buildCompareHref(items.map((item) => ({ slug: item.slug, variantKey: null })))}
                    onClick={() => {
                      // Setelah pindah, pilihan hidup di URL /compare.
                      clearTray();
                      setOpen(false);
                    }}
                    aria-label={`Bandingkan ${items.length} produk terpilih`}
                    className={cn(buttonVariants(), "shrink-0")}
                  >
                    Bandingkan
                  </Link>
                ) : (
                  <span aria-hidden className={cn(buttonVariants(), "pointer-events-none shrink-0 opacity-50")}>
                    Bandingkan
                  </span>
                )}
              </div>
              <p role="status" aria-live="polite" className={cn("px-4 text-xs font-medium text-destructive", notice ? "pb-3" : "sr-only")}>
                {notice ?? ""}
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function Thumb({ item, small = false }: { item: TrayItem; small?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-muted to-brand-muted",
        small ? "size-9 ring-2 ring-card" : "size-10"
      )}
    >
      {item.image ? (
        <Image src={item.image} alt="" width={small ? 36 : 40} height={small ? 36 : 40} className="h-[85%] w-auto object-contain" />
      ) : (
        <HugeiconsIcon icon={SmartPhone01Icon} size={16} strokeWidth={1.8} className="text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}
