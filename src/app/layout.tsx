import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MotionProvider } from "@/components/motion/motion-provider";

import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CekHarga, bantu pilih smartphone sesuai kebutuhan",
    template: "%s · CekHarga",
  },
  description:
    "CekHarga membantu memahami pilihan smartphone, komprominya, dan di mana penawarannya bisa dilihat. Pembelian tetap dilakukan di marketplace tujuan.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${plusJakartaSans.variable} h-full`}>
      {/*
        suppressHydrationWarning khusus untuk <body>.

        Ekstensi browser (ColorZilla menambahkan `cz-shortcut-listen`, Grammarly
        dan sejenisnya menambahkan atributnya sendiri) menyuntikkan atribut ke
        <body> sebelum React hydrate, sehingga HTML server dan DOM client berbeda
        tanpa ada yang salah di kode kita.

        Efeknya hanya satu level: atribut dan teks milik <body> sendiri, BUKAN
        anak-anaknya. Jadi hydration mismatch yang benar-benar berasal dari
        komponen kita tetap dilaporkan. Jangan naikkan ini ke elemen lain hanya
        untuk mendiamkan error; selidiki dulu penyebabnya.
      */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {/*
          Jaring pengaman tanpa JavaScript.

          Motion merender state awalnya ikut ke HTML server (opacity 0,
          stroke belum tergambar). Kalau bundel JS gagal dimuat atau
          dimatikan, elemen ber-`data-reveal` akan tetap tak terlihat
          selamanya. Aturan di bawah mengembalikannya menjadi terlihat penuh:
          animasi hilang, isinya tetap terbaca. Ini bukan optimasi, melainkan
          syarat supaya penambahan animasi tidak mengurangi apa yang bisa
          dibaca orang.
        */}
        <noscript>
          <style>{`[data-reveal],[data-reveal] *{opacity:1!important;transform:none!important;stroke-dasharray:none!important;stroke-dashoffset:0!important}`}</style>
        </noscript>
        <a
          href="#konten-utama"
          /*
            Ukuran eksplisit saat difokus. Terukur di QA browser: dengan hanya
            `not-sr-only`, tautan ini muncul setinggi 20px karena sr-only sudah
            mengunci padding dan ukurannya. Tautan lewati-konten yang mungil
            justru sulit dikenai, padahal ia ada untuk mempermudah.
          */
          className="sr-only rounded-lg bg-primary text-sm font-semibold text-primary-foreground focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:flex focus-visible:h-11 focus-visible:w-auto focus-visible:items-center focus-visible:px-4"
        >
          Lewati ke konten utama
        </a>
        {/*
          MotionProvider hanya menyediakan context kebijakan motion; anak-anaknya
          tetap Server Component seperti sebelumnya.
        */}
        <MotionProvider>
          <SiteHeader />
          <main id="konten-utama" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </MotionProvider>
      </body>
    </html>
  );
}
