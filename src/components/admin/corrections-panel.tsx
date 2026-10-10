import { Badge } from "@/components/ui/badge";
import type { CorrectionSummary } from "@/lib/import/corrections";
import type { Correction } from "@/lib/import/normalize";

/**
 * Catatan koreksi otomatis templat terpadu (langkah 3 impor terpadu). Admin
 * melihat apa yang diubah sistem sebelum menerapkan: koreksi pasti (info),
 * konflik antarbaris (peringatan), dan baris yang dilewati (galat).
 */
const LEVEL = {
  info: { label: "Dikoreksi", variant: "muted" },
  warning: { label: "Konflik", variant: "warning" },
  error: { label: "Dilewati", variant: "destructive" },
} as const;

export function CorrectionsPanel({ items, summary }: { items: Correction[]; summary: CorrectionSummary }) {
  if (summary.total === 0) return null;
  const ordered = [...items].sort(
    (a, b) => ["error", "warning", "info"].indexOf(a.level) - ["error", "warning", "info"].indexOf(b.level) || a.line - b.line
  );
  return (
    <section aria-labelledby="koreksi-otomatis" className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 id="koreksi-otomatis" className="text-base font-bold text-foreground">
        Koreksi otomatis
      </h2>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
        {summary.info} nilai dirapikan, {summary.warning} konflik antarbaris, dan {summary.error} baris dilewati.
        Hanya koreksi yang hasilnya pasti yang dilakukan otomatis; nilai yang tidak pasti tidak ditebak.
      </p>
      <details className="mt-3" open={summary.error + summary.warning > 0}>
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-foreground">
          Lihat rincian
          {summary.total > items.length ? ` (${items.length} dari ${summary.total} catatan)` : ""}
        </summary>
        <ul className="mt-2 divide-y divide-border text-sm">
          {ordered.map((item, index) => (
            <li key={`${item.line}-${item.column}-${index}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
              <Badge variant={LEVEL[item.level].variant}>{LEVEL[item.level].label}</Badge>
              <span className="font-medium text-foreground">
                Baris {item.line}
                {item.column !== "-" ? ` · ${item.column}` : ""}
              </span>
              <span className="min-w-0 flex-1 text-muted-foreground">
                {item.from || item.to ? (
                  <>
                    <span className="font-mono text-foreground">{item.from || "(kosong)"}</span>
                    {item.to ? (
                      <>
                        {" → "}
                        <span className="font-mono text-foreground">{item.to}</span>
                      </>
                    ) : null}
                    {". "}
                  </>
                ) : null}
                {item.note}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
