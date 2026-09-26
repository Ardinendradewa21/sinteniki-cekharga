import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  SmartPhone01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons";

import { HeroDevice } from "@/components/home/hero-device";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import type { ProductSummary } from "@/lib/catalog/queries";

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

export function Hero({
  product,
  now,
  isDemo,
}: {
  product: ProductSummary | null;
  now: Date;
  isDemo: boolean;
}) {
  return (
    <section className="relative isolate pt-10 pb-4 md:pt-16">
      {/* Blob gradient statis: kehangatan warna tanpa animasi dan tanpa menyentuh kontras teks. */}
      <div className="warmth-blob" />
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
                <Link href="/products">Cari Produk</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/assistant">Tanya AI</Link>
              </Button>
            </div>
          </div>

          <div className="animate-in fade-in fill-mode-both delay-100 duration-300">
            <HeroDevice product={product} now={now} isDemo={isDemo} />
          </div>
        </div>

        <ul className="mt-10 grid gap-6 border-t border-border pt-8 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border md:mt-14">
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
