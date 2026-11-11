import { AdBand } from "@/components/ads/ad-slot";
import { DataUnavailable } from "@/components/data-error";
import { AssistantIntro } from "@/components/home/assistant-intro";
import { ComparisonPreview } from "@/components/home/comparison-preview";
import { Hero } from "@/components/home/hero";
import { buildHeroTour } from "@/components/home/hero-tour-data";
import { Needs } from "@/components/home/needs";
import { ProductShowcase } from "@/components/home/product-showcase";
import { TransparencyTeaser } from "@/components/home/transparency-teaser";
import {
  getComparisonExample,
  isDemoData,
  listProductSummaries,
} from "@/lib/catalog/queries";
import { loadOrNull } from "@/lib/catalog/load";
import { qualifyingNeedPages } from "@/lib/catalog/need-page-data";
import { pickComparisonPair, pickHeroProduct } from "@/lib/catalog/showcase";

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
 * Susunannya mengikuti §4: hero dan CTA, contoh cara memilih (tautan halaman kebutuhan), produk, contoh
 * perbandingan, pengenalan AI, lalu transparansi.
 *
 * Semua angka di halaman ini berasal dari lapisan data yang sama dengan halaman
 * lain, tidak ada harga, produk, atau perbandingan yang ditulis langsung di
 * markup.
 */

export default async function HomePage() {
  const now = new Date();
  const isDemo = isDemoData();

  const products = await loadOrNull(() => listProductSummaries(now));
  if (!products) return <DataUnavailable area="Beranda" />;

  // Dipilih dari katalog yang aktif (demo maupun live), bukan slug fixture
  // yang ditulis langsung; lihat src/lib/catalog/showcase.ts.
  const heroProduct = pickHeroProduct(products);
  const pair = pickComparisonPair(products);
  // Keduanya membaca dataset katalog yang sama (sudah di-cache), jadi paralel.
  const [comparison, needPages] = await Promise.all([
    pair ? loadOrNull(() => getComparisonExample(now, pair)) : null,
    loadOrNull(() => qualifyingNeedPages(now)),
  ]);
  const tour = buildHeroTour(products, comparison, heroProduct, now);

  return (
    <>
      <Hero tour={tour} isDemo={isDemo} />
      <AdBand code="home_top" />
      <Needs pages={needPages ?? []} />
      <ProductShowcase products={products} now={now} isDemo={isDemo} />
      <AdBand code="home_mid" />
      {comparison ? (
        <ComparisonPreview example={comparison} now={now} isDemo={isDemo} />
      ) : null}
      <AssistantIntro />
      <TransparencyTeaser product={heroProduct} now={now} isDemo={isDemo} />
    </>
  );
}
