import Link from "next/link";

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
      <h2 className="text-sm font-semibold text-foreground">Varian tercatat</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {variants.map((variant) => (
          <li key={variant.id}>
            <Link
              href={variant.href}
              aria-current={variant.isSelected ? "true" : undefined}
              replace
              className={cn(
                "flex min-h-11 flex-col justify-center rounded-lg border px-4 py-2 transition-colors duration-150",
                variant.isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border-strong bg-card text-foreground hover:bg-muted"
              )}
            >
              <span className="text-sm font-semibold">{variant.label}</span>
              <span
                className={cn(
                  "text-xs",
                  variant.isSelected
                    ? "text-background/75"
                    : "text-muted-foreground"
                )}
              >
                {variant.price.status === "available"
                  ? "Ada penawaran"
                  : "Harga belum tersedia"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

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
