import { DataUnavailable } from "@/components/data-error";
import { AssistantIntro } from "@/components/home/assistant-intro";
import { ComparisonPreview } from "@/components/home/comparison-preview";
import { Hero } from "@/components/home/hero";
import { Needs } from "@/components/home/needs";
import { ProductShowcase } from "@/components/home/product-showcase";
import { TransparencyTeaser } from "@/components/home/transparency-teaser";
import {
  getComparisonExample,
  isDemoData,
  listProductSummaries,
} from "@/lib/catalog/queries";
import { loadOrNull } from "@/lib/catalog/load";

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


/**
 * Beranda (PRD FR-01 dan §4).
 *
 * Susunannya mengikuti §4: hero dan CTA, contoh cara memilih, produk, contoh
 * perbandingan, pengenalan AI, lalu transparansi.
 *
 * Semua angka di halaman ini berasal dari lapisan data yang sama dengan halaman
 * lain, tidak ada harga, produk, atau perbandingan yang ditulis langsung di
 * markup.
 */

/** Produk yang dipakai panel harga di hero. */
const HERO_PRODUCT_SLUG = "volt-arc-3";

/** Dua kandidat untuk contoh perbandingan. */
const COMPARISON_SLUGS = ["nusa-aksa-5", "volt-arc-3"] as const;

export default async function HomePage() {
  const now = new Date();
  const isDemo = isDemoData();

  const products = await loadOrNull(() => listProductSummaries(now));
  const comparison = await loadOrNull(() =>
    getComparisonExample(now, COMPARISON_SLUGS)
  );
  if (!products) return <DataUnavailable area="Beranda" />;

  const heroProduct =
    products.find((product) => product.slug === HERO_PRODUCT_SLUG) ??
    products.find((product) => product.price.status === "available") ??
    products[0] ??
    null;

  return (
    <>
      <Hero product={heroProduct} now={now} isDemo={isDemo} />
      <Needs />
      <ProductShowcase products={products} now={now} isDemo={isDemo} />
      {comparison ? (
        <ComparisonPreview example={comparison} now={now} isDemo={isDemo} />
      ) : null}
      <AssistantIntro />
      <TransparencyTeaser />
    </>
  );
}
