import { animate, inView, type AnimationPlaybackControls } from "motion/react";
import { useLayoutEffect, type RefObject } from "react";

import { ENTRANCE_OFFSET_Y, staggerDelay, transition } from "@/lib/motion";

/** Mulai sedikit sebelum elemen benar-benar masuk dari bawah layar. */
const REVEAL_MARGIN = "0px 0px -64px 0px";

/**
 * Entrance saat elemen masuk viewport, hanya untuk elemen di BAWAH lipatan
 * pertama (DESIGN.md §8.3, audit antislop 002 no 8, antislop R-40).
 *
 * Server selalu mengirim konten dalam keadaan terlihat. Setelah hydration,
 * sebelum paint (layout effect), elemen yang posisinya di bawah layar
 * disembunyikan lalu dimunculkan saat discroll. Elemen yang sudah terlihat
 * saat halaman dibuka tidak pernah disentuh, jadi teks di atas lipatan dan
 * kandidat LCP tidak menunggu JavaScript. Tanpa JavaScript semuanya tetap
 * terlihat, jadi tidak perlu aturan <noscript> lagi.
 *
 * Reduced motion: tidak ada animasi sama sekali (bukan sekadar tanpa
 * transform), sesuai DESIGN.md §8.5.
 *
 * Imperatif (inView + animate) dan tanpa state: tidak ada render ulang dan
 * tidak ada setState di dalam effect.
 */
export function useRevealOnScroll(
  ref: RefObject<HTMLElement | null>,
  { mode, delay = 0 }: { mode: "self" | "children"; delay?: number }
) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    const targets =
      mode === "children" ? Array.from(element.children).filter((child) => child instanceof HTMLElement) : [element];
    if (targets.length === 0) return;

    for (const target of targets) {
      target.style.opacity = "0";
      target.style.transform = `translateY(${ENTRANCE_OFFSET_Y}px)`;
    }

    let controls: AnimationPlaybackControls | undefined;
    const stopObserving = inView(
      element,
      () => {
        controls = animate(
          targets,
          { opacity: [0, 1], y: [ENTRANCE_OFFSET_Y, 0] },
          {
            ...transition.entrance,
            delay: mode === "children" ? (index: number) => delay + staggerDelay(index) : delay,
          }
        );
        stopObserving();
      },
      { margin: REVEAL_MARGIN }
    );

    return () => {
      stopObserving();
      controls?.stop();
      // Effect bisa dijalankan ulang (Strict Mode, perubahan prop): jangan
      // tinggalkan elemen dalam keadaan tersembunyi.
      for (const target of targets) {
        target.style.opacity = "";
        target.style.transform = "";
      }
    };
  }, [ref, mode, delay]);
}
