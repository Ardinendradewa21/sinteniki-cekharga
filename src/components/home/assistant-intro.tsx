import Link from "next/link";

import {
  AskAsNeededGlyph,
  CompromiseScaleGlyph,
  HonestEmptyGlyph,
  RequirementSplitGlyph,
  StatusPulse,
} from "@/components/illustrations/concept-glyphs";
import { StaggerItem, StaggerList } from "@/components/motion/reveal";
import { hasAiCredentials } from "@/lib/assistant/ai/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";

/**
 * Pengenalan asisten AI di beranda (PRD §4).
 *
 * Yang dijaga di sini:
 * - Menjelaskan cara kerjanya tanpa menjanjikan hasil (PRD FR-06).
 * - Membedakan syarat wajib dari preferensi, karena itu inti perilakunya.
 * - Menyatakan statusnya secara jujur dan sesuai kenyataan: aktif bila kunci
 *   model tersedia di server, dan terus terang bila tidak (PRD §4: fitur yang
 *   belum tersedia harus dinyatakan jelas, bukan dipalsukan).
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
  // Sama dengan penentu tampilan di /assistant: chat AI bila kunci model
  // tersedia, konsultasi bertahap bila tidak. Status di beranda wajib cocok
  // dengan yang benar-benar didapat pengunjung di halaman itu.
  const aiReady = hasAiCredentials();

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
              {aiReady ? "Asisten AI aktif" : "Asisten AI sedang tidak tersedia"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {aiReady
                ? "Ceritakan kebutuhanmu dengan bahasa sehari-hari. Kandidatnya tetap dipilih dari katalog, bukan dikarang AI."
                : "Kamu tetap bisa menjawab beberapa pertanyaan singkat dan mendapat kandidat dari katalog, tanpa percakapan AI."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/assistant">Tanya AI</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/products">Cari Produk</Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
