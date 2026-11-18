import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import type { SpecGuideEntry } from "@/lib/catalog/spec-guide";
import { cn } from "@/lib/utils";

/**
 * "Apa artinya?": penjelasan atribut spesifikasi dari bank materi
 * (`spec-guide.ts`). Dipakai per bagian di halaman perbandingan dan di bawah
 * tabel spesifikasi detail produk.
 *
 * `<details>` bawaan: jalan tanpa JavaScript, bisa dibuka dengan keyboard,
 * dan status terbuka/tertutup diumumkan pembaca layar. Isinya teks di
 * permukaan solid (`bg-card`), bukan di atas kaca.
 */
export function SpecGuideDisclosure({
  entries,
  className,
  summary = "Apa artinya?",
}: {
  entries: readonly SpecGuideEntry[];
  className?: string;
  summary?: string;
}) {
  if (entries.length === 0) return null;
  return (
    <details className={cn("group rounded-xl border border-border bg-card", className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 font-semibold text-brand-text">{summary}</span>
        <span className="min-w-0 truncate text-muted-foreground">{entries.map((entry) => entry.label).join(", ")}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          className="ml-auto shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <div className="grid gap-x-8 gap-y-5 border-t border-border px-4 py-4 md:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.label} className="min-w-0">
            <p className="font-semibold text-foreground">{entry.label}</p>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-foreground">{entry.what}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-brand">
              {entry.reality.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {entry.reference ? <p className="mt-2 text-xs text-muted-foreground">Rujukan: {entry.reference}</p> : null}
          </div>
        ))}
      </div>
    </details>
  );
}
