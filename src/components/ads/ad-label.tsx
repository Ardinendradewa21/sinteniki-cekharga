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
        // 12px minimum dan pil solid bertoken (bukan hitam/putih mentah, tanpa
        // backdrop-filter, DESIGN.md §3.4): kontras label tidak bergantung pada
        // gambar di bawahnya pada kedua tema.
        "pointer-events-none inline-flex items-center rounded-pill bg-foreground px-2 py-0.5 text-xs leading-4 font-semibold tracking-wide text-background",
        className
      )}
    >
      {preview ? "Contoh iklan" : "Iklan"}
    </span>
  );
}
