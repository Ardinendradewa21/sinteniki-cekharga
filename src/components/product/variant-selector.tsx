import { variantPriceNote } from "@/lib/catalog/pricing";
import type { ProductDetailVariant } from "@/lib/catalog/queries";
import { VariantPicker } from "@/components/product/variant-picker";

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
      <VariantPicker
        className="mt-3"
        options={variants.map((variant) => {
          const note = variantPriceNote(variant.price);
          return {
            key: variant.id,
            label: variant.label,
            href: variant.href,
            selected: variant.isSelected,
            note: note.text,
            noteTone: note.tone,
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
