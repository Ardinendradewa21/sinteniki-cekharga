import { cn } from "@/lib/utils";

/**
 * Titik status asisten di beranda: hijau saat aktif, amber saat tidak
 * tersedia. Statis (PRD §8 menghindari loop) dan selalu ditemani kalimat,
 * jadi artinya tidak disampaikan lewat warna saja.
 */
export function StatusDot({ tone }: { tone: "success" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex size-2.5 shrink-0 rounded-pill",
        tone === "success" ? "bg-success" : "bg-warning"
      )}
      aria-hidden
    />
  );
}
