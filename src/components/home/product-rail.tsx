"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Lebar pudar tepi, hanya di sisi yang masih bisa digeser. */
const FADE_PX = 40;

/**
 * Deretan produk yang digeser mendatar, dengan pola carousel ritel:
 * kartu berhenti rapi per kartu (scroll snap), tombol panah di layar lebar
 * yang hanya muncul bila masih ada kartu ke arah itu, dan pudar tepi yang
 * hanya tampil di sisi yang masih bisa digeser.
 *
 * Dulu deretan ini bergerak sendiri dan punya gradien permanen di kedua
 * tepi, sehingga tampak seperti bayangan saat digeser (masukan PO 16 Okt
 * 2026). Tidak ada lagi gerak otomatis; pengguna yang mengendalikan.
 */
export function ProductRail({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });
  const reduceMotion = useReducedMotion();
  const id = useId();

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const max = viewport.scrollWidth - viewport.clientWidth;
      setEdges({ atStart: viewport.scrollLeft <= 2, atEnd: viewport.scrollLeft >= max - 2 });
    };
    update();
    viewport.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(viewport);
    return () => {
      viewport.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, []);

  const scrollByPage = (direction: 1 | -1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({ left: direction * viewport.clientWidth * 0.85, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const left = edges.atStart ? "black 0" : `transparent 0, black ${FADE_PX}px`;
  const right = edges.atEnd ? "black 100%" : `black calc(100% - ${FADE_PX}px), transparent 100%`;
  const mask = `linear-gradient(to right, ${left}, ${right})`;

  return (
    <div className="relative">
      <div
        id={id}
        ref={viewportRef}
        role="region"
        aria-label="Produk di katalog. Daftar dapat digeser mendatar."
        className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8 [&::-webkit-scrollbar]:hidden [&>ul>li]:snap-start"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {children}
      </div>

      {(
        [
          { direction: -1, hidden: edges.atStart, label: "Geser ke produk sebelumnya", icon: ArrowLeft01Icon, side: "-left-3 lg:-left-5" },
          { direction: 1, hidden: edges.atEnd, label: "Geser ke produk berikutnya", icon: ArrowRight01Icon, side: "-right-3 lg:-right-5" },
        ] as const
      ).map((arrow) => (
        <Button
          key={arrow.direction}
          type="button"
          variant="outline"
          size="icon"
          aria-label={arrow.label}
          aria-controls={id}
          tabIndex={arrow.hidden ? -1 : 0}
          onClick={() => scrollByPage(arrow.direction)}
          className={cn(
            "absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 rounded-pill bg-card shadow-md transition-opacity duration-200 sm:inline-flex",
            arrow.side,
            arrow.hidden && "pointer-events-none opacity-0"
          )}
        >
          <HugeiconsIcon icon={arrow.icon} size={20} strokeWidth={1.8} aria-hidden />
        </Button>
      ))}
    </div>
  );
}
