"use client";

import { Children, useRef, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { useHydrated } from "@/components/motion/use-hydrated";
import { Button } from "@/components/ui/button";

/**
 * Review Carousel (DESIGN.md §7, VD-06): kartu ringkasan ulasan satu aspek,
 * satu kartu per tampilan.
 *
 * - Dasarnya scroll-snap CSS, jadi tanpa JavaScript daftar tetap bisa digeser
 *   (sentuh, trackpad, atau panah keyboard setelah daftar difokus).
 * - Tombol sebelumnya/berikutnya dan penanda "1 dari 3" untuk mouse dan
 *   keyboard. Sebelum hydration tombolnya nonaktif, bukan tombol mati.
 * - Tidak pernah berputar sendiri. Reduced motion: lompat tanpa gulir halus.
 */
export function ReviewCarousel({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const hydrated = useHydrated();
  const count = Children.count(children);

  function cards(): HTMLElement[] {
    return Array.from(track.current?.children ?? []).filter((child): child is HTMLElement => child instanceof HTMLElement);
  }

  function go(target: number) {
    const list = track.current;
    const card = cards()[target];
    if (!list || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ left: card.offsetLeft - list.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  }

  // Penanda mengikuti posisi gulir, termasuk geseran sentuh dan keyboard.
  function onScroll() {
    const list = track.current;
    if (!list) return;
    const all = cards();
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    all.forEach((card, position) => {
      const distance = Math.abs(card.offsetLeft - list.offsetLeft - list.scrollLeft);
      if (distance < best) {
        best = distance;
        nearest = position;
      }
    });
    if (nearest !== index) setIndex(nearest);
  }

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className="mt-3">
      <ul
        ref={track}
        tabIndex={0}
        aria-label={`${label}, ${count} ulasan. Geser atau pakai tombol panah.`}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto overscroll-x-contain rounded-xl pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {children}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Ulasan sebelumnya"
          disabled={!hydrated || index === 0}
          onClick={() => go(index - 1)}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Ulasan berikutnya"
          disabled={!hydrated || index >= count - 1}
          onClick={() => go(index + 1)}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-5" aria-hidden />
        </Button>
        <p className="ml-1 text-sm text-muted-foreground tabular-nums" aria-live="polite">
          Ulasan {index + 1} dari {count}
        </p>
      </div>
    </div>
  );
}
