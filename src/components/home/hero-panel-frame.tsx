"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Rasio foto scene dan versi blurnya (2400x1500, 1200x750). */
const SCENE_RATIO = 1.6;

/**
 * Bingkai kaca pre-blurred untuk Hero Price Panel (DESIGN.md §6.3).
 *
 * Latarnya `--scene-blur` yang ukuran dan posisinya disamakan dengan foto
 * hero (`object-cover`, tengah) di wilayah `[data-scene-region]`, sehingga
 * panel tampak seperti kaca buram di atas foto tanpa `backdrop-filter`.
 * Nilainya ditulis sebagai variabel CSS oleh ResizeObserver, tanpa state dan
 * tanpa render ulang. Sebelum JavaScript jalan, CSS sudah memasang foto blur
 * yang sama dengan posisi perkiraan (cover, tengah), sehingga panel tidak
 * "muncul" belakangan sebagai kandidat LCP.
 *
 * Tidak ada teks yang langsung di atas kaca ini: isinya kartu solid dan
 * kontrol bertrack solid. Panel juga tidak dianimasikan dengan transform,
 * supaya latar blurnya tidak bergeser.
 */
export function HeroPanelFrame({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const panel = ref.current;
    const region = panel?.closest<HTMLElement>("[data-scene-region]");
    if (!panel || !region) return;

    const update = () => {
      const area = region.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      const width = Math.max(area.width, area.height * SCENE_RATIO);
      const height = width / SCENE_RATIO;
      panel.style.setProperty("--blur-size", `${width}px ${height}px`);
      panel.style.setProperty(
        "--blur-pos",
        `${(area.width - width) / 2 - (box.left - area.left)}px ${(area.height - height) / 2 - (box.top - area.top)}px`
      );
      panel.dataset.blurReady = "";
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(region);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("hero-panel glass rounded-xl p-2.5 sm:p-3", className)}>
      {children}
    </div>
  );
}
