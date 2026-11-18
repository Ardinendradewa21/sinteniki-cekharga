import { SpecGuideDisclosure } from "@/components/product/spec-guide-disclosure";
import type { ProductSpecRow } from "@/lib/catalog/queries";
import { specGuidesFor } from "@/lib/catalog/spec-guide";

/**
 * Spesifikasi terstruktur (PRD FR-03).
 *
 * Dua hal yang sengaja dijaga:
 *
 * - Nilai yang tidak diketahui ditulis "Belum diketahui", bukan dihilangkan
 *   dari tabel dan bukan diisi tebakan. Baris yang hilang membuat pembaca
 *   mengira datanya tidak relevan; nol membuatnya mengira nilainya nol.
 * - Sumber spesifikasi dicantumkan. PRD FR-03 meminta spesifikasi faktual
 *   dibedakan dari pengalaman reviewer, jadi bagian ini menyebut asal datanya
 *   dan tidak mencampurkan opini apa pun.
 */
export function SpecTable({
  specs,
  source,
}: {
  specs: ProductSpecRow[];
  source: string;
}) {
  const knownCount = specs.filter((spec) => spec.value !== null).length;

  return (
    <section>
      <h2 className="heading-section text-foreground">
        Spesifikasi
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Data faktual perangkat. Bagian ini tidak memuat penilaian atau
        pengalaman pemakaian.
      </p>

      <dl className="mt-5 divide-y divide-border rounded-xl border border-border bg-card">
        {specs.map((spec) => (
          <div
            key={spec.label}
            className="flex items-baseline justify-between gap-4 px-5 py-3 text-[0.9375rem]"
          >
            <dt className="text-muted-foreground">{spec.label}</dt>
            <dd className="text-right font-medium text-foreground">
              {spec.value ?? (
                <span className="font-normal text-muted-foreground italic">
                  Belum diketahui
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {/* Penjelasan atribut yang terisi (bank materi, keputusan PO 18 Nov 2026). */}
      <SpecGuideDisclosure
        className="mt-3"
        summary="Apa arti spesifikasi ini?"
        entries={specGuidesFor(specs.filter((spec) => spec.value !== null).map((spec) => spec.label))}
      />

      <p className="mt-3 text-xs text-muted-foreground">
        Sumber spesifikasi: {source}. {knownCount} dari {specs.length} atribut
        sudah terisi; sisanya belum diverifikasi dan sengaja dibiarkan kosong.
      </p>
    </section>
  );
}
