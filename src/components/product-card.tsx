import Image from "next/image";
import Link from "next/link";

import { DemoBadge } from "@/components/demo-marker";
import { CardPriceMeta, CardPriceValue } from "@/components/price-display";
import { buildCompareHref } from "@/lib/catalog/compare-params";
import type { ProductSummary } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

/**
 * Kartu produk katalog.
 *
 * Bahasa visualnya mengikuti referensi katalog premium/minimal (PRD §8): kartu
 * putih yang ringkas, area visual dominan, dan metadata singkat di bawah. Pada
 * desktop lebarnya sekitar 230-245px agar kepadatannya mendekati referensi
 * katalog Shopee tanpa menyalin fungsi marketplace-nya. Yang
 * TIDAK diambil dari referensi adalah fungsi tokonya: tidak ada tombol favorit
 * atau keranjang, karena CekHarga bukan marketplace dan belum punya akun
 * pengguna (PRD §3 dan §8). Slot kanan atas dipakai penanda data demo.
 * Tombol Bandingkan di bagian bawah adalah pintasan ke fitur perbandingan,
 * bukan aksi belanja.
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
  eager = false,
  className,
}: {
  product: ProductSummary;
  now: Date;
  /**
   * Tujuan halaman detail. Jika kosong, kartu tampil tanpa tautan detail
   * maupun pintasan bandingkan, misalnya dalam contoh style guide.
   */
  href?: string;
  isDemo?: boolean;
  /**
   * Muat gambar segera. Hanya untuk baris pertama yang terlihat saat halaman
   * dibuka; sisanya tetap lazy sehingga gambar baru diambil saat mendekati
   * viewport ketika pengguna scroll.
   */
  eager?: boolean;
  className?: string;
}) {
  const content = (
    <>
      {isDemo ? (
        <DemoBadge className="absolute top-2 right-2 z-10 sm:top-3 sm:right-3" />
      ) : null}

      <div className="flex aspect-square w-full items-center justify-center bg-muted/20 p-2 sm:p-4">
        <Image
          src={product.image.src}
          alt={product.image.alt}
          width={140}
          height={210}
          loading={eager ? "eager" : "lazy"}
          // dark:rounded-md: foto lama yang latarnya belum bisa dihapus (ponsel
          // menempel ke tepi) tampil sebagai kartu rapi, bukan kotak bersudut.
          className="h-[76%] max-h-40 w-auto transition-transform duration-150 group-hover:scale-[1.03] dark:rounded-md sm:h-[68%]"
        />
      </div>

      <div className="flex flex-1 flex-col p-2 sm:p-3.5">
        <p className="truncate text-xs font-medium text-muted-foreground">
          {product.brand} · {product.variantCount} varian
        </p>

        <h3 className="mt-0.5 line-clamp-2 min-h-8 text-[13px] leading-4 font-bold tracking-tight text-foreground sm:mt-1 sm:min-h-9 sm:text-sm sm:leading-[1.3]">
          {product.model}
        </h3>

        <CardPriceValue
          price={product.price}
          className="mt-1.5 line-clamp-1 text-[15px] leading-tight sm:mt-2 sm:text-sm"
        />

        <CardPriceMeta
          price={product.price}
          referenceVariant={product.priceReferenceVariant}
          now={now}
          className="mt-1 line-clamp-2 min-h-8 text-xs leading-4"
        />

        {href ? (
          <div className="relative z-10 mt-auto border-t border-border pt-1.5">
            <Link
              href={buildCompareHref([{ slug: product.slug, variantKey: null }])}
              aria-label={`Bandingkan ${product.name} dengan produk lain`}
              className="flex min-h-11 w-full items-center justify-center rounded-md text-xs font-semibold text-brand transition-colors hover:bg-brand-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              Bandingkan
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );

  const shell = cn(
    "relative flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-border bg-card sm:rounded-lg",
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
        className="absolute inset-0 z-0 rounded-md sm:rounded-lg"
        aria-label={`Lihat detail ${product.name}`}
      />
      {content}
    </article>
  );
}
