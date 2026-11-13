import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";

import { DemoBadge } from "@/components/demo-marker";
import { Container } from "@/components/layout/container";
import { formatCheckedAt, formatIdr } from "@/lib/catalog/pricing";
import type { ProductSummary } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

/**
 * "Cara membaca harga" di beranda (PRD FR-08; Sprint 13 S13-2).
 *
 * Menunjukkan, bukan menjelaskan panjang: satu kartu harga ASLI dari katalog
 * (produk yang sama dengan hero) diberi empat penanda bernomor, dan daftar di
 * sebelahnya menjelaskan arti tiap penanda. Kalau katalog tidak punya harga
 * sama sekali, kartunya tidak ditampilkan dan hanya daftarnya yang tersisa,
 * supaya tidak ada angka contoh karangan.
 *
 * Batasan ditulis pendek dan sebagai fakta hari ini. Rinciannya (merek yang
 * belum masuk, kurasi reviewer) ada di /how-it-works#batasan. Hapus butir
 * begitu celahnya tertutup; analisisnya di
 * docs/bisnis/ANALISIS-PENDUKUNG-KEPUTUSAN-2026-10.md.
 */

const LIMITS = [
  "Belum semua model HP masuk",
  "Harga marketplace diperbarui berkala, belum otomatis",
  "Tidak menguji HP sendiri, kualitas nyata dari reviewer",
  "Belum ada notifikasi harga turun",
  "Belum menilai penjual dan HP bekas",
];

function Marker({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "tabular inline-flex size-5 shrink-0 items-center justify-center rounded-pill bg-brand text-xs font-bold text-brand-foreground",
        className
      )}
    >
      {n}
    </span>
  );
}

export function TransparencyTeaser({
  product,
  now,
  isDemo,
}: {
  product: ProductSummary | null;
  now: Date;
  isDemo: boolean;
}) {
  const price = product && product.price.status !== "unavailable" ? product.price : null;
  const variant = product?.priceReferenceVariant ?? null;

  const points = [
    {
      term: "Mulai dari",
      detail: "harga terendah yang kami catat, belum tentu termurah se-internet.",
    },
    {
      term: variant ? `Varian ${variant}` : "Varian acuan",
      detail: "harga berlaku untuk varian ini saja.",
    },
    {
      term:
        price?.status === "available"
          ? `Diperiksa ${formatCheckedAt(price.checkedAt, now)}`
          : "Waktu periksa",
      detail: "bukan real-time. Harga yang sudah lama disembunyikan.",
    },
    {
      term: "Tanpa potongan",
      detail: "voucher, cashback, kupon, dan harga yang butuh login tidak dihitung.",
    },
  ];

  return (
    <section aria-labelledby="harga-judul" className="relative isolate py-14 md:py-20">
      {/* Blob gradient statis di belakang kartu putih; tidak menyentuh kontras teks. */}
      <div className="warmth-blob" />
      <Container>
        <div className="rounded-xl border border-border bg-card p-6 md:p-10">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <h2 id="harga-judul" className="heading-section-lg text-foreground">
                Cara membaca harga di CekHarga
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Kami bukan toko. Ini arti setiap angka yang kamu lihat.
              </p>

              {product && price ? (
                <figure className="mt-6 max-w-sm rounded-xl border border-border bg-background p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{product.brand}</p>
                    {isDemo ? <DemoBadge /> : null}
                  </div>
                  <p className="mt-0.5 text-base font-bold tracking-tight text-foreground">
                    {product.model}
                  </p>

                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Marker n={1} />
                    {price.status === "available" ? "Mulai dari" : "Harga terakhir tercatat"}
                  </p>
                  <p className="tabular mt-1 text-2xl font-extrabold tracking-tight text-foreground">
                    {formatIdr(price.priceIdr)}
                  </p>

                  {variant ? (
                    <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                      <Marker n={2} />
                      Varian {variant}
                    </p>
                  ) : null}

                  <p
                    className={cn(
                      "mt-2 flex items-center gap-2 text-sm",
                      price.status === "available" ? "text-success" : "text-warning"
                    )}
                  >
                    <Marker n={3} />
                    <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={2} aria-hidden />
                    {price.status === "available"
                      ? `Diperiksa ${formatCheckedAt(price.checkedAt, now)}`
                      : `Tercatat ${formatCheckedAt(price.observedAt, now)}, belum diperiksa ulang`}
                  </p>

                  <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <Marker n={4} />
                    Tanpa voucher dan cashback
                  </p>
                  <figcaption className="sr-only">
                    Contoh kartu harga {product.name} dari katalog CekHarga
                  </figcaption>
                </figure>
              ) : null}
            </div>

            <ol className="flex flex-col gap-5">
              {points.map((point, index) => (
                <li key={point.term} className="flex gap-3">
                  <Marker n={index + 1} className="mt-0.5" />
                  <p className="text-base leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{point.term}</span>:{" "}
                    {point.detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-8 border-t border-border pt-6 md:mt-10">
            <h3 className="text-base font-bold text-foreground">Yang belum bisa</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {LIMITS.map((limit) => (
                <li
                  key={limit}
                  className="inline-flex items-center gap-2 rounded-pill border border-border bg-background px-3.5 py-2 text-sm text-foreground"
                >
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
                  {limit}
                </li>
              ))}
            </ul>
            <Link
              href="/how-it-works#batasan"
              className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-text underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Baca cara kerja lengkap
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
