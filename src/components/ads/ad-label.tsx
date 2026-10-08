import { cn } from "@/lib/utils";

/**
 * Penanda iklan wajib (Etika Pariwara Indonesia, PRD FR-08,
 * docs/ads/ADS-CONTEXT.md §7). Selalu terlihat di dalam materi iklan, kontras
 * tinggi di atas gambar apa pun, dan tidak boleh disembunyikan atau dikecilkan.
 */
export function AdLabel({ preview = false, className }: { preview?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        // 12px minimum dan token tema (bukan hitam/putih mentah): tetap kontras
        // tinggi di atas gambar terang maupun gelap pada kedua tema.
        "pointer-events-none inline-flex items-center rounded-pill bg-foreground/85 px-2 py-0.5 text-xs leading-4 font-semibold tracking-wide text-background backdrop-blur-sm",
        className
      )}
    >
      {preview ? "Contoh iklan" : "Iklan"}
    </span>
  );
}
