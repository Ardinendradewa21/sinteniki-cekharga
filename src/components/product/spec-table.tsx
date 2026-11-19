import { SpecHint } from "@/components/product/spec-hint";
import type { ProductSpecRow } from "@/lib/catalog/queries";
import { specGuideFor } from "@/lib/catalog/spec-guide";

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
        {specs.map((spec) => {
          // RV-03: penjelasan (?) per baris, menggantikan panel panjang di bawah tabel.
          const guide = specGuideFor(spec.label);
          return (
          <div
            key={spec.label}
            className="flex items-center justify-between gap-4 px-5 py-3 text-[0.9375rem]"
          >
            <dt className="flex items-center gap-0.5 text-muted-foreground">
              {spec.label}
              {guide ? <SpecHint entry={guide} /> : null}
            </dt>
            <dd className="text-right font-medium text-foreground">
              {spec.value ?? (
                <span className="font-normal text-muted-foreground italic">
                  Belum diketahui
                </span>
              )}
            </dd>
          </div>
          );
        })}
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        Sumber spesifikasi: {source}. {knownCount} dari {specs.length} atribut
        sudah terisi; sisanya belum diverifikasi dan sengaja dibiarkan kosong.
      </p>
    </section>
  );
}
