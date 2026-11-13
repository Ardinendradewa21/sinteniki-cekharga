import type { Metadata } from "next";
import Image from "next/image";

import { Container } from "@/components/layout/container";
import { DemoBadge, DemoNotice } from "@/components/demo-marker";
import { StaggerItem, StaggerList } from "@/components/motion/reveal";
import { CollapseDemo, CountUpDemo, WrapDemo } from "@/components/style-guide/motion-demo";
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

/*
  Nilai warna sengaja tidak ditulis ulang di sini: swatch membaca token CSS
  langsung di dalam panel tema masing-masing, jadi halaman ini tidak bisa
  berbeda dari globals.css. Nilai dan rasio kontras ada di DESIGN.md §3.
*/
const TOKEN_GROUPS = [
  {
    title: "Permukaan",
    tokens: [
      { name: "background", role: "Canvas halaman" },
      { name: "card", role: "Data: harga, tabel, penawaran" },
      { name: "muted", role: "Isian lembut, hover" },
      { name: "secondary", role: "Tombol sekunder" },
      { name: "stage", role: "Panggung foto produk" },
    ],
  },
  {
    title: "Teks",
    tokens: [
      { name: "foreground", role: "Headline dan teks utama" },
      { name: "muted-foreground", role: "Teks sekunder" },
      { name: "brand-text", role: "Teks dan tautan hijau" },
      { name: "stage-foreground", role: "Teks di atas panggung" },
    ],
  },
  {
    title: "Aksen dan garis",
    tokens: [
      { name: "primary", role: "CTA utama" },
      { name: "brand", role: "Isian, garis, ikon" },
      { name: "brand-muted", role: "Chip aktif, sorotan beda" },
      { name: "ring", role: "Fokus keyboard" },
      { name: "border", role: "Garis dekoratif" },
      { name: "border-strong", role: "Batas kontrol form" },
    ],
  },
  {
    title: "Status",
    tokens: [
      { name: "success", role: "Harga segar" },
      { name: "warning", role: "Harga terakhir tercatat" },
      { name: "destructive", role: "Gagal" },
      { name: "scrim", role: "Latar redup panel" },
    ],
  },
] as const;

const THEMES = [
  { value: "light", label: "Verdant Day" },
  { value: "dark", label: "Verdant Night" },
] as const;

/**
 * Satu panel = satu tema. `.public-theme[data-theme]` bersarang menimpa token
 * untuk isi panel saja, jadi kedua tema tampil berdampingan apa pun tema
 * halaman. Isi panel tidak memakai varian `dark:` karena varian itu mengikuti
 * tema halaman, bukan panel.
 */
function ThemePanels({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {THEMES.map((theme) => (
        <div
          key={theme.value}
          data-theme={theme.value}
          className="public-theme rounded-xl border border-border bg-background p-4 text-foreground sm:p-5"
        >
          <p className="heading-label">{theme.label}</p>
          <div className="mt-4">{children}</div>
        </div>
      ))}
    </div>
  );
}

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
      <h2 className="heading-section text-foreground">
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
  const stagePhoto =
    products.find((product) => !product.image.isGenericIllustration)?.image ?? {
      src: "/images/generic-device.svg",
      alt: "Ilustrasi generik perangkat smartphone",
    };

  return (
    <Container className="py-12">
      <header className="max-w-2xl">
        <h1 className="heading-page text-foreground">
          Design system CekHarga
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Halaman internal untuk meninjau token tema Verdant, primitive, dan
          state data. Tidak ditautkan dari navigasi karena bukan halaman untuk
          pengguna akhir. Aturan lengkap ada di DESIGN.md.
        </p>
      </header>

      <Section
        title="Token warna"
        description="Kedua tema tampil berdampingan dan membaca token langsung dari globals.css. Nilai hex dan rasio kontras dicatat di DESIGN.md bagian 3."
      >
        <ThemePanels>
          <div className="grid gap-5">
            {TOKEN_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-sm font-semibold">{group.title}</p>
                <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {group.tokens.map((token) => (
                    <li key={token.name} className="flex min-w-0 items-center gap-2 rounded-md bg-card p-2">
                      <span
                        aria-hidden
                        className="size-9 shrink-0 rounded-sm border border-border-strong/40"
                        style={{ backgroundColor: `var(--${token.name})` }}
                      />
                      <span className="min-w-0 text-xs leading-4">
                        <span className="block truncate font-semibold text-card-foreground">{token.name}</span>
                        <span className="block text-muted-foreground">{token.role}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ThemePanels>
      </Section>

      <Section
        title="Kaca"
        description="Kaca hanya untuk bingkai, tidak pernah di bawah harga atau tabel. Papan di belakang panel memakai warna tergelap dan terterang tema sebagai kondisi terburuk, jadi teks di glass-text harus tetap terbaca di atas kedua sisi."
      >
        <ThemePanels>
          <div className="relative overflow-hidden rounded-xl">
            <div aria-hidden className="grid h-64 grid-cols-3 sm:h-44">
              <span className="bg-foreground" />
              <span className="bg-primary" />
              <span className="bg-card" />
            </div>
            <div className="absolute inset-x-3 top-3 grid gap-2 sm:grid-cols-2">
              <div className="glass grid min-h-20 place-items-start rounded-lg p-3">
                {/* Teks tidak boleh langsung di atas `glass`; label di pil solid. */}
                <span className="rounded-pill bg-card px-2 py-0.5 text-xs font-semibold text-card-foreground">
                  glass: bingkai tanpa teks
                </span>
              </div>
              <div className="glass-text glass-float rounded-lg p-3">
                <p className="text-xs font-semibold">glass-text + glass-float</p>
                <p className="mt-1 text-xs text-muted-foreground">Header, filter bar, compare tray</p>
                <p className="mt-1 text-xs font-semibold text-brand-text">Tautan hijau</p>
              </div>
            </div>
          </div>
        </ThemePanels>
      </Section>

      <Section
        title="Panggung foto, bayangan, dan radius"
        description="Panggung tetap terang di tema gelap karena foto resmi berlatar putih; label yang menempel ke foto memakai pil solid sendiri, bukan teks tema di atas panggung. Bayangan menandai elevasi: sm untuk kartu, default untuk panel, lg untuk elemen melayang."
      >
        <ThemePanels>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl bg-card p-3 shadow-sm">
              <div className="stage relative aspect-square overflow-hidden rounded-lg">
                <Image
                  src={stagePhoto.src}
                  alt={stagePhoto.alt}
                  fill
                  sizes="(min-width: 1024px) 220px, 45vw"
                  className="object-contain p-4"
                />
                <span className="absolute bottom-2 left-2 rounded-pill bg-card px-2 py-0.5 text-xs font-semibold text-card-foreground">
                  Foto 1 dari 4
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-card-foreground">Kartu solid + stage</p>
            </div>
            <div className="grid content-start gap-3">
              {(["shadow-sm", "shadow", "shadow-lg"] as const).map((shadow) => (
                <div key={shadow} className={`rounded-lg bg-card p-3 text-xs font-semibold text-card-foreground ${shadow}`}>
                  {shadow}
                </div>
              ))}
              <div className="flex flex-wrap items-end gap-2" aria-label="Skala radius">
                {(["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-pill"] as const).map((radius) => (
                  <span
                    key={radius}
                    className={`grid size-16 place-items-center border border-border-strong bg-card text-xs text-card-foreground ${radius}`}
                  >
                    {radius.replace("rounded-", "")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </ThemePanels>
      </Section>

      <Section
        title="Motion"
        description="Preset di src/lib/motion.ts (DESIGN.md bagian 8). CountUp hanya bergulir saat nilai berubah, dari angka lama ke angka baru; render pertama selalu angka akhir. SegmentedControl adalah radio group: Tab masuk ke pilihan aktif, panah memindahkan pilihan. Dengan reduced motion semuanya berganti seketika."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <CountUpDemo />
          <div className="grid content-start gap-6">
            <WrapDemo />
            <CollapseDemo />
          </div>
        </div>
        <p className="mt-8 text-sm font-semibold text-foreground">Stagger saat masuk layar</p>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Hanya elemen di bawah lipatan pertama yang dianimasikan; jeda 50ms per item dan item ke-9 dan
          seterusnya tidak menunggu lebih lama.
        </p>
        <StaggerList className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => (
            <StaggerItem key={index} className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
              Item {index + 1}
            </StaggerItem>
          ))}
        </StaggerList>
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
          <Button>Cari produk</Button>
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

        <h3 className="mt-10 heading-card text-foreground">
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
