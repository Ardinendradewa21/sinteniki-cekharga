import Link from "next/link";

import type { ImportQuality } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

/**
 * Kualitas data hasil impor: hal yang menunggu tindakan admin. Angka nol
 * ditampilkan netral; angka di atas nol diberi warna perhatian, bukan merah,
 * karena semuanya bisa ditindaklanjuti, bukan kerusakan.
 */
export function ImportQualityPanel({ quality }: { quality: ImportQuality }) {
  const rows = [
    {
      label: "Batch impor menunggu ditinjau",
      value: quality.pendingBatches,
      hint: "Belum ada yang ditulis ke katalog sebelum diterapkan.",
      href: "/admin/import",
    },
    {
      label: "Penawaran tanpa toko terdaftar",
      value: quality.offersWithoutStore,
      hint: "Domain listingnya belum ada di tabel toko, jadi logo dan jenis tokonya tidak diketahui.",
      href: null,
    },
    {
      label: "Foto tanpa bukti hak pakai",
      value: quality.photosWithoutProof,
      hint: `Dari ${quality.totalPhotos} foto, dasar haknya hanya pernyataan admin. Lengkapi bukti izin atau lisensinya (PRD §6).`,
      href: null,
    },
    {
      label: "Pemeriksaan harga gagal (7 hari)",
      value: quality.failedChecks7d,
      hint: "Varian yang tidak lagi tercantum berharga di situs resmi saat tarik otomatis.",
      href: null,
    },
  ];

  return (
    <section aria-labelledby="kualitas-impor" className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 id="kualitas-impor" className="text-lg font-bold text-foreground">
        Kualitas data impor
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => {
          const content = (
            <>
              <p className="text-sm font-semibold text-foreground">{row.label}</p>
              <p
                className={cn(
                  "mt-1 text-2xl font-extrabold tabular",
                  row.value > 0 ? "text-warning" : "text-muted-foreground"
                )}
              >
                {row.value}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.hint}</p>
            </>
          );
          return row.href ? (
            <Link
              key={row.label}
              href={row.href}
              className="block rounded-xl border border-border p-4 transition-colors hover:border-brand/40 hover:bg-brand-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div>{content}</div>
            </Link>
          ) : (
            <div key={row.label} className="rounded-xl border border-border p-4">
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
