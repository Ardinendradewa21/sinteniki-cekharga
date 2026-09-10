import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";

import type { StartingPriceResolution } from "@/lib/catalog/pricing";
import { formatCheckedAt, formatIdr } from "@/lib/catalog/pricing";
import { cn } from "@/lib/utils";

/**
 * Semua penyajian harga ada di file ini supaya aturan PRD §7 ditegakkan di satu
 * tempat, apa pun bentuk tampilannya:
 *
 * - "Mulai dari" selalu menyebut varian acuannya (butir 3).
 * - Tanpa penawaran layak → "Harga belum tersedia" (butir 5).
 * - Harga kedaluwarsa TIDAK pernah tampil sebagai harga aktif; hanya muncul
 *   terpisah sebagai "Harga terakhir tercatat" (butir 5).
 * - Yang ditampilkan adalah waktu pemeriksaan BERHASIL terakhir (butir 6).
 *
 * `now` selalu diberikan pemanggil supaya label waktunya deterministik.
 *
 * Dua bentuk tersedia:
 * - `PriceDisplay`: bertumpuk, untuk halaman detail.
 * - `CardPriceValue` + `CardPriceMeta`: ringkas, untuk kartu katalog.
 */

export function PriceDisplay({
  price,
  referenceVariant,
  now,
  showStartingLabel = true,
  className,
}: {
  price: StartingPriceResolution;
  referenceVariant?: string | null;
  now: Date;
  /** Aktif untuk kartu katalog ("mulai dari"), nonaktif untuk varian terpilih. */
  showStartingLabel?: boolean;
  className?: string;
}) {
  if (price.status === "available") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {showStartingLabel ? (
          <span className="text-xs text-muted-foreground">Mulai dari</span>
        ) : null}
        <span className="tabular text-2xl font-extrabold tracking-tight text-foreground">
          {formatIdr(price.priceIdr)}
        </span>
        {referenceVariant ? (
          <span className="text-xs text-muted-foreground">
            Untuk varian {referenceVariant}
          </span>
        ) : null}
        <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-success">
          <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={2} aria-hidden />
          Diperiksa {formatCheckedAt(price.checkedAt, now)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-base font-semibold text-foreground">
        Harga belum tersedia
      </span>
      {price.status === "stale" ? (
        <>
          <span className="text-xs text-muted-foreground">
            Tidak ada penawaran yang cukup baru untuk dijadikan harga aktif.
          </span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-warning">
            <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={2} aria-hidden />
            Harga terakhir tercatat {formatIdr(price.priceIdr)} ·{" "}
            {formatCheckedAt(price.observedAt, now)}
          </span>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">
          Belum ada penawaran tercatat yang memenuhi syarat dalam cakupan
          CekHarga.
        </span>
      )}
    </div>
  );
}

/** Angka harga untuk baris judul kartu katalog. */
export function CardPriceValue({
  price,
  className,
}: {
  price: StartingPriceResolution;
  className?: string;
}) {
  if (price.status === "available") {
    return (
      <span
        className={cn(
          "tabular shrink-0 text-base font-extrabold tracking-tight text-foreground",
          className
        )}
      >
        {formatIdr(price.priceIdr)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "shrink-0 text-sm font-semibold text-muted-foreground",
        className
      )}
    >
      Harga belum tersedia
    </span>
  );
}

/**
 * Baris keterangan di bawah harga kartu. Inilah yang memenuhi kewajiban
 * menyebut varian acuan dan waktu pemeriksaan, jadi jangan dihilangkan dari
 * kartu yang menampilkan harga.
 */
export function CardPriceMeta({
  price,
  referenceVariant,
  now,
  className,
}: {
  price: StartingPriceResolution;
  referenceVariant?: string | null;
  now: Date;
  className?: string;
}) {
  if (price.status === "available") {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {referenceVariant ? <>Varian {referenceVariant} · </> : null}
        <span className="text-success">
          diperiksa {formatCheckedAt(price.checkedAt, now)}
        </span>
      </p>
    );
  }

  if (price.status === "stale") {
    return (
      <p className={cn("text-xs text-warning", className)}>
        Harga terakhir tercatat {formatIdr(price.priceIdr)}
        {referenceVariant ? ` untuk varian ${referenceVariant}` : ""} ·{" "}
        {formatCheckedAt(price.observedAt, now)}
      </p>
    );
  }

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Belum ada penawaran yang memenuhi syarat.
    </p>
  );
}
