import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";

import { StaggerList } from "@/components/motion/reveal";
import { MarketplaceLogo, marketplaceKey } from "@/components/product/marketplace-logo";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { formatCheckedAt, formatIdr } from "@/lib/catalog/pricing";
import type { ProductDetailOffer } from "@/lib/catalog/queries";
import { Badge } from "@/components/ui/badge";
import { OfferFilters } from "@/components/product/offer-filters";
import { isOfficialWarranty } from "@/lib/catalog/warranty";
import { cn } from "@/lib/utils";

/**
 * Daftar penawaran untuk varian terpilih (PRD FR-05) sebagai Offer Row
 * (DESIGN.md §7, VD-06): satu daftar bergaya "transaction list" di permukaan
 * solid, satu kolom supaya kolom harga sejajar dan mudah dipindai. Tiap baris:
 * tile logo toko, nama toko dan penjual, warna, Status Pill waktu periksa,
 * harga, lalu tombol Buka. Baris di bawah lipatan muncul bertahap sekali
 * (StaggerList); tanpa JavaScript semuanya tetap tampil.
 *
 * Aturan yang ditegakkan:
 *
 * - Hanya penawaran milik varian terpilih yang muncul, jadi listing varian lain
 *   tidak pernah bisa terbaca sebagai basis harga.
 * - Listing yang habis atau ambigu TETAP ditampilkan supaya pengguna tahu
 *   keberadaannya, tapi diberi label statusnya dan tidak pernah ditandai sebagai
 *   dasar harga. Status "aktif" tidak diberi label karena itu keadaan normal.
 * - Harga kedaluwarsa dibedakan dari harga yang masih baru.
 * - Badge penjual terverifikasi hanya muncul kalau datanya memang menyatakan
 *   verifikasi. Logo toko bukan tanda verifikasi atau kemitraan.
 * - Tidak ada klaim bahwa CekHarga memproses transaksi.
 */

const STATUS_LABEL: Record<Exclude<ProductDetailOffer["listingStatus"], "active">, string> = {
  "out-of-stock": "Stok habis",
  ambiguous: "Listing ambigu",
  inactive: "Tidak aktif",
};

function Chip({ tone, children }: { tone: "strong" | "warning" | "brand"; children: string }) {
  return <Badge variant={tone === "strong" ? "default" : tone}>{children}</Badge>;
}

function OfferCard({
  offer,
  selectedColor,
  now,
}: {
  offer: ProductDetailOffer;
  selectedColor: string | null;
  now: Date;
}) {
  const isOfficialSite = marketplaceKey(offer.url, offer.store) === "official";
  const showSeller =
    offer.sellerName.trim().toLowerCase() !== offer.marketplace.trim().toLowerCase();
  const inactive = offer.listingStatus !== "active";
  const cta = isOfficialSite ? "Buka situs resmi" : `Buka di ${offer.marketplace}`;

  const official = isOfficialWarranty(offer.warranty);
  return (
    <li
      data-out-of-stock={offer.listingStatus === "out-of-stock"}
      data-official={official}
      className={cn(
        // Filter pilihan pengguna (OfferFilters) menyembunyikan lewat atribut data.
        "group-data-[hide-oos=true]/offers:data-[out-of-stock=true]:hidden group-data-[official-only=true]/offers:data-[official=false]:hidden",
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-x-4 sm:px-5 sm:py-4",
        // Dasar harga segar ditandai latar hijau muda selain label katanya.
        offer.isPriceBasis && offer.isFreshPrice ? "bg-brand-muted/40" : null
      )}
    >
      <MarketplaceLogo url={offer.url} store={offer.store} name={offer.marketplace} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="line-clamp-2 text-sm font-bold break-words text-foreground">{offer.marketplace}</p>
          {offer.isPriceBasis ? (
            /*
              Penawaran basi memang sumber angka "harga terakhir tercatat",
              tapi menyebutnya "dasar harga" akan terbaca seolah harganya masih
              berlaku.
            */
            <Chip tone={offer.isFreshPrice ? "strong" : "warning"}>
              {/* Basi: kata "Harga terakhir tercatat" sudah ada di pil waktu periksa. */}
              {offer.isFreshPrice ? "Dasar harga" : "Acuan harga di atas"}
            </Chip>
          ) : null}
          {offer.sellerVerified ? <Chip tone="brand">Penjual terverifikasi</Chip> : null}
          {inactive ? (
            <Chip tone="warning">
              {STATUS_LABEL[offer.listingStatus as keyof typeof STATUS_LABEL]}
            </Chip>
          ) : null}
        </div>
        {showSeller ? (
          <p className="truncate text-xs text-muted-foreground">{offer.sellerName}</p>
        ) : null}
        {offer.colors.length > 0 ? (
          // Warna yang tercatat di listing ini; warna terpilih ditebalkan.
          // Membungkus sampai 2 baris, bukan terpotong satu baris (UX-26).
          <p className="line-clamp-2 text-xs text-muted-foreground" title={offer.colors.join(", ")}>
            Warna:{" "}
            {offer.colors.map((color, index) => (
              <span key={color}>
                {index > 0 ? ", " : null}
                {selectedColor && color.toLowerCase() === selectedColor.toLowerCase() ? (
                  <strong className="font-semibold text-foreground">{color}</strong>
                ) : (
                  color
                )}
              </span>
            ))}
          </p>
        ) : null}
        <StatusPill tone={offer.isFreshPrice ? "fresh" : "stale"} className="mt-1.5 px-2 py-0.5">
          {offer.checkedAt
            ? offer.isFreshPrice
              ? `Diperiksa ${formatCheckedAt(offer.checkedAt, now)}`
              : `Harga terakhir tercatat · ${formatCheckedAt(offer.checkedAt, now)}`
            : "Belum pernah berhasil diperiksa"}
        </StatusPill>
      </div>

      <div className="text-right">
        <p
          className={cn(
            "tabular text-base font-extrabold tracking-tight sm:text-lg",
            inactive || offer.priceIdr === null ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {offer.priceIdr === null ? "Belum tercatat" : formatIdr(offer.priceIdr)}
        </p>
        {offer.warranty ? (
          <p className="max-w-40 truncate text-xs text-muted-foreground">{offer.warranty}</p>
        ) : null}
      </div>

      {/* Tombol sistem (Button asChild), bukan gaya buatan sendiri: CTA paling
          penting harus ikut setiap perubahan tema tombol. Slot Radix tidak
          menambah role="button", jadi tetap tautan bagi pembaca layar. */}
      <Button asChild className="col-span-3 sm:col-span-1">
        <a
          href={offer.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${cta}${isOfficialSite ? ` (${offer.marketplace})` : ""}, membuka tab baru`}
        >
          <span className="sm:hidden">{cta}</span>
          <span className="hidden sm:inline">Buka</span>
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} strokeWidth={2} aria-hidden />
        </a>
      </Button>
    </li>
  );
}

export function OfferList({
  offers,
  variantLabel,
  selectedColor = null,
  now,
}: {
  offers: ProductDetailOffer[];
  variantLabel: string | null;
  /** Warna yang sedang dipilih; hanya menandai, tidak menyaring penawaran. */
  selectedColor?: string | null;
  now: Date;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="heading-section text-foreground">
          Penawaran
          {offers.length > 0 ? (
            <span className="ml-2 text-base font-semibold text-muted-foreground">
              {offers.length}
            </span>
          ) : null}
        </h2>
        {variantLabel ? (
          <p className="text-sm text-muted-foreground">Varian {variantLabel} · kondisi baru</p>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Pembelian dan harga akhir mengikuti toko tujuan; CekHarga tidak memproses transaksi.
      </p>

      {offers.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground">
            Belum ada penawaran tercatat untuk varian ini
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Varian lain dari produk ini mungkin punya penawaran. Coba pilih
            varian yang berbeda di atas.
          </p>
        </div>
      ) : (
        <OfferFilters
          total={offers.length}
          outOfStockCount={offers.filter((offer) => offer.listingStatus === "out-of-stock").length}
          officialCount={offers.filter((offer) => isOfficialWarranty(offer.warranty)).length}
        >
          <StaggerList className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} selectedColor={selectedColor} now={now} />
            ))}
          </StaggerList>
        </OfferFilters>
      )}
    </section>
  );
}
