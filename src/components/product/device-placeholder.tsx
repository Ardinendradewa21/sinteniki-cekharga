import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Pengganti foto saat produk belum punya foto asli (PRD §8, audit UX-13).
 *
 * PRD meminta SVG perangkat generik lokal dengan keterangan yang tepat, dan
 * melarang render generik tampak seperti foto model asli. Karena itu ilustrasi
 * dibuat lebih kecil dan diredupkan (dekoratif, alt kosong), dengan teks
 * "Foto belum tersedia" yang dibaca pembaca layar maupun pengguna. Dipakai di
 * kartu katalog/beranda, galeri detail, dan kolom perbandingan supaya ketiganya
 * sama.
 */
const SIZE = {
  sm: "h-20 w-auto",
  md: "h-28 w-auto",
  lg: "h-44 w-auto sm:h-52",
} as const;

export function DevicePlaceholder({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-col items-center justify-center gap-2 text-center", className)}>
      <Image
        src="/images/generic-device.svg"
        alt=""
        aria-hidden
        width={140}
        height={210}
        className={cn(SIZE[size], "opacity-50 grayscale")}
      />
      <span className="text-xs font-medium text-muted-foreground">Foto belum tersedia</span>
    </span>
  );
}
