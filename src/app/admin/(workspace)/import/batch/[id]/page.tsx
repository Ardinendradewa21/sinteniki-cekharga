import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BatchReview } from "@/components/admin/batch-review";
import { OfferReportView, SpecReportView } from "@/components/admin/import-report-view";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import { BatchProgress } from "@/components/admin/batch-progress";
import { RetryFailedButton } from "@/components/admin/retry-failed-button";
import { UndoBatchPanel, type UndoSummary } from "@/components/admin/undo-batch-panel";
import { applyBatchAction, discardBatchAction, retryFailedAction, undoBatchAction } from "@/lib/import/batch-actions";
import { planUndo, type UndoPlan } from "@/lib/import/undo";
import {
  batchStatusView,
  DRAFT_TTL_DAYS,
  isEditable,
  isRetryable,
} from "@/lib/import/batch-status";
import { getBatch, getBatchSummary } from "@/lib/import/batches";
import { photoJobCounts } from "@/lib/import/photo-jobs";
import type { ImportReport, OfferImportReport } from "@/lib/import/report";

export const metadata: Metadata = {
  title: "Pratinjau Impor",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
/**
 * Batas waktu Server Action di halaman ini (Terapkan, polling langkah worker).
 * Satu langkah worker dibatasi jauh di bawah angka ini; sisa pekerjaan
 * dilanjutkan langkah berikutnya, bukan dipaksakan dalam satu request.
 */
export const maxDuration = 60;


/** Ringkasan undo batch ini plus batch harga resmi lanjutannya (satu keputusan admin). */
function undoSummary(plan: UndoPlan): UndoSummary {
  const parts = [plan, ...(plan.followUp && plan.followUp.allowed.ok ? [plan.followUp] : [])];
  return {
    removeProducts: parts.flatMap((p) => p.products.remove.map((d) => d.label)),
    keepProducts: parts.flatMap((p) =>
      p.products.keep.map((d) => ({ label: d.label, reason: "reason" in d ? d.reason : "" }))
    ),
    productsUpdated: parts.reduce((sum, p) => sum + p.products.updatedNotReverted, 0),
    removeOffers: parts.reduce((sum, p) => sum + p.offers.remove, 0),
    keepOffers: parts.reduce((sum, p) => sum + p.offers.keepTouched, 0),
    offersUpdated: parts.reduce((sum, p) => sum + p.offers.updatedNotReverted, 0),
    observations: parts.reduce((sum, p) => sum + p.observations, 0),
    checks: parts.reduce((sum, p) => sum + p.checks, 0),
    protectedPrices: parts.reduce((sum, p) => sum + p.protectedPrices, 0),
    removePhotos: parts.reduce((sum, p) => sum + p.photos.remove, 0),
    protectedPhotos: parts.reduce((sum, p) => sum + p.photos.protected, 0),
  };
}

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
  await requireStaff([]);
  const { id } = await props.params;
  const batch = await getBatch(id);
  if (!batch) notFound();

  const kindLabel = batch.kind === "specs" ? "Spesifikasi produk" : "Penawaran dan harga";
  const report = batch.report;
  const pendingOffers = batch.options.followUpOffers?.rows.length ?? 0;
  const statusView = batchStatusView(batch, new Date());
  // Draft kedaluwarsa hanya bisa dibaca; server juga menolak menerapkannya.
  const editable = isEditable(batch.status) && !statusView.expired;
  const failedCount = batch.items.filter((item) => item.selected && item.result === "failed").length;
  const photos = batch.status === "draft" ? null : await photoJobCounts({ batchId: batch.id });
  const undo = batch.status === "applied" || batch.status === "partial" ? await planUndo(batch.id) : null;
  const undone = (batch.report as { undo?: { products: number; offers: number; observations: number; by: string; at: string } } | null)?.undo;
  const followUp = batch.followUpBatchId ? await getBatchSummary(batch.followUpBatchId) : null;
  // Harga resmi per sumber (tarik otomatis), ditampilkan di baris produknya.
  const priceNotes: Record<string, string[]> = {};
  for (const row of batch.options.followUpOffers?.rows ?? []) {
    const key = row.source_key ?? "";
    const storage = Number(row.storage_gb) >= 1024 ? `${Number(row.storage_gb) / 1024} TB` : `${row.storage_gb} GB`;
    const price = `Rp${Number(row.price_idr).toLocaleString("id-ID")}`;
    (priceNotes[key] ??= []).push(`${row.ram_gb}/${storage} ${price}${row.listing_status === "out-of-stock" ? " (stok habis)" : ""}`);
  }

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
            {batch.origin === "scrape" ? "Tarik otomatis" : batch.origin === "schedule" ? "Pemeriksaan harga harian" : "Unggah CSV"} ·{" "}
            {kindLabel}
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
        <span className={`rounded-pill px-3 py-1.5 text-sm font-semibold ${statusView.tone}`}>
          {statusView.label}
        </span>
      </header>

      {(batch.progress || photos) && batch.status !== "draft" && batch.status !== "discarded" ? (
        // key: komponen dipasang ulang saat status dari server berubah (mis. setelah coba ulang).
        <BatchProgress
          key={batch.status}
          batchId={batch.id}
          initialStatus={batch.status}
          initialProgress={batch.progress}
          initialPhotos={photos}
          initialFollowUp={followUp}
        />
      ) : null}

      {isRetryable(batch.status) && failedCount > 0 ? (
        <div className="mt-6 max-w-prose space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-relaxed text-foreground">
          <p>
            {failedCount} baris gagal diterapkan; alasannya tertulis di tiap baris. Baris yang berhasil tidak
            disentuh lagi saat dicoba ulang.
          </p>
          <RetryFailedButton action={retryFailedAction.bind(null, batch.id)} failedCount={failedCount} />
        </div>
      ) : null}

      {statusView.expired ? (
        <p role="status" className="mt-6 max-w-prose rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
          Pratinjau ini berumur lebih dari {DRAFT_TTL_DAYS} hari, jadi pencocokannya sudah tidak mewakili katalog
          sekarang dan tidak bisa diterapkan. Buat pratinjau baru dari sumbernya.
        </p>
      ) : batch.status === "draft" ? (
        <p className="mt-6 max-w-prose rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
          Belum ada data katalog yang berubah. Tinjau tabel di bawah: baris{" "}
          <strong>Baru</strong> dan <strong>Berubah</strong> sudah terpilih, baris{" "}
          <strong>Sama</strong> bisa dipilih untuk memajukan waktu pemeriksaan, dan
          baris <strong>Dilewati</strong> menyebut alasannya. Saat diterapkan,
          pencocokan dihitung ulang terhadap data terkini.
          {batch.kind === "specs" ? " Produk baru selalu masuk sebagai draft." : ""}
          {pendingOffers > 0
            ? ` ${pendingOffers} harga resmi dari tarik otomatis tampil di baris produknya dan ikut diterapkan otomatis untuk produk yang dipilih.`
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

      {report?.error && batch.status !== "draft" ? (
        <p role="alert" className="mt-6 text-sm font-medium text-destructive">
          {report.error}
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
      ) : null}

      <section aria-labelledby="baris-batch" className="mt-8">
        <h2 id="baris-batch" className="mb-4 text-lg font-bold text-foreground">
          {editable ? "Hasil penyeragaman per baris" : "Hasil per baris"}
        </h2>
        <BatchReview
          items={batch.items}
          priceNotes={priceNotes}
          editable={editable}
          applyAction={applyBatchAction.bind(null, batch.id)}
        />
      </section>

      {batch.status === "reverted" && undone ? (
        <p role="status" className="mt-8 max-w-prose rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          Batch ini diurungkan oleh {undone.by} pada {formatTime(undone.at)}: {undone.products} produk, {undone.offers}{" "}
          penawaran, dan {undone.observations} catatan harga dihapus.
        </p>
      ) : null}

      {undo?.allowed.ok ? (
        <UndoBatchPanel summary={undoSummary(undo)} action={undoBatchAction.bind(null, batch.id)} />
      ) : null}

      {editable ? (
        <form action={discardBatchAction.bind(null, batch.id)} className="mt-6">
          <Button type="submit" variant="ghost">
            Batalkan batch ini
          </Button>
        </form>
      ) : null}
    </Container>
  );
}
