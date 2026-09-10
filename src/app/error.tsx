"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

/**
 * Batas error tingkat rute (PRD §13 menuntut state error tersedia).
 *
 * Ini juga pasangan yang hilang dari keputusan di PRD §9: "Produksi tidak boleh
 * diam-diam fallback ke fixture saat API gagal." Adapter sumber data memang
 * sengaja melempar error ketika sumber nyata belum siap atau gagal; halaman
 * inilah yang memastikan kegagalan itu muncul sebagai keadaan yang jujur dan
 * bisa dicoba ulang, bukan sebagai layar putih.
 *
 * Pesan teknis TIDAK ditampilkan ke pengguna. PRD §10 meminta ringkasan error
 * yang aman, jadi yang tampil hanya penjelasan singkat dan `digest`, yaitu
 * pengenal yang bisa dicocokkan dengan log server tanpa membocorkan isi error.
 *
 * Next.js 16 memberi prop `retry`, yang mengambil ulang dan merender ulang
 * Server Component. Ini berbeda dari `reset` di versi sebelumnya yang hanya
 * membersihkan state klien dan tidak bisa memulihkan kegagalan di server.
 */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Detailnya tetap dicatat di konsol untuk pengembang, tidak ke layar.
    console.error(error);
  }, [error]);

  return (
    <Container className="py-16 md:py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-warning">Terjadi gangguan</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          Bagian ini gagal dimuat
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Data yang dibutuhkan halaman ini tidak bisa diambil. Ini masalah di
          sisi kami, bukan kesalahanmu. Tidak ada data lama atau data contoh yang
          kami tampilkan sebagai penggantinya, supaya kamu tidak melihat angka
          yang tidak bisa kami pastikan.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" onClick={() => retry()}>
            Coba lagi
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
        </div>

        {error.digest ? (
          <p className="tabular mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
            Kode kejadian: {error.digest}. Sebutkan kode ini kalau kamu
            melaporkan masalahnya.
          </p>
        ) : null}
      </div>
    </Container>
  );
}
