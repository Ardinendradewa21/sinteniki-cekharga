import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  SmartPhone01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons";

import { HeroTour } from "@/components/home/hero-tour";
import type { HeroTourData } from "@/components/home/hero-tour-data";
import { Container } from "@/components/layout/container";
import { SceneBackdrop } from "@/components/layout/scene-backdrop";
import { Button } from "@/components/ui/button";

/**
 * Hero beranda (PRD FR-01).
 *
 * Copy-nya menjelaskan manfaat, bukan ajakan belanja, dan tiga fakta yang
 * diwajibkan PRD dinyatakan langsung di hero: harga terikat varian, harga
 * diperiksa berkala (bukan real-time), dan pembelian terjadi di marketplace.
 * Fakta-fakta itu bagian dari janji produk, jadi jangan dihapus saat menata
 * ulang tampilan.
 *
 * Catatan gaya: tulis kalimat pendek dan selesai. Hindari tanda pisah panjang
 * untuk menyisipkan anak kalimat; pecah jadi dua kalimat saja.
 */

const HERO_FACTS = [
  {
    icon: SmartPhone01Icon,
    title: "Harga terikat varian",
    body: "Setiap harga menyebut RAM dan penyimpanan yang jadi acuannya.",
  },
  {
    icon: Clock01Icon,
    title: "Diperiksa berkala",
    body: "Bukan real-time. Waktu pemeriksaan berhasil terakhir selalu ditampilkan.",
  },
  {
    icon: Store01Icon,
    title: "Beli di marketplace",
    body: "CekHarga tidak memproses transaksi dan tidak menentukan harga akhir.",
  },
];

export function Hero({ tour, isDemo }: { tour: HeroTourData; isDemo: boolean }) {
  return (
    <section className="pb-4">
      {/*
        Scene penuh (DESIGN.md §6.2) hanya di belakang copy dan panel, ditarik
        ke atas setinggi Glass Header supaya foto juga tampak di belakang
        kapsulnya. Copy berada di zona --veil-text (kiri di desktop, atas di
        HP); panel harga di HeroTour tetap kartu solid. Strip fakta di bawahnya
        sengaja di luar foto.
      */}
      <div className="relative isolate -mt-(--header-h) pt-[calc(var(--header-h)+2.5rem)] pb-12 md:pt-[calc(var(--header-h)+4rem)] md:pb-16">
        <SceneBackdrop variant="full" textZone="left" />
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <p className="inline-flex items-center rounded-pill border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground">
                Versi awal, baru mencakup smartphone kondisi baru
              </p>

              <h1 className="mt-6 text-4xl leading-[1.08] font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Pilih HP yang cocok, lengkap dengan komprominya.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Spesifikasi, pengalaman reviewer, dan harga tercatat dalam satu
                tempat. Lihat apa yang kamu dapat, dan apa yang dikorbankan.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/products">Cari produk</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/assistant">Tanya AI</Link>
                </Button>
              </div>
            </div>

            {/* Bingkai kaca berteks: tab dan keterangan tur berada di atas foto
                latar, jadi butuh permukaan yang lolos 4.5:1 pada foto terburuk
                (DESIGN.md §2.4). Kartu harga di dalamnya tetap solid. Ditata
                ulang menjadi Hero Price Panel di VD-04. */}
            <div className="glass-text animate-in fade-in fill-mode-both rounded-xl p-3 delay-100 duration-300 sm:p-4">
              <HeroTour data={tour} isDemo={isDemo} />
            </div>
          </div>
        </Container>
      </div>

      <Container>
        <ul className="grid gap-6 border-t border-border pt-8 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
          {HERO_FACTS.map((fact) => (
            <li
              key={fact.title}
              className="flex gap-3 sm:px-6 sm:first:pl-0 sm:last:pr-0"
            >
              <HugeiconsIcon
                icon={fact.icon}
                size={20}
                strokeWidth={1.8}
                className="mt-0.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {fact.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {fact.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
