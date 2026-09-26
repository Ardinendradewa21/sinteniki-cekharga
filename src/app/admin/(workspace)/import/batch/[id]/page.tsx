import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BatchReview } from "@/components/admin/batch-review";
import { OfferReportView, SpecReportView } from "@/components/admin/import-report-view";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/dal";
import { applyBatchAction, discardBatchAction } from "@/lib/import/batch-actions";
import { getBatch } from "@/lib/import/batches";
import type { ImportReport, OfferImportReport } from "@/lib/import/report";

export const metadata: Metadata = {
  title: "Pratinjau Impor",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_LABEL = { draft: "Menunggu ditinjau", applied: "Sudah diterapkan", discarded: "Dibatalkan" };
const STATUS_TONE = {
  draft: "bg-brand-muted text-brand",
  applied: "bg-success-muted text-success",
  discarded: "bg-muted text-muted-foreground",
};

function formatTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

/**
 * Pratinjau satu batch impor: hasil penyeragaman per baris, lalu admin memilih
 * baris yang diterapkan. Sebelum diterapkan tidak ada satu pun data katalog
 * yang berubah.
 */
export default async function ImportBatchPage(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;
  const batch = await getBatch(id);
  if (!batch) notFound();

  const kindLabel = batch.kind === "specs" ? "Spesifikasi produk" : "Penawaran dan harga";
  const report = batch.report;
  const pendingOffers = batch.options.followUpOffers?.rows.length ?? 0;

  return (
    <Container className="py-10">
      <nav aria-label="Remah roti" className="mb-4">
        <Link
          href="/admin/import"
          className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Kembali ke Pusat Impor
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">
            {batch.origin === "scrape" ? "Tarik otomatis" : "Unggah CSV"} · {kindLabel}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight break-all text-foreground">
            {batch.sourceLabel}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dibuat {formatTime(batch.createdAt)}
            {batch.createdByEmail ? ` oleh ${batch.createdByEmail}` : ""}
            {batch.appliedAt ? ` · diterapkan ${formatTime(batch.appliedAt)}` : ""}
          </p>
        </div>
        <span className={`rounded-pill px-3 py-1.5 text-sm font-semibold ${STATUS_TONE[batch.status]}`}>
          {STATUS_LABEL[batch.status]}
        </span>
      </header>

      {batch.status === "draft" ? (
        <p className="mt-6 max-w-prose rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
          Belum ada data katalog yang berubah. Tinjau tabel di bawah: baris{" "}
          <strong>Baru</strong> dan <strong>Berubah</strong> sudah terpilih, baris{" "}
          <strong>Sama</strong> bisa dipilih untuk memajukan waktu pemeriksaan, dan
          baris <strong>Dilewati</strong> menyebut alasannya. Saat diterapkan,
          pencocokan dihitung ulang terhadap data terkini.
          {batch.kind === "specs" ? " Produk baru selalu masuk sebagai draft." : ""}
          {pendingOffers > 0
            ? ` Setelah diterapkan, ${pendingOffers} harga resmi dari tarik otomatis dibuatkan pratinjau terpisah.`
            : ""}
        </p>
      ) : null}

      {batch.malformedLines.length > 0 ? (
        <p className="mt-4 text-sm text-warning">
          {batch.malformedLines.length} baris berkas diabaikan karena jumlah kolomnya tidak cocok
          header (baris {batch.malformedLines.slice(0, 10).join(", ")}
          {batch.malformedLines.length > 10 ? ", dan seterusnya" : ""}).
        </p>
      ) : null}

      {report?.summary ? (
        <div className="mt-6 space-y-3">
          {batch.kind === "specs" ? (
            <SpecReportView summary={(report as ImportReport).summary!} />
          ) : (
            <OfferReportView summary={(report as OfferImportReport).summary!} />
          )}
          {batch.followUpBatchId ? (
            <Button asChild>
              <Link href={`/admin/import/batch/${batch.followUpBatchId}`}>
                Tinjau pratinjau harga resmi
              </Link>
            </Button>
          ) : null}
        </div>
      ) : report?.error ? (
        <p role="alert" className="mt-6 text-sm font-medium text-destructive">
          Penerapan terakhir gagal: {report.error}
        </p>
      ) : null}

      <section aria-labelledby="baris-batch" className="mt-8">
        <h2 id="baris-batch" className="mb-4 text-lg font-bold text-foreground">
          Hasil penyeragaman per baris
        </h2>
        <BatchReview
          items={batch.items}
          editable={batch.status === "draft"}
          applyAction={applyBatchAction.bind(null, batch.id)}
        />
      </section>

      {batch.status === "draft" ? (
        <form action={discardBatchAction.bind(null, batch.id)} className="mt-6">
          <Button type="submit" variant="ghost">
            Batalkan batch ini
          </Button>
        </form>
      ) : null}
    </Container>
  );
}
