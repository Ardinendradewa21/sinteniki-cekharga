import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { DemoBadge, DemoNotice } from "@/components/demo-marker";
import { PriceDisplay } from "@/components/price-display";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product/product-gallery";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { isDemoData, listProductSummaries } from "@/lib/catalog/queries";

/**
 * Dirender per permintaan, bukan di-prerender saat build.
 *
 * Halaman ini membaca katalog, sementara sumber datanya (demo atau live)
 * ditentukan variabel environment saat RUNTIME. Kalau halaman ini statis,
 * HTML-nya membeku dengan isi apa pun yang aktif saat build: aplikasi yang
 * di-build dalam mode demo lalu dijalankan dalam mode live akan tetap
 * menyajikan fixture. PRD §9 melarang produksi menampilkan fixture diam-diam,
 * jadi kebenaran data didahulukan di atas keuntungan prerender.
 */
export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "Design system",
  description: "Halaman internal untuk meninjau token dan primitive CekHarga.",
  robots: { index: false, follow: false },
};

const COLOR_TOKENS = [
  { token: "background", cssVar: "--background", role: "Canvas halaman", light: "#F3F7F6", dark: "#071716" },
  { token: "card", cssVar: "--card", role: "Permukaan kartu", light: "#FFFFFF", dark: "#0F2422" },
  { token: "foreground", cssVar: "--foreground", role: "Headline & teks utama", light: "#102A2A", dark: "#E8F5F2" },
  { token: "muted-foreground", cssVar: "--muted-foreground", role: "Teks sekunder", light: "#536A67", dark: "#A8BFBA" },
  { token: "border", cssVar: "--border", role: "Garis dekoratif", light: "#D5E3E0", dark: "#294A46" },
  { token: "border-strong / input", cssVar: "--border-strong", role: "Batas kontrol form", light: "#6D827E", dark: "#728D88" },
  { token: "brand / ring", cssVar: "--brand", role: "Identitas dan fokus", light: "#0F766E", dark: "#5EEAD4" },
  { token: "accent-warm", cssVar: "--accent-warm", role: "Aksen hangat terbatas", light: "#D97757", dark: "#FB9C7B" },
  { token: "success", cssVar: "--success", role: "Status baik", light: "#147A3D", dark: "#6EE7A0" },
  { token: "warning", cssVar: "--warning", role: "Status perhatian", light: "#A94F08", dark: "#FBBF6A" },
  { token: "destructive", cssVar: "--destructive", role: "Status gagal", light: "#A9251C", dark: "#FDA29B" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-12 first:border-t-0">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function StyleGuidePage() {
  const now = new Date();
  const products = await listProductSummaries(now);
  const usingDemoData = isDemoData();

  // Satu contoh untuk tiap state harga, diambil dari data yang sama dengan grid
  // di atas supaya yang ditinjau benar-benar keluaran aturan §7.
  const priceStateExamples = (["available", "stale", "unavailable"] as const)
    .map((status) => products.find((product) => product.price.status === status))
    .filter((product) => product !== undefined);

  return (
    <Container className="py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          Design system CekHarga
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Halaman internal untuk meninjau token, primitive, dan state hasil
          Sprint FE-0. Tidak ditautkan dari navigasi karena bukan halaman untuk
          pengguna akhir.
        </p>
      </header>

      <Section
        title="Warna"
        description="Palet teal-navy CekHarga memakai semantic token. Swatch mengikuti tombol tema; nilai terang dan gelap dicatat sebagai referensi."
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLOR_TOKENS.map((color) => (
            <li
              key={color.token}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <span
                aria-hidden
                className="size-12 shrink-0 rounded-lg border border-border"
                style={{ backgroundColor: `var(${color.cssVar})` }}
              />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-foreground">{color.token}</p>
                <p className="text-muted-foreground">{color.role}</p>
                <p className="tabular text-xs text-muted-foreground">
                  Terang {color.light} · gelap {color.dark}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Tipografi"
        description="Plus Jakarta Sans. Headline tebal, harga mudah dipindai, panjang baris body dijaga nyaman."
      >
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <p className="text-5xl leading-[1.05] font-extrabold tracking-tight text-foreground md:text-6xl">
            Pilih yang cocok, pahami komprominya
          </p>
          <p className="text-xl font-bold text-foreground">Judul bagian</p>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Teks body dengan panjang baris nyaman. CekHarga adalah alat bantu
            keputusan, bukan marketplace; transaksi tetap dilakukan di
            marketplace tujuan.
          </p>
          <p className="tabular text-2xl font-extrabold text-foreground">
            Rp4.199.000
          </p>
        </div>
      </Section>

      <Section
        title="Tombol"
        description="Ukuran default, lg, dan icon sudah memenuhi target sentuh minimal 44px (PRD §8)."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button>Cari Produk</Button>
          <Button variant="outline">Tanya AI</Button>
          <Button variant="secondary">Sekunder</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="lg">Ukuran lg</Button>
          <Button disabled>Nonaktif</Button>
        </div>
      </Section>

      <Section
        title="Kontrol form"
        description="Tinggi 44px, teks 16px di semua breakpoint, dan batas kontrol memakai border-strong agar memenuhi 3:1."
      >
        <div className="grid max-w-xl gap-4">
          <div className="grid gap-2">
            <Label htmlFor="contoh-cari">Cari produk</Label>
            <Input id="contoh-cari" placeholder="Nama atau merek" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contoh-urut">Urutkan</Label>
            <Select>
              <SelectTrigger id="contoh-urut" className="w-full">
                <SelectValue placeholder="Pilih urutan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevansi pencarian</SelectItem>
                <SelectItem value="price-asc">Harga terendah</SelectItem>
                <SelectItem value="price-desc">Harga tertinggi</SelectItem>
                <SelectItem value="checked">Terakhir diperiksa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section title="Badge, skeleton, dan disclosure">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Sekunder</Badge>
            <Badge variant="outline">Outline</Badge>
            <DemoBadge />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Accordion type="single" collapsible className="lg:col-span-2">
            <AccordionItem value="filter">
              <AccordionTrigger>Filter (pola disclosure mobile)</AccordionTrigger>
              <AccordionContent>
                Dipakai untuk filter katalog di layar kecil pada Sprint FE-2.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </Section>

      <Section
        title="Galeri foto produk"
        description="Komponen galeri halaman detail: tombol geser selalu terlihat, swipe di area foto, panah kiri/kanan saat fokus, tanpa putar otomatis. Contoh ini sengaja memakai foto dari beberapa produk berbeda hanya untuk memperlihatkan perilaku komponen."
      >
        <div className="max-w-xl">
          <ProductGallery
            name="contoh komponen"
            fallback={{ src: "/images/generic-device.svg", alt: "Ilustrasi generik perangkat smartphone" }}
            photos={[
              ...new Map(
                products
                  .filter((product) => !product.image.isGenericIllustration)
                  .slice(0, 4)
                  .map((product) => [
                    product.image.src,
                    { src: product.image.src, alt: product.image.alt, source: "contoh" },
                  ])
              ).values(),
            ]}
          />
        </div>
      </Section>

      <Section
        title="Penanda data demo"
        description="PRD §9: setiap surface sintetis wajib diberi penanda yang jelas, dan statusnya disampaikan lewat kata, bukan warna saja."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <DemoNotice>
            Angka dan produk di halaman ini berasal dari fixture demo, bukan data
            pasar. Merek dan modelnya fiktif karena dataset asli belum tersedia.
          </DemoNotice>
        </div>
      </Section>

      <Section
        title="Lapisan data dan aturan harga"
        description="Bukti bahwa adapter server-only dan aturan PRD §7 benar-benar berjalan, termasuk state yang mudah salah ditangani."
      >
        {usingDemoData ? (
          <DemoNotice className="mb-6">
            Sumber data aktif: fixture demo. Ganti lewat konfigurasi server
            (CEKHARGA_DATA_SOURCE), bukan lewat fallback otomatis.
          </DemoNotice>
        ) : null}

        <ul className="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} now={now} isDemo={usingDemoData} />
            </li>
          ))}
        </ul>

        <h3 className="mt-10 text-base font-bold text-foreground">
          Harga versi halaman detail
        </h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Bentuk bertumpuk yang akan dipakai Sprint FE-3, menampilkan tiga state
          yang sama dari data yang sama.
        </p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {priceStateExamples.map((product) => (
            <li
              key={product.id}
              className="rounded-xl border border-border bg-card p-5"
            >
              <p className="mb-3 text-sm font-semibold text-foreground">
                {product.name}
              </p>
              <PriceDisplay
                price={product.price}
                referenceVariant={product.priceReferenceVariant}
                now={now}
              />
            </li>
          ))}
        </ul>
      </Section>
    </Container>
  );
}
