"use client";

import { motion } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Teks polos untuk `<select>` fallback; wajib bila `label` bukan string. */
  text?: string;
  disabled?: boolean;
};

/*
  Kelas ditulis utuh (bukan dirangkai) supaya Tailwind menemukannya saat build.
*/
const COLLAPSE = {
  sm: { group: "hidden sm:inline-flex", groupFull: "hidden w-full sm:flex", select: "sm:hidden" },
  md: { group: "hidden md:inline-flex", groupFull: "hidden w-full md:flex", select: "md:hidden" },
} as const;

function groupDisplay(collapseBelow: keyof typeof COLLAPSE | undefined, fullWidth: boolean): string {
  if (!collapseBelow) return fullWidth ? "flex w-full" : "inline-flex";
  return fullWidth ? COLLAPSE[collapseBelow].groupFull : COLLAPSE[collapseBelow].group;
}

/**
 * Pilihan berjajar dengan thumb yang bergeser (DESIGN.md §7).
 *
 * Aksesibilitas (pola radio group WAI-ARIA):
 * - `role="radiogroup"` + `role="radio"`/`aria-checked` pada tiap tombol.
 * - Roving tabindex: Tab masuk ke pilihan aktif saja; panah kiri/kanan
 *   (atau atas/bawah) memindahkan fokus sekaligus memilih, Home/End ke ujung.
 *   Pilihan nonaktif dilewati.
 * - Target sentuh minimal 44px; fokus memakai ring pekat.
 * - Status terpilih tidak hanya dari warna: thumb punya garis border-strong
 *   (3.5:1 terhadap track) dan teksnya lebih tegas.
 *
 * Thumb memakai `layoutId` unik per instance (`useId`), spring dari
 * `src/lib/motion.ts`; reduced motion = pindah seketika.
 *
 * Bila tidak muat (DESIGN.md §7, revisi B7), tanpa JavaScript tambahan dan
 * tanpa layout shift:
 * - bawaan: pilihan membungkus ke baris berikutnya;
 * - `collapseBelow`: di bawah breakpoint itu tampil `<select>` native
 *   (dipakai untuk urutan katalog di HP).
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onValueChange,
  collapseBelow,
  fullWidth = false,
  className,
}: {
  /** Nama grup untuk pembaca layar, mis. "Urutkan produk". */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  collapseBelow?: keyof typeof COLLAPSE;
  fullWidth?: boolean;
  className?: string;
}) {
  const thumbId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const { transition } = useMotionPreset();

  const enabled = options.filter((option) => !option.disabled);
  const hasChecked = enabled.some((option) => option.value === value);
  // Bila nilai aktif tidak ada di daftar, pilihan aktif pertama yang bisa
  // dijangkau Tab supaya grup tetap bisa dioperasikan keyboard.
  const tabStop = hasChecked ? value : enabled[0]?.value;

  function select(next: SegmentedOption<T>) {
    if (next.disabled) return;
    if (next.value !== value) onValueChange(next.value);
    buttons.current[options.indexOf(next)]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, option: SegmentedOption<T>) {
    if (enabled.length === 0) return;
    const position = enabled.indexOf(option);
    let next: SegmentedOption<T> | undefined;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = enabled[(position + 1) % enabled.length];
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = enabled[(position - 1 + enabled.length) % enabled.length];
        break;
      case "Home":
        next = enabled[0];
        break;
      case "End":
        next = enabled[enabled.length - 1];
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next) select(next);
  }

  const group = (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "max-w-full flex-wrap gap-1 rounded-xl border border-border bg-muted p-1",
        groupDisplay(collapseBelow, fullWidth),
        className
      )}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={option.disabled}
            tabIndex={option.value === tabStop ? 0 : -1}
            onClick={() => select(option)}
            onKeyDown={(event) => onKeyDown(event, option)}
            className={cn(
              "relative inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              checked ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              fullWidth && "flex-1"
            )}
          >
            {checked ? (
              <motion.span
                aria-hidden="true"
                layoutId={`segmented-thumb-${thumbId}`}
                transition={transition("thumb")}
                className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-border-strong dark:bg-accent"
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );

  if (!collapseBelow) return group;

  return (
    <>
      {group}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next && !next.disabled) onValueChange(next.value);
        }}
        className={cn(
          "h-11 w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          COLLAPSE[collapseBelow].select
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.text ?? (typeof option.label === "string" ? option.label : option.value)}
          </option>
        ))}
      </select>
    </>
  );
}
