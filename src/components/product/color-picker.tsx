import Image from "next/image";

import { SegmentedNav } from "@/components/motion/segmented-nav";
import type { ProductDetailColor } from "@/lib/catalog/queries";

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
 *
 * Segmented Control versi tautan (DESIGN.md §7, VD-06). Nama warna sering
 * panjang ("Pantone Arabesque"), jadi pilihan membungkus ke baris berikutnya
 * dan tampil seperti chip di layar sempit. Foto kecil tetap di panggung terang.
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
      <SegmentedNav
        label="Pilih warna"
        replace
        scroll={false}
        className="mt-3"
        itemClassName="gap-2 pl-1.5 pr-4"
        items={colors.map((color) => ({
          href: color.href,
          active: color.isSelected,
          label: (
            <span className="flex items-center gap-2">
              {color.thumbnail ? (
                <span className="stage relative size-8 shrink-0 overflow-hidden rounded-md">
                  <Image src={color.thumbnail.src} alt="" fill sizes="32px" className="object-contain p-0.5" />
                </span>
              ) : color.swatch ? (
                <span
                  aria-hidden="true"
                  className="ml-1.5 size-5 shrink-0 rounded-full border border-border-strong"
                  style={{ backgroundColor: color.swatch }}
                />
              ) : (
                <span aria-hidden="true" className="w-1.5" />
              )}
              <span>{color.name}</span>
              {color.thumbnail ? null : <span className="sr-only">, belum ada foto warna ini</span>}
            </span>
          ),
        }))}
      />
    </div>
  );
}
