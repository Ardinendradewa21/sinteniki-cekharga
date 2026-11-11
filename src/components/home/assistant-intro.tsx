import Link from "next/link";

import { Container } from "@/components/layout/container";
import { StatusDot } from "@/components/home/status-dot";
import { Button } from "@/components/ui/button";
import { hasAiCredentials } from "@/lib/assistant/ai/client";

/**
 * Ajakan memakai asisten di beranda (PRD §4, FR-06; Sprint 13 S13-1).
 *
 * Titik fokus section ini adalah kotak isian, karena tindakan yang diharapkan
 * memang bercerita ke asisten. Cara kerja asisten (bertanya seperlunya, syarat
 * wajib vs preferensi) diringkas menjadi satu baris jaminan; detailnya ada di
 * /how-it-works.
 *
 * Kotak isian hanya mengisi kolom chat di /assistant (`?pesan=`), tidak
 * mengirimnya. Model baru dipanggil setelah pengguna menekan kirim di sana
 * (aturan System Design 1).
 *
 * Status mengikuti penentu tampilan /assistant: tanpa kunci model, halaman itu
 * hanya punya jalur pertanyaan bertahap, jadi kotak isian bebas tidak
 * ditampilkan (kalimatnya tidak akan terbaca di sana).
 */

const STARTERS = [
  { label: "Budget 2,5 juta, buat medsos", href: "/assistant?tanya=form&budget=2500000&budget_wajib=ya&kegiatan=sosial-media" },
  { label: "4 juta, utamakan kamera", href: "/assistant?tanya=form&budget=4000000&budget_wajib=ya&kegiatan=foto" },
  { label: "7 juta, buat main game", href: "/assistant?tanya=form&budget=7000000&budget_wajib=ya&kegiatan=game" },
] as const;

export function AssistantIntro() {
  const aiReady = hasAiCredentials();

  return (
    <section aria-labelledby="asisten-judul" className="py-14 md:py-20">
      <Container>
        <div className="rounded-2xl border border-brand/20 bg-brand-muted/60 px-5 py-8 sm:px-10 md:py-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <StatusDot tone={aiReady ? "success" : "warning"} />
              {aiReady ? "Asisten AI aktif" : "Asisten AI sedang tidak tersedia"}
            </p>
            <h2 id="asisten-judul" className="heading-section-lg mt-3 text-foreground">
              Bingung pilih HP? Ceritakan saja.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Sebut budget dan dipakai untuk apa. Asisten mencarikan kandidat
              dari katalog CekHarga, lengkap dengan alasan dan komprominya.
            </p>

            {aiReady ? (
              <form
                action="/assistant"
                className="mt-7 flex flex-col gap-3 rounded-xl border border-border bg-card p-2 shadow-sm sm:flex-row sm:items-center"
              >
                <label htmlFor="asisten-pesan" className="sr-only">
                  Ceritakan HP yang kamu cari
                </label>
                <input
                  id="asisten-pesan"
                  name="pesan"
                  type="text"
                  required
                  maxLength={600}
                  autoComplete="off"
                  placeholder="Contoh: budget 4 juta, sering foto anak, baterai awet"
                  className="h-12 min-w-0 flex-1 rounded-lg bg-transparent px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button type="submit" size="lg" className="shrink-0">
                  Carikan HP
                </Button>
              </form>
            ) : (
              <p className="mt-7 text-sm leading-relaxed text-muted-foreground">
                Jawab beberapa pertanyaan singkat, hasilnya tetap dari katalog.
              </p>
            )}

            <ul aria-label="Contoh kebutuhan" className="mt-4 flex flex-wrap justify-center gap-2">
              {STARTERS.map((starter) => (
                <li key={starter.href}>
                  <Link
                    href={starter.href}
                    className="inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-4 text-sm text-foreground transition-colors duration-150 hover:border-brand/40 hover:bg-brand-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {starter.label}
                  </Link>
                </li>
              ))}
            </ul>

            {aiReady ? null : (
              <Button asChild size="lg" className="mt-6">
                <Link href="/assistant?tanya=form">Mulai pertanyaan</Link>
              </Button>
            )}

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Budget yang kamu tegaskan tidak dilanggar. Kalau tidak ada yang
              cocok, asisten bilang terus terang.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Lebih suka menyaring sendiri?{" "}
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                Buka katalog
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
