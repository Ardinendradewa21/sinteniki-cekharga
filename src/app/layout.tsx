import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { MotionProvider } from "@/components/motion/motion-provider";
import { siteUrl } from "@/lib/site-url";

import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // URL absolut untuk Open Graph/canonical hanya bila domain produksi sudah
  // ditetapkan (SITE_URL); tidak ada domain yang dikarang.
  metadataBase: siteUrl() ?? undefined,
  openGraph: {
    type: "website",
    siteName: "CekHarga",
    locale: "id_ID",
  },
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
          Tanpa jaring pengaman <noscript> untuk animasi: sejak VD-02 komponen
          reveal (src/components/motion/use-reveal.ts) tidak lagi merender
          state tersembunyi di HTML server. Elemen hanya disembunyikan oleh
          JavaScript sesaat sebelum dimunculkan, jadi tanpa JavaScript isinya
          tetap terlihat.
        */}
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
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
