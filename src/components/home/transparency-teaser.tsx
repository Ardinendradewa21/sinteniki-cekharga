import Link from "next/link";

import {
  LowestPriceGlyph,
  QualifiedOfferGlyph,
  ReviewSourceGlyph,
  StalePriceGlyph,
} from "@/components/illustrations/concept-glyphs";
import { Container } from "@/components/layout/container";
import { StaggerItem, StaggerList } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";

/**
 * Transparansi di beranda (PRD FR-08).
 *
 * Tujuannya supaya pengguna bisa membedakan data aktual, data demo, informasi
 * lama, pendapat reviewer, dan inferensi AI tanpa membaca kode. Yang di bawah
 * adalah pernyataan yang benar hari ini, jangan menambahkan klaim kemitraan,
 * afiliasi, atau cakupan marketplace yang belum ada.
 *
 * Tiap poin dipasangkan dengan diagram beranimasi yang menggambarkan aturannya:
 * penunjuk yang jatuh ke penawaran terendah, corong penyaring, jarum jam yang
 * berhenti, dan ringkasan yang membawa penandanya.
 */

const POINTS = [
  {
    Glyph: LowestPriceGlyph,
    term: "Arti “mulai dari”",
    detail:
      "Harga terendah dari penawaran tercatat yang memenuhi syarat dalam cakupan CekHarga. Bukan jaminan termurah di seluruh internet.",
  },
  {
    Glyph: QualifiedOfferGlyph,
    term: "Penawaran yang dihitung",
    detail:
      "Hanya kondisi baru, listing aktif, harga yang terlihat tanpa syarat akun. Voucher, cashback, dan kupon tidak ikut dihitung.",
  },
  {
    Glyph: StalePriceGlyph,
    term: "Kalau harga sudah lama",
    detail:
      "Harga kedaluwarsa tidak ditampilkan sebagai harga aktif. Yang muncul “Harga belum tersedia”, dengan harga terakhir tercatat terpisah.",
  },
  {
    Glyph: ReviewSourceGlyph,
    term: "Ulasan reviewer",
    detail:
      "Dikurasi manual dari channel pilihan, diringkas dengan atribusi dan konteks pengujian. Bukan kesimpulan yang ditarik dari angka spesifikasi.",
  },
];

export function TransparencyTeaser() {
  return (
    <section className="relative isolate py-14 md:py-20">
      {/* Blob gradient statis di belakang kartu putih; tidak menyentuh kontras teks. */}
      <div className="warmth-blob" />
      <Container>
        <div className="rounded-xl border border-border bg-card p-6 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                Supaya kamu tahu angkanya dari mana
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                CekHarga alat bantu keputusan, bukan marketplace. Setiap harga
                membawa varian acuan dan waktu pemeriksaannya, dan setiap
                keterbatasan dinyatakan.
              </p>
              <Button asChild className="mt-6">
                <Link href="/how-it-works">Baca cara kerjanya</Link>
              </Button>
            </div>

            <StaggerList as="dl" className="grid gap-6 sm:grid-cols-2">
              {POINTS.map(({ Glyph, term, detail }) => (
                <StaggerItem as="div" key={term}>
                  <Glyph />
                  <dt className="mt-3 text-sm font-bold text-foreground">
                    {term}
                  </dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {detail}
                  </dd>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        </div>
      </Container>
    </section>
  );
}
