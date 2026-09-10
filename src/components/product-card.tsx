import Image from "next/image";
import Link from "next/link";

import { DemoBadge } from "@/components/demo-marker";
import { CardPriceMeta, CardPriceValue } from "@/components/price-display";
import type { ProductSummary } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

/**
 * Kartu produk katalog.
 *
 * Bahasa visualnya mengikuti referensi katalog premium/minimal (PRD §8): kartu
 * putih ber-radius besar, area visual dominan, metadata ringkas di bawah. Yang
 * TIDAK diambil dari referensi adalah fungsi tokonya: tidak ada tombol favorit
 * atau keranjang, karena CekHarga bukan marketplace dan belum punya akun
 * pengguna (PRD §3 dan §8). Slot kanan atas dipakai penanda data demo.
 *
 * Isi kartu sengaja ringkas: merek, nama, harga, dan varian. Spesifikasi detail
 * seperti baterai dan chipset ada di halaman detail, bukan di kartu. PRD FR-02
 * memang menyebut "Tidak perlu menampilkan semua spesifikasi di kartu".
 *
 * Varian acuan dan waktu pemeriksaan tetap ditampilkan karena keduanya wajib
 * menyertai harga (PRD §7 butir 3 dan 6), bukan sekadar hiasan.
 */
export function ProductCard({
  product,
  now,
  href,
  isDemo = false,
  className,
}: {
  product: ProductSummary;
  now: Date;
  /**
   * Tujuan halaman detail. Selama halaman detail belum ada (Sprint FE-3),
   * biarkan kosong: kartu tampil tanpa afordansi hover supaya tidak
   * menjanjikan interaksi yang belum berfungsi (PRD §8).
   */
  href?: string;
  isDemo?: boolean;
  className?: string;
}) {
  const content = (
    <>
      {isDemo ? (
        <DemoBadge className="absolute top-5 right-5 z-10" />
      ) : null}

      <div className="flex items-center justify-center px-6 py-8">
        <Image
          src={product.image.src}
          alt={product.image.alt}
          width={140}
          height={210}
          className="h-44 w-auto transition-transform duration-150 group-hover:scale-[1.03]"
        />
      </div>

      <div className="mt-auto flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">
          {product.brand} · {product.variantCount} varian
        </p>

        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-bold tracking-tight text-foreground">
            {product.model}
          </h3>
          <CardPriceValue price={product.price} />
        </div>

        <CardPriceMeta
          price={product.price}
          referenceVariant={product.priceReferenceVariant}
          now={now}
        />
      </div>
    </>
  );

  const shell = cn(
    "relative flex h-full flex-col rounded-xl border border-border bg-card p-5",
    className
  );

  if (!href) {
    return <article className={shell}>{content}</article>;
  }

  return (
    <article
      className={cn(
        shell,
        // Micro-interaction 150ms (PRD §8): angkat tipis + bayangan lembut, tanpa glow.
        "group transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`Lihat detail ${product.name}`}
      />
      {content}
    </article>
  );
}
