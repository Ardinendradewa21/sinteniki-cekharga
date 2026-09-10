import Link from "next/link";

import {
  AskAsNeededGlyph,
  CompromiseScaleGlyph,
  HonestEmptyGlyph,
  RequirementSplitGlyph,
  StatusPulse,
} from "@/components/illustrations/concept-glyphs";
import { StaggerItem, StaggerList } from "@/components/motion/reveal";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";

/**
 * Pengenalan asisten AI di beranda (PRD §4).
 *
 * Yang dijaga di sini:
 * - Menjelaskan cara kerjanya tanpa menjanjikan hasil (PRD FR-06).
 * - Membedakan syarat wajib dari preferensi, karena itu inti perilakunya.
 * - Menyatakan statusnya secara jujur: integrasi AI dikerjakan di track backend
 *   dan belum aktif, jadi tautannya tidak boleh terbaca seperti fitur siap
 *   pakai (PRD §4: fitur yang belum tersedia harus dinyatakan jelas).
 *
 * Tiap perilaku dipasangkan dengan diagram beranimasi yang menggambarkan
 * mekanismenya (lihat concept-glyphs.tsx), bukan ikon dekoratif: pertanyaan
 * yang datang bergiliran, jalur wajib vs preferensi, timbangan yang memang
 * miring, dan pencarian yang berhenti di hasil kosong.
 */

const BEHAVIOURS = [
  {
    Glyph: AskAsNeededGlyph,
    term: "Bertanya seperlunya",
    detail:
      "Hanya yang belum kamu sebutkan: budget, kegiatan utama, kebutuhan khusus, prioritas. Bukan kuesioner panjang sekaligus.",
  },
  {
    Glyph: RequirementSplitGlyph,
    term: "Memisahkan wajib dari preferensi",
    detail:
      "Budget maksimal yang kamu tegaskan tidak akan dilanggar. Hal yang sekadar lebih disukai boleh dikompromikan.",
  },
  {
    Glyph: CompromiseScaleGlyph,
    term: "Menyebut komprominya",
    detail:
      "Setiap kandidat datang dengan alasan cocok, apa yang dikorbankan, varian, dan sumber pendukungnya.",
  },
  {
    Glyph: HonestEmptyGlyph,
    term: "Mengaku kalau tidak ada",
    detail:
      "Kalau tidak ada yang cocok, kendalanya dijelaskan. Alternatif di luar budget diberi label, tidak diam-diam dianggap memenuhi syarat.",
  },
];

export function AssistantIntro() {
  return (
    <Section
      title="Kalau lebih mudah menjelaskan kebutuhan"
      description="Sebagian orang lebih nyaman bercerita daripada menyaring spesifikasi."
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <StaggerList
          as="dl"
          className="grid gap-x-8 gap-y-7 rounded-xl border border-border bg-card p-6 sm:grid-cols-2"
        >
          {BEHAVIOURS.map(({ Glyph, term, detail }) => (
            <StaggerItem as="div" key={term}>
              <Glyph />
              <dt className="mt-3 text-sm font-bold text-foreground">{term}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {detail}
              </dd>
            </StaggerItem>
          ))}
        </StaggerList>

        <div className="flex flex-col justify-between gap-5 rounded-xl border border-border bg-card p-6">
          <div>
            <p className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
              <StatusPulse />
              Asisten belum aktif
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Antarmukanya sedang dibangun dan integrasi AI-nya dikerjakan di
              sisi server. Sementara ini katalog tetap bisa dipakai penuh tanpa
              asisten.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/assistant">Lihat status asisten</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/products">Cari sendiri di katalog</Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
