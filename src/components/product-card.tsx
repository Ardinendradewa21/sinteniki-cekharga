import Image from "next/image";
import Link from "next/link";

import { DemoBadge } from "@/components/demo-marker";
import { CardPriceMeta, CardPriceValue } from "@/components/price-display";
import { CompareToggle } from "@/components/compare/compare-toggle";
import type { ProductSummary } from "@/lib/catalog/queries";
import { DevicePlaceholder } from "@/components/product/device-placeholder";
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
 * Tombol Bandingkan di bagian bawah memasukkan produk ke baki perbandingan
 * (CompareTray), bukan aksi belanja.
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

      {/* Panggung foto terang di kedua tema (DESIGN.md §2.2): foto resmi
          berlatar putih tidak tampil sebagai kotak di tema gelap. Tanpa teks
          di atas panggung (DESIGN.md §3.4). */}
      {/* min-h-0 + overflow-hidden: tanpa ini aspect-ratio ikut membesar
          mengikuti tinggi minimum foto, sehingga panggung antarkartu tidak
          sama tinggi (terlihat di VD-04). */}
      <div className="stage m-1.5 flex aspect-square min-h-0 items-center justify-center overflow-hidden rounded-md p-2 sm:m-2 sm:rounded-lg sm:p-4 lg:aspect-5/4">
        {product.image.isGenericIllustration ? (
          <DevicePlaceholder size="sm" />
        ) : (
          <Image
            src={product.image.src}
            alt={product.image.alt}
            width={140}
            height={210}
            loading={eager ? "eager" : "lazy"}
            className="h-[86%] max-h-full w-auto object-contain transition-transform duration-150 group-hover:scale-[1.03] sm:h-[82%]"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 sm:px-3.5 sm:pb-3.5">
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
            <CompareToggle
              item={{
                slug: product.slug,
                name: product.name,
                image: product.image.isGenericIllustration ? null : product.image.src,
              }}
            />
          </div>
        ) : null}
      </div>
    </>
  );

  const shell = cn(
    // Kartu solid radius 22/28px (DESIGN.md §5: kartu katalog xl), panggung di dalamnya 14/22px.
    "relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:rounded-xl",
    className
  );

  if (!href) {
    return <article className={shell}>{content}</article>;
  }

  return (
    <article
      className={cn(
        shell,
        // Micro-interaction 150ms (DESIGN.md §8): angkat tipis + bayangan lembut, tanpa glow.
        "group transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-lg sm:rounded-xl"
        aria-label={`Lihat detail ${product.name}`}
      />
      {content}
    </article>
  );
}
