import Image from "next/image";
import { cookies } from "next/headers";

import { PUBLIC_THEME_COOKIE, type PublicTheme } from "@/lib/public/preferences-config";
import { cn } from "@/lib/utils";

/** Sumber dan lisensi: public/images/scene/SOURCES.md. */
const SCENE_SRC: Record<PublicTheme, string> = {
  light: "/images/scene/day.avif",
  dark: "/images/scene/night.avif",
};

/**
 * Foto latar tema Verdant (DESIGN.md §6.2). Dekoratif: `aria-hidden`,
 * `alt=""`, tidak bisa diklik, dan tidak pernah berada di bawah data harga
 * (kartu data tetap solid).
 *
 * Varian:
 * - `fade` (layout publik, semua halaman): foto blur tipis 480px di bagian atas
 *   yang memudar ke canvas. Lewat token CSS `--scene-blur`, tanpa elemen
 *   gambar, jadi tidak menambah beban LCP.
 * - `full` (section hero): foto tajam selebar layar setinggi induknya, dengan
 *   `--veil` dan zona `--veil-text` untuk copy (`textZone`). Induk wajib
 *   `relative isolate`. Hanya foto tema aktif yang dimuat dengan prioritas
 *   tinggi; foto tema lain lazy dan tersembunyi CSS sampai tema diganti.
 *
 * Ikut bergulir bersama halaman (`absolute`, bukan `fixed`): tanpa parallax
 * dan tanpa repaint setiap scroll.
 */
export async function SceneBackdrop({
  variant,
  textZone = "left",
  className,
}: {
  variant: "fade" | "full";
  textZone?: "left" | "top";
  className?: string;
}) {
  if (variant === "fade") {
    return (
      <div
        aria-hidden="true"
        className={cn("scene-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-120", className)}
      />
    );
  }

  const activeTheme: PublicTheme =
    (await cookies()).get(PUBLIC_THEME_COOKIE)?.value === "dark" ? "dark" : "light";

  return (
    <div aria-hidden="true" className={cn("scene-full pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      {(["light", "dark"] as const).map((theme) => {
        const active = theme === activeTheme;
        return (
          <Image
            key={theme}
            src={SCENE_SRC[theme]}
            alt=""
            fill
            sizes="100vw"
            loading={active ? "eager" : "lazy"}
            fetchPriority={active ? "high" : "low"}
            className={cn("object-cover", theme === "light" ? "scene-day" : "scene-night")}
          />
        );
      })}
      <div className="scene-veil absolute inset-0" />
      <div className={cn("absolute inset-0", textZone === "left" ? "scene-text-left" : "scene-text-top")} />
      {/* Tepi bawah memudar ke canvas supaya section berikutnya tidak terpotong keras. */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-background" />
    </div>
  );
}
