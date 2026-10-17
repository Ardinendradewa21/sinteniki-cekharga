import Link from "next/link";

import { cn } from "@/lib/utils";

type Stage = {
  key: string;
  label: string;
  detail: string;
  href: string | null;
  current: boolean;
};

const KIND_LABEL = { specs: "Produk", offers: "Harga", photos: "Foto" } as const;

/**
 * Tahapan satu unggahan CSV gabungan (Sprint 8): produk, lalu harga, lalu
 * foto. Setiap tahap adalah batch pratinjau sendiri yang ditinjau terpisah;
 * komponen ini membuat rangkaiannya terlihat dan bisa diikuti.
 */
export function ImportStages({
  kind,
  parentBatchId,
  offers,
  photos,
}: {
  kind: keyof typeof KIND_LABEL;
  parentBatchId: string | null;
  offers: { batchId: string | null; pending: number };
  photos: { batchId: string | null; pending: number };
}) {
  const stages: Stage[] = [];
  if (parentBatchId) {
    stages.push({ key: "induk", label: "Tahap sebelumnya", detail: "Buka batch asal berkas ini", href: `/admin/import/batch/${parentBatchId}`, current: false });
  }
  stages.push({ key: "ini", label: KIND_LABEL[kind], detail: "Tahap yang sedang ditinjau", href: null, current: true });
  if (offers.batchId || offers.pending > 0) {
    stages.push({
      key: "harga",
      label: "Harga",
      detail: offers.batchId ? "Pratinjau siap ditinjau" : `${offers.pending} penawaran, dibuat setelah tahap ini diterapkan`,
      href: offers.batchId ? `/admin/import/batch/${offers.batchId}` : null,
      current: false,
    });
  }
  if (photos.batchId || photos.pending > 0) {
    stages.push({
      key: "foto",
      label: "Foto",
      detail: photos.batchId ? "Pratinjau siap ditinjau" : `${photos.pending} foto, dibuat setelah tahap ini diterapkan`,
      href: photos.batchId ? `/admin/import/batch/${photos.batchId}` : null,
      current: false,
    });
  }
  if (stages.length < 2) return null;

  return (
    <nav aria-label="Tahapan berkas" className="mt-6">
      <ol className="flex flex-wrap gap-2">
        {stages.map((stage, index) => {
          const body = (
            <>
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {stage.key === "induk" ? "←" : `${index + (parentBatchId ? 0 : 1)}.`} {stage.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{stage.detail}</span>
            </>
          );
          const className = cn(
            "block min-h-11 min-w-44 rounded-xl border px-3 py-2",
            stage.current ? "border-brand bg-brand-muted/40" : "border-border bg-card",
            stage.href && "transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
          );
          return (
            <li key={stage.key} aria-current={stage.current ? "step" : undefined}>
              {stage.href ? (
                <Link href={stage.href} className={className}>
                  {body}
                </Link>
              ) : (
                <div className={className}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
