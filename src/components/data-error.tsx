"use client";

import Link from "next/link";
import { catchError, type ErrorInfo } from "next/error";

import { Button } from "@/components/ui/button";

/**
 * Batas error tingkat komponen untuk bagian yang bergantung pada data.
 *
 * Kenapa ini perlu padahal sudah ada `app/error.tsx`: bagian data berada di
 * dalam `<Suspense>`. Ketika kerangka halaman sudah terlanjur dikirim dan
 * pengambilan datanya baru kemudian gagal, batas error tingkat rute tidak
 * menggantikan isi yang sedang mengalir, sehingga pengguna tertinggal menatap
 * skeleton yang tidak akan pernah selesai. Skeleton yang tidak mewakili proses
 * apa pun justru yang dilarang PRD §8, dan PRD §13 menuntut adanya state error.
 *
 * `catchError` dipakai karena ia paham cara kerja Next.js: `redirect()` dan
 * `notFound()` yang secara internal juga melempar tidak ikut tertangkap, dan
 * `retry()` mengambil ulang Server Component-nya, bukan sekadar membersihkan
 * state klien.
 *
 * Pesan teknis sengaja TIDAK ditampilkan (PRD §10 meminta ringkasan error yang
 * aman), dan tidak ada data lama atau data contoh yang dipakai sebagai
 * pengganti (PRD §9 melarang fallback diam-diam ke fixture).
 */
function DataErrorFallback(
  props: { area?: string },
  { error, retry }: ErrorInfo
) {
  // `error` bertipe unknown, jadi digest hanya dibaca setelah bentuknya dicek.
  const digest =
    error instanceof Error && "digest" in error
      ? String((error as Error & { digest?: unknown }).digest ?? "")
      : "";

  return (
    <div
      role="alert"
      className="rounded-xl border border-border bg-card p-6"
    >
      <p className="text-sm font-semibold text-warning">Gagal memuat data</p>
      <h2 className="mt-1 text-base font-bold text-foreground">
        {props.area ?? "Bagian ini"} tidak bisa ditampilkan sekarang
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Sumber datanya sedang tidak bisa dihubungi. Kami tidak menampilkan angka
        lama atau data contoh sebagai gantinya, supaya kamu tidak melihat harga
        yang tidak bisa kami pastikan.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="button" onClick={() => retry()}>
          Coba lagi
        </Button>
        <Button asChild variant="outline">
          <Link href="/how-it-works">Kenapa ini bisa terjadi</Link>
        </Button>
      </div>
      {digest ? (
        <p className="tabular mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          Kode kejadian: {digest}
        </p>
      ) : null}
    </div>
  );
}

export const DataErrorBoundary = catchError(DataErrorFallback);

/**
 * Panel kegagalan yang dirender di SERVER.
 *
 * Kenapa ini perlu padahal sudah ada DataErrorBoundary?
 *
 * Karena keduanya menangani momen yang berbeda. Saat sebuah Server Component di
 * dalam <Suspense> melempar error, React membatalkan SSR bagian itu dan
 * mengirim fallback-nya; UI error baru muncul setelah hydration. Akibatnya
 * pengunjung tanpa JavaScript hanya melihat skeleton yang tidak pernah selesai,
 * dan skeleton semacam itu berbohong: ia menyiratkan data sedang dimuat padahal
 * pemuatannya sudah gagal.
 *
 * Jadi kegagalan sumber data yang MEMANG DIPERKIRAKAN ditangani di sini,
 * terender penuh di HTML server. DataErrorBoundary tetap dipasang sebagai jaring
 * untuk error yang tidak diperkirakan.
 *
 * Tidak ada pesan teknis yang ditampilkan: penyebabnya urusan operator lewat
 * /api/health dan log server, bukan urusan pengunjung.
 */
export function DataUnavailable({ area }: { area?: string }) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-card p-6">
      <p className="text-sm font-semibold text-warning">Gagal memuat data</p>
      <h2 className="mt-1 text-base font-bold text-foreground">
        {area ?? "Bagian ini"} tidak bisa ditampilkan sekarang
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Sumber datanya sedang tidak bisa dihubungi. Kami tidak menampilkan angka
        lama atau data contoh sebagai gantinya, supaya kamu tidak melihat harga
        yang tidak bisa kami pastikan.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/">Kembali ke beranda</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/how-it-works">Kenapa ini bisa terjadi</Link>
        </Button>
      </div>
    </div>
  );
}
