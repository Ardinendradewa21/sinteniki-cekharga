import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, Clock01Icon } from "@hugeicons/core-free-icons";

import { MarketplaceLogo, marketplaceKey } from "@/components/product/marketplace-logo";
import { Button } from "@/components/ui/button";
import { formatCheckedAt, formatIdr } from "@/lib/catalog/pricing";
import type { ProductDetailOffer } from "@/lib/catalog/queries";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Daftar penawaran untuk varian terpilih (PRD FR-05), sebagai kartu baris
 * ringkas: logo toko, nama, waktu pemeriksaan, harga, lalu tombol ke toko.
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

function OfferCard({ offer, now }: { offer: ProductDetailOffer; now: Date }) {
  const isOfficialSite = marketplaceKey(offer.url, offer.store) === "official";
  const showSeller =
    offer.sellerName.trim().toLowerCase() !== offer.marketplace.trim().toLowerCase();
  const inactive = offer.listingStatus !== "active";
  const cta = isOfficialSite ? "Buka situs resmi" : `Buka di ${offer.marketplace}`;

  return (
    <li
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 rounded-2xl border bg-card p-3 transition-colors duration-150 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-x-4 sm:p-4",
        offer.isPriceBasis && offer.isFreshPrice
          ? "border-brand/50 ring-1 ring-brand/20"
          : "border-border hover:border-border-strong"
      )}
    >
      <MarketplaceLogo url={offer.url} store={offer.store} name={offer.marketplace} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-bold text-foreground">{offer.marketplace}</p>
          {offer.isPriceBasis ? (
            /*
              Penawaran basi memang sumber angka "harga terakhir tercatat",
              tapi menyebutnya "dasar harga" akan terbaca seolah harganya masih
              berlaku.
            */
            <Chip tone={offer.isFreshPrice ? "strong" : "warning"}>
              {offer.isFreshPrice ? "Dasar harga" : "Harga terakhir tercatat"}
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
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1 text-xs font-medium",
            offer.isFreshPrice ? "text-success" : "text-warning"
          )}
        >
          <HugeiconsIcon icon={Clock01Icon} size={13} strokeWidth={2} aria-hidden />
          {offer.checkedAt
            ? `Diperiksa ${formatCheckedAt(offer.checkedAt, now)}${offer.isFreshPrice ? "" : ", sudah lama"}`
            : "Belum pernah berhasil diperiksa"}
        </p>
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
  now,
}: {
  offers: ProductDetailOffer[];
  variantLabel: string | null;
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
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}
