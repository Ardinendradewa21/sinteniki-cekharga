import Link from "next/link";

import { Container } from "@/components/layout/container";
import { StatusDot } from "@/components/home/status-dot";
import { Button } from "@/components/ui/button";
import { hasAiCredentials } from "@/lib/assistant/ai/client";
import { ACTIVITY_LABELS } from "@/lib/assistant/needs-options";

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

/*
  Quick Start (DESIGN.md §7, pola "quick send"): budget dan kegiatan dipilih
  dengan chip, lalu formulir GET mengisi langkah yang sama di /assistant
  (`budget`, `kegiatan`). Tetap berfungsi tanpa JavaScript.

  Sengaja TIDAK mengirim `budget_wajib`: PRD FR-06 meminta asisten bertanya
  bila belum jelas apakah budget adalah syarat wajib, jadi pertanyaan itu
  diajukan di /assistant, bukan diputuskan diam-diam oleh chip. "Lainnya"
  mengirim budget kosong (dibaca null), lalu asisten menanyakan angkanya.
*/
const BUDGETS = [
  { value: "2000000", label: "2 juta" },
  { value: "3000000", label: "3 juta" },
  { value: "5000000", label: "5 juta" },
  { value: "", label: "Lainnya" },
] as const;

const ACTIVITY_CHIPS = (["sosial-media", "foto", "game", "kerja", "baterai"] as const).map((value) => ({
  value,
  label: ACTIVITY_LABELS[value],
}));

/** Chip pilihan: input asli disembunyikan, label yang tampil; fokus dan status terpilih ikut input. */
const CHIP =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-pill border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition-colors duration-150 select-none hover:bg-muted has-checked:border-brand has-checked:bg-brand-muted has-checked:font-semibold has-focus-visible:ring-2 has-focus-visible:ring-ring";

export function AssistantIntro() {
  const aiReady = hasAiCredentials();

  return (
    <section aria-labelledby="asisten-judul" className="py-14 md:py-20">
      <Container>
        <div className="rounded-xl border border-border bg-card px-5 py-8 shadow-sm sm:px-10 md:py-12">
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
                className="mt-7 flex flex-col gap-3 rounded-lg border border-border-strong bg-background p-2 sm:flex-row sm:items-center"
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
                  className="h-12 min-w-0 flex-1 rounded-md bg-transparent px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button type="submit" size="lg" className="shrink-0">
                  Carikan HP
                </Button>
              </form>
            ) : null}
          </div>

          <form action="/assistant" aria-labelledby="mulai-cepat-judul" className="mx-auto mt-8 max-w-2xl border-t border-border pt-6">
            <input type="hidden" name="tanya" value="form" />
            <h3 id="mulai-cepat-judul" className="heading-card text-center text-foreground">
              {aiReady ? "Atau mulai dari pilihan cepat" : "Mulai dari pilihan cepat"}
            </h3>

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-foreground">Budget sampai</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {/* Tanpa pilihan bawaan: tidak memilihkan angka untuk pengguna. */}
                {BUDGETS.map((budget) => (
                  <label key={budget.label} className={CHIP}>
                    <input type="radio" name="budget" value={budget.value} className="sr-only" />
                    {budget.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-foreground">Dipakai untuk (boleh lebih dari satu)</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {ACTIVITY_CHIPS.map((activity) => (
                  <label key={activity.value} className={CHIP}>
                    <input type="checkbox" name="kegiatan" value={activity.value} className="sr-only" />
                    {activity.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Asisten tetap menanyakan apakah budget ini batas wajib.
              </p>
              <Button type="submit" size="lg" variant={aiReady ? "outline" : "default"} className="w-full shrink-0 sm:w-auto">
                Lanjut ke asisten
              </Button>
            </div>
          </form>

          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
            Budget yang kamu tegaskan tidak dilanggar. Kalau tidak ada yang
            cocok, asisten bilang terus terang. Lebih suka menyaring sendiri?{" "}
            <Link
              href="/products"
              className="inline-flex min-h-11 items-center font-semibold text-brand-text underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Buka katalog
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
