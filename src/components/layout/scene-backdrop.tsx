import { cn } from "@/lib/utils";

/**
 * Latar halaman tema Verdant (DESIGN.md §6.2). Dekoratif: `aria-hidden`,
 * tidak bisa diklik, dan tidak pernah berada di bawah data harga (kartu data
 * tetap solid).
 *
 * Sejak 18 November 2026 latar ini GRADASI WARNA MEREK, bukan foto. PO
 * menilai foto tumbuhan (siang) dan lampu (malam) tidak relevan dengan
 * CekHarga; tanpa foto yang sesuai, latar cukup gradasi. Bonusnya: tidak ada
 * unduhan gambar latar, jadi beranda tidak lagi menunggu foto untuk LCP
 * (audit 003 no. 4).
 *
 * Varian:
 * - `fade` (layout publik, semua halaman): gradasi di bagian atas yang
 *   memudar ke kanvas.
 * - `full` (hero beranda, layar awal Tanya AI): gradasi setinggi induknya.
 *   Induk wajib `relative isolate`.
 */
export function SceneBackdrop({ variant, className }: { variant: "fade" | "full"; className?: string }) {
  if (variant === "fade") {
    return (
      <div
        aria-hidden="true"
        className={cn("scene-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-120", className)}
      />
    );
  }

  return (
    <div aria-hidden="true" className={cn("scene-full pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="scene-gradient absolute inset-0" />
      {/* Tepi bawah memudar ke kanvas supaya section berikutnya tidak terpotong keras. */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-background" />
    </div>
  );
}
