import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";

import { DemoBadge } from "@/components/demo-marker";
import { formatCheckedAt, formatIdr } from "@/lib/catalog/pricing";
import type { ProductSummary } from "@/lib/catalog/queries";

/**
 * Visual hero: perangkat besar di atas bidang lingkaran abu lembut, dengan
 * panel harga/freshness kecil (PRD §8).
 *
 * Soal motion (PRD §8): "Hero/SVG boleh bergerak halus sekali; hindari loop,
 * parallax, glow, dan scroll hijacking." Animasinya karena itu memakai
 * `tw-animate-css` yang sudah terpasang bersama shadcn. Utilitasnya murni
 * opacity dan transform, dan `animation-iteration-count` default-nya 1 sehingga
 * animasi berjalan SEKALI lalu berhenti. Jangan menambahkan `repeat-*` atau animasi loop di sini.
 *
 * Durasi entrance dijaga di 300ms (rentang PRD 280–420ms) dan tundaannya dibuat
 * bertingkat supaya urutannya terbaca, bukan untuk memperlama.
 *
 * Garis tepi bodi perangkat memakai `.draw-outline` (didefinisikan di
 * globals.css): stroke-nya "menggambar diri sendiri" sekali dari kosong ke
 * penuh. Ini satu-satunya pola yang diambil dari riset katalog svg-animation
 * 21st.dev, ditulis ulang sebagai CSS murni (bukan Framer Motion) dan dibuat
 * sekali jalan, bukan loop, supaya tidak melanggar §8. Kebanyakan contoh di
 * katalog itu (glow melayang, gradient berputar, teks reveal per-kata) SENGAJA
 * tidak dipakai karena persis pola yang dilarang §8 atau terasa generik ala
 * template AI, bukan karena tidak ditemukan.
 *
 * SVG-nya dekoratif dan diberi aria-hidden: informasi yang sebenarnya ada di
 * panel harga, bukan di gambar. Ilustrasinya sengaja datar dan abstrak: isi
 * layar berupa balok abu, bukan angka karangan yang bisa disalahartikan sebagai
 * data nyata.
 */
export function HeroDevice({
  product,
  now,
  isDemo,
}: {
  /** `null` bila katalog kosong, visualnya tetap tampil tanpa panel harga. */
  product: ProductSummary | null;
  now: Date;
  isDemo: boolean;
}) {
  return (
    <div className="relative mx-auto flex w-full max-w-md items-center justify-center py-6">
      {/* Bidang lingkaran abu lembut */}
      <div
        aria-hidden
        className="animate-in fade-in zoom-in-95 absolute aspect-square w-[85%] rounded-full bg-muted duration-300"
      />

      {/* Perangkat, wrapper HTML yang dianimasikan, supaya transform tidak
          bergantung pada perilaku transform di dalam SVG. */}
      <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative delay-75 duration-300">
        <svg
          aria-hidden
          viewBox="0 0 280 560"
          className="h-104 w-auto sm:h-120"
          fill="none"
        >
          {/*
            Bodi perangkat. Isian (fill) muncul lewat fade wrapper di atas;
            garis tepinya (stroke) menggambar diri sendiri sekali jalan lewat
            .draw-outline, dimulai sedikit setelah bodi mulai terlihat supaya
            terbaca sebagai satu gerakan, bukan dua animasi terpisah.
          */}
          <rect
            x="20"
            y="10"
            width="240"
            height="540"
            rx="38"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1}
            className="draw-outline fill-card stroke-border-strong"
            strokeWidth="2"
            style={{ animationDelay: "260ms" }}
          />
          {/* Layar */}
          <rect
            x="32"
            y="22"
            width="216"
            height="516"
            rx="28"
            className="fill-background"
          />
          {/* Tombol samping */}
          <rect x="258" y="150" width="4" height="54" rx="2" className="fill-border-strong" />
          <rect x="258" y="220" width="4" height="34" rx="2" className="fill-border-strong" />

          {/* Isi layar, sengaja abstrak, muncul sedikit setelah perangkat */}
          <g className="animate-in fade-in fill-mode-both delay-200 duration-300">
            {/* Baris atas: wordmark dan tombol ikon */}
            <rect x="50" y="46" width="72" height="10" rx="5" className="fill-foreground/70" />
            <circle cx="222" cy="51" r="11" className="fill-muted" />

            {/* Kartu produk utama */}
            <rect
              x="50"
              y="80"
              width="180"
              height="196"
              rx="22"
              className="fill-card stroke-border"
              strokeWidth="2"
            />
            <rect x="66" y="96" width="148" height="104" rx="16" className="fill-muted" />
            {/* Glyph perangkat kecil di dalam kartu */}
            <rect
              x="126"
              y="112"
              width="28"
              height="72"
              rx="7"
              className="fill-card stroke-border-strong"
              strokeWidth="1.5"
            />
            <rect x="66" y="214" width="54" height="8" rx="4" className="fill-muted" />
            <rect x="66" y="232" width="42" height="12" rx="6" className="fill-foreground/80" />
            <rect x="150" y="232" width="64" height="12" rx="6" className="fill-foreground/80" />
            <rect x="66" y="254" width="96" height="8" rx="4" className="fill-success/60" />

            {/* Kartu kedua, terpotong di tepi bawah layar */}
            <rect
              x="50"
              y="292"
              width="180"
              height="160"
              rx="22"
              className="fill-card stroke-border"
              strokeWidth="2"
            />
            <rect x="66" y="308" width="148" height="88" rx="16" className="fill-muted" />
            <rect x="66" y="410" width="48" height="8" rx="4" className="fill-muted" />
            <rect x="66" y="428" width="38" height="12" rx="6" className="fill-foreground/80" />
            <rect x="158" y="428" width="56" height="12" rx="6" className="fill-foreground/80" />
          </g>
        </svg>
      </div>

      {/*
        Panel harga/freshness. Ini konten sungguhan dari lapisan data, bukan
        hiasan, karena itu tidak aria-hidden, dan tetap menyebut varian acuan
        serta waktu pemeriksaan sesuai PRD §7.
      */}
      {product ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both absolute right-0 bottom-2 delay-300 duration-300 sm:-right-2">
          <div className="w-56 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {product.brand}
              </p>
              {isDemo ? <DemoBadge /> : null}
            </div>
            <p className="mt-0.5 text-sm font-bold tracking-tight text-foreground">
              {product.model}
            </p>

            {product.price.status === "available" ? (
              <>
                <p className="tabular mt-2 text-lg font-extrabold tracking-tight text-foreground">
                  {formatIdr(product.price.priceIdr)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Varian {product.priceReferenceVariant}
                </p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-success">
                  <HugeiconsIcon
                    icon={Clock01Icon}
                    size={13}
                    strokeWidth={2}
                    aria-hidden
                  />
                  Diperiksa {formatCheckedAt(product.price.checkedAt, now)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Harga belum tersedia
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
