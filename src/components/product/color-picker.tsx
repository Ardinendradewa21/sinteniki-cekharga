import Image from "next/image";
import Link from "next/link";

import type { ProductDetailColor } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

/**
 * Pemilih warna di halaman detail (2026-10-12).
 *
 * Berbasis tautan seperti pemilih varian: warna hidup di URL (?warna=),
 * bisa dibagikan, dan tetap berfungsi tanpa JavaScript. Memilih warna hanya
 * mengganti foto yang tampil; harga tetap per kapasitas (PRD §7), dan itu
 * dikatakan terus terang di bawah daftar.
 *
 * Setiap pilihan selalu menulis nama warnanya. Foto kecil atau titik warna
 * hanya penanda tambahan, jadi pengguna tidak perlu membedakan warna dari
 * tampilan saja (PRD §8).
 */
export function ColorPicker({
  colors,
  selected,
}: {
  colors: ProductDetailColor[];
  selected: ProductDetailColor | null;
}) {
  if (colors.length === 0) return null;

  return (
    <div>
      <h2 className="heading-label text-foreground">
        Pilih warna
        {selected ? <span className="font-normal text-muted-foreground">: {selected.name}</span> : null}
        <span className="ml-2 text-xs font-normal text-muted-foreground">{colors.length} warna tercatat</span>
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {colors.map((color) => (
          <li key={color.key}>
            <Link
              href={color.href}
              replace
              scroll={false}
              aria-current={color.isSelected ? "true" : undefined}
              aria-label={`Warna ${color.name}${color.thumbnail ? "" : ", belum ada foto warna ini"}`}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-4 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                color.isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-strong bg-card text-foreground hover:bg-muted",
                !color.thumbnail && !color.swatch && "pl-4"
              )}
            >
              {color.thumbnail ? (
                <span className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-white">
                  <Image src={color.thumbnail.src} alt="" fill sizes="32px" className="object-contain p-0.5" />
                </span>
              ) : color.swatch ? (
                <span
                  aria-hidden="true"
                  className="ml-1.5 size-5 shrink-0 rounded-full border border-border-strong"
                  style={{ backgroundColor: color.swatch }}
                />
              ) : null}
              <span className="font-semibold">{color.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
