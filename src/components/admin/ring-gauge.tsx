"use client";

import { motion } from "motion/react";

import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Cincin progres kecil untuk kartu KPI admin (gaya Veyla, AV-01). Busur
 * digambar dari 0 ke rasio saat muncul; reduced motion langsung penuh.
 * Grafis `--brand` di atas jalur `--border-strong` tipis (kontras grafis ≥ 3:1
 * untuk busurnya). Teks nilai ditulis pemanggil; cincin ini dekoratif bila
 * `label` kosong.
 */
export function RingGauge({ ratio, label, className }: { ratio: number; label?: string; className?: string }) {
  const { reduce, transition } = useMotionPreset();
  const value = Math.min(Math.max(ratio, 0), 1);
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-14 -rotate-90", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="24" cy="24" r="19" fill="none" strokeWidth="5" className="stroke-border" />
      <motion.circle
        cx="24"
        cy="24"
        r="19"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-brand"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: value }}
        transition={transition("dataReveal")}
      />
    </svg>
  );
}
