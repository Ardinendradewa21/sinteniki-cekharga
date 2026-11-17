import type { StartingPriceResolution } from "@/lib/catalog/pricing";
import { formatCheckedAt, formatIdr } from "@/lib/catalog/pricing";
import { CountUp } from "@/components/motion/count-up";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";

/**
 * Semua penyajian harga ada di file ini supaya aturan PRD §7 ditegakkan di satu
 * tempat, apa pun bentuk tampilannya:
 *
 * - "Mulai dari" selalu menyebut varian acuannya (butir 3).
 * - Tanpa harga tercatat sama sekali → "Harga belum tersedia" (butir 5).
 * - Harga yang sudah melewati batas freshness TETAP ditampilkan sebagai angka
 *   utama (keputusan pemilik produk, 2026-09-21), tetapi selalu berlabel
 *   "Harga terakhir tercatat" beserta waktunya dan TIDAK pernah berlabel
 *   "Mulai dari". Ini tetap sesuai butir 5: harga lama boleh tampil sebagai
 *   "Harga terakhir tercatat", dan filter budget tetap tidak memakainya.
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
  if (price.status === "available" || price.status === "stale") {
    const fresh = price.status === "available";
    // Satu pohon elemen untuk harga segar maupun lama: CountUp tetap terpasang
    // saat pengguna berganti kapasitas, jadi angkanya bergulir dari harga lama
    // ke harga baru (DESIGN.md §8.4). Ganti warna tidak mengubah harga, jadi
    // tidak memicu apa pun. HTML server selalu berisi angka final.
    return (
      <div className={cn("flex flex-col items-start gap-1", className)}>
        <span className="text-xs text-muted-foreground">
          {fresh && showStartingLabel ? "Mulai dari" : "Harga"}
        </span>
        <CountUp value={price.priceIdr} className="text-2xl font-extrabold tracking-tight text-foreground" />
        {referenceVariant ? (
          <span className="text-xs text-muted-foreground">
            Untuk varian {referenceVariant}
          </span>
        ) : null}
        <StatusPill tone={fresh ? "fresh" : "stale"} className="mt-1">
          {fresh
            ? `Diperiksa ${formatCheckedAt(price.checkedAt, now)}`
            : `Harga terakhir tercatat · ${formatCheckedAt(price.observedAt, now)}`}
        </StatusPill>
        {fresh ? null : (
          <span className="text-xs text-muted-foreground">
            Belum diperiksa ulang, jadi harganya bisa sudah berubah. Cek harga akhir di marketplace sebelum membeli.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-base font-semibold text-foreground">
        Harga belum tersedia
      </span>
      <span className="text-xs text-muted-foreground">
        Belum ada penawaran tercatat yang memenuhi syarat dalam cakupan
        CekHarga.
      </span>
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
  // Harga terakhir tercatat tetap tampil sebagai angka; statusnya dijelaskan
  // `CardPriceMeta` tepat di bawahnya, jadi keduanya wajib dipasang bersama.
  if (price.status === "available" || price.status === "stale") {
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
  // Varian acuan di baris sendiri, waktu periksa sebagai Status Pill
  // (DESIGN.md §7, VD-05): titik + kata, tidak pernah warna saja.
  if (price.status === "available" || price.status === "stale") {
    const fresh = price.status === "available";
    return (
      <div className={cn("flex flex-col items-start gap-1 text-xs text-muted-foreground", className)}>
        {referenceVariant ? <p>Varian {referenceVariant}</p> : null}
        <StatusPill tone={fresh ? "fresh" : "stale"} className="px-2 py-0.5">
          {fresh
            ? `Diperiksa ${formatCheckedAt(price.checkedAt, now)}`
            : `Terakhir tercatat ${formatCheckedAt(price.observedAt, now)}`}
        </StatusPill>
      </div>
    );
  }

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Belum ada penawaran yang memenuhi syarat.
    </p>
  );
}
