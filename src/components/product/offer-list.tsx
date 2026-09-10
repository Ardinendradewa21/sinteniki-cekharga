import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare01Icon } from "@hugeicons/core-free-icons";

import { formatCheckedAt, formatIdr } from "@/lib/catalog/pricing";
import type { ProductDetailOffer } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

/**
 * Daftar penawaran untuk varian terpilih (PRD FR-05).
 *
 * Aturan yang ditegakkan:
 *
 * - Hanya penawaran milik varian terpilih yang muncul, jadi listing varian lain
 *   tidak pernah bisa terbaca sebagai basis harga.
 * - Listing yang habis atau ambigu TETAP ditampilkan supaya pengguna tahu
 *   keberadaannya, tapi diberi label statusnya dan tidak pernah ditandai sebagai
 *   dasar harga.
 * - Harga kedaluwarsa dibedakan dari harga yang masih baru.
 * - Badge penjual terverifikasi hanya muncul kalau datanya memang menyatakan
 *   verifikasi. Tidak ada badge yang diberikan berdasarkan tebakan.
 * - Tidak ada klaim bahwa CekHarga memproses transaksi.
 */

const STATUS_LABEL: Record<ProductDetailOffer["listingStatus"], string> = {
  active: "Listing aktif",
  "out-of-stock": "Stok habis",
  ambiguous: "Listing ambigu",
  inactive: "Tidak aktif",
};

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
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Penawaran
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {variantLabel
          ? `Penawaran yang tercatat untuk varian ${variantLabel}.`
          : "Penawaran yang tercatat."}{" "}
        Pembelian dan harga akhir mengikuti marketplace tujuan; CekHarga tidak
        memproses transaksi.
      </p>

      {offers.length === 0 ? (
        <div className="mt-5 rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-foreground">
            Belum ada penawaran tercatat untuk varian ini
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Varian lain dari produk ini mungkin punya penawaran. Coba pilih
            varian yang berbeda di atas.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {offers.map((offer) => (
            <li
              key={offer.id}
              className={cn(
                "rounded-xl border bg-card p-5",
                offer.isPriceBasis ? "border-foreground" : "border-border"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {offer.marketplace}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {offer.sellerName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {offer.isPriceBasis ? (
                    /*
                      Dibedakan supaya badge tidak bertabrakan dengan pernyataan
                      harga di atas halaman. Penawaran basi memang sumber angka
                      "harga terakhir tercatat", tapi menyebutnya "dasar harga"
                      akan terbaca seolah harganya masih berlaku.
                    */
                    <span
                      className={cn(
                        "rounded-pill px-2.5 py-1 text-xs font-semibold",
                        offer.isFreshPrice
                          ? "bg-foreground text-background"
                          : "bg-warning-muted text-warning"
                      )}
                    >
                      {offer.isFreshPrice ? "Dasar harga" : "Harga terakhir tercatat"}
                    </span>
                  ) : null}
                  {offer.sellerVerified ? (
                    <span className="rounded-pill bg-brand-muted px-2.5 py-1 text-xs font-semibold text-brand">
                      Penjual terverifikasi
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-pill px-2.5 py-1 text-xs font-semibold",
                      offer.listingStatus === "active"
                        ? "bg-success-muted text-success"
                        : "bg-warning-muted text-warning"
                    )}
                  >
                    {STATUS_LABEL[offer.listingStatus]}
                  </span>
                </div>
              </div>

              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted-foreground">Harga tercatat</dt>
                  <dd className="tabular font-semibold text-foreground sm:mt-0.5">
                    {offer.priceIdr === null
                      ? "Belum tercatat"
                      : formatIdr(offer.priceIdr)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted-foreground">Pemeriksaan berhasil</dt>
                  <dd
                    className={cn(
                      "font-medium sm:mt-0.5",
                      offer.isFreshPrice ? "text-success" : "text-warning"
                    )}
                  >
                    {offer.checkedAt
                      ? `${formatCheckedAt(offer.checkedAt, now)}${offer.isFreshPrice ? "" : ", sudah lama"}`
                      : "Belum pernah berhasil"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted-foreground">Kondisi</dt>
                  <dd className="font-medium text-foreground sm:mt-0.5">Baru</dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted-foreground">Garansi</dt>
                  <dd className="font-medium text-foreground sm:mt-0.5">
                    {offer.warranty ?? (
                      <span className="font-normal text-muted-foreground italic">
                        Belum diketahui
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              <a
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-pill bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/80"
              >
                Buka di {offer.marketplace}
                <HugeiconsIcon
                  icon={LinkSquare01Icon}
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="sr-only">(membuka tab baru)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
