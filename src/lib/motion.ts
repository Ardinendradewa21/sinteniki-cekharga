/**
 * Preset motion UI publik CekHarga (DESIGN.md §8, tema Verdant).
 *
 * Satu tempat untuk easing, durasi, stagger, dan spring supaya komponen tidak
 * menulis angka sendiri-sendiri. Hanya opacity dan transform yang dianimasikan;
 * tanpa loop, parallax, atau scroll hijacking.
 *
 * Reduced motion: `MotionConfig reducedMotion="user"` (motion-provider.tsx)
 * hanya mematikan animasi transform dan layout; opacity tetap berjalan
 * (dokumentasi Motion). DESIGN.md meminta semua animasi selesai seketika, jadi
 * komponen memakai `useMotionPreset()` atau memeriksa `useReducedMotion()`
 * dan memakai `instant`.
 */
import { useReducedMotion, type Transition } from "motion/react";

/** cubic-bezier(.22, 1, .36, 1): masuk cepat, berhenti lembut. */
export const easeOutQuint = [0.22, 1, 0.36, 1] as const;
/** Untuk keluar (toast, modal): mulai pelan, pergi cepat. */
export const easeIn = [0.4, 0, 1, 1] as const;

/** Detik, sesuai tabel DESIGN.md §8. */
export const duration = {
  micro: 0.16,
  entrance: 0.45,
  layout: 0.45,
  dataReveal: 0.9,
  exit: 0.2,
} as const;

/** Jarak geser entrance (px). */
export const ENTRANCE_OFFSET_Y = 12;

/** Jeda antaritem stagger dan batas item yang ikut dijeda (DESIGN.md §8). */
export const STAGGER_STEP = 0.05;
export const STAGGER_MAX_ITEMS = 8;

/**
 * Jeda item ke-`index`. Item ke-9 dan seterusnya memakai jeda item ke-8,
 * jadi daftar panjang tidak membuat pengguna menunggu.
 */
export function staggerDelay(index: number): number {
  const capped = Math.min(Math.max(Math.trunc(index), 0), STAGGER_MAX_ITEMS - 1);
  return capped * STAGGER_STEP;
}

export const instant: Transition = { duration: 0 };

export const transition = {
  micro: { duration: duration.micro, ease: easeOutQuint },
  entrance: { duration: duration.entrance, ease: easeOutQuint },
  layout: { duration: duration.layout, ease: easeOutQuint },
  dataReveal: { duration: duration.dataReveal, ease: easeOutQuint },
  exit: { duration: duration.exit, ease: easeIn },
  /** Thumb segmented control dan penanda aktif yang bergeser. */
  thumb: { type: "spring", stiffness: 500, damping: 40 },
} satisfies Record<string, Transition>;

export type MotionPresetName = keyof typeof transition;

/**
 * Transition siap pakai yang otomatis menjadi `instant` saat pengguna memilih
 * reduced motion. Hanya untuk Client Component.
 */
export function useMotionPreset() {
  const reduce = useReducedMotion() ?? false;
  return {
    reduce,
    transition: (name: MotionPresetName): Transition => (reduce ? instant : transition[name]),
  };
}
