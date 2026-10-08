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
 * Setiap varian menampilkan status harganya sendiri, jadi pengguna tahu varian
 * mana yang punya penawaran sebelum mengkliknya, bukan setelahnya.
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
      <h2 className="heading-label text-foreground">Varian tercatat</h2>
      <VariantPicker
        className="mt-3"
        options={variants.map((variant) => ({
          key: variant.id,
          label: variant.label,
          href: variant.href,
          selected: variant.isSelected,
          note: variant.price.status === "available" ? "Ada penawaran" : "Harga belum tersedia",
        }))}
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
