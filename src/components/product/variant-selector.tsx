import { SegmentedNav } from "@/components/motion/segmented-nav";
import { variantPriceNote } from "@/lib/catalog/pricing";
import type { ProductDetailVariant } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

/**
 * Pemilih varian (PRD FR-03: "pilihan varian yang benar-benar tercatat").
 *
 * Berbasis tautan, bukan state klien. Alasannya: varian menentukan harga dan
 * daftar penawaran, jadi pilihan itu layak punya alamatnya sendiri supaya bisa
 * dibagikan dan dibuka ulang. Konsekuensinya komponen ini tetap Server
 * Component dan tetap berfungsi tanpa JavaScript.
 *
 * Setiap varian menampilkan harganya sendiri (segar, "Terakhir …", atau
 * "Belum ada harga"), jadi pengguna tahu harga tiap kapasitas sebelum
 * mengkliknya, bukan setelahnya.
 *
 * Tampil sebagai Segmented Control versi tautan (DESIGN.md §7, VD-06): thumb
 * bergeser ke kapasitas terpilih, dan pilihan membungkus ke baris berikutnya
 * bila tidak muat di 375 px. Pemilih ringkas di halaman perbandingan tetap
 * memakai VariantPicker.
 */
export function VariantSelector({
  variants,
}: {
  variants: ProductDetailVariant[];
}) {
  if (variants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada varian yang tercatat untuk produk ini.
      </p>
    );
  }

  return (
    <div>
      <h2 className="heading-label text-foreground">
        Pilih kapasitas
        <span className="ml-2 text-xs font-normal text-muted-foreground">{variants.length} varian tercatat</span>
      </h2>
      <SegmentedNav
        label="Pilih kapasitas"
        replace
        className="mt-3"
        itemClassName="min-h-14 py-1.5"
        items={variants.map((variant) => {
          const note = variantPriceNote(variant.price);
          return {
            href: variant.href,
            active: variant.isSelected,
            label: (
              <span className="flex flex-col items-start text-left">
                <span>{variant.label}</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    // "Terakhir …" tetap memakai kata, bukan warna saja.
                    note.tone === "warning" ? "text-warning" : variant.isSelected ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {note.text}
                </span>
              </span>
            ),
          };
        })}
      />

      {variants.some((variant) => variant.region) ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {variants
            .filter((variant) => variant.region)
            .map((variant) => (
              <li key={`${variant.id}-region`}>
                {variant.label}: {variant.region}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
