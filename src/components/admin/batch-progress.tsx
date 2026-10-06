"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { continueBatchAction } from "@/lib/import/batch-actions";
import {
  BATCH_STATUS_LABEL,
  isWorking,
  type BatchStatus,
  type Progress,
} from "@/lib/import/batch-status";
import type { BatchSummary } from "@/lib/import/batches";
import type { PhotoJobCounts } from "@/lib/import/photo-jobs";

/**
 * Progres penerapan batch dan antrean fotonya, sekaligus penggerak worker
 * selama halaman terbuka.
 *
 * Setiap putaran memanggil satu langkah worker di server (`continueBatchAction`),
 * lalu menunggu sebentar. Langkah berikutnya baru dipanggil setelah langkah
 * sebelumnya kembali, jadi tidak ada panggilan menumpuk. Menutup tab tidak
 * membatalkan apa pun: item dan foto yang belum diproses tetap menunggu dan
 * dilanjutkan worker terjadwal, atau saat halaman ini dibuka lagi.
 *
 * Yang ditampilkan adalah hitungan nyata dari database, bukan animasi palsu.
 */

const PAUSE_MS = 1500;

function photosActive(photos: PhotoJobCounts | null) {
  return Boolean(photos && photos.pending + photos.running > 0);
}

export function BatchProgress({
  batchId,
  initialStatus,
  initialProgress,
  initialPhotos,
  initialFollowUp,
}: {
  batchId: string;
  initialStatus: BatchStatus;
  initialProgress: Progress | null;
  initialPhotos: PhotoJobCounts | null;
  initialFollowUp: BatchSummary | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [photos, setPhotos] = useState(initialPhotos);
  const [followUp, setFollowUp] = useState(initialFollowUp);
  const [trouble, setTrouble] = useState(false);
  const active = isWorking(status) || photosActive(photos) || Boolean(followUp && isWorking(followUp.status));

  useEffect(() => {
    if (!active) return;
    // Setiap pemasangan efek punya putarannya sendiri dan membatalkannya saat
    // dibersihkan. (Penanda "sedang berjalan" bersama dulu membuat putaran
    // mati di StrictMode: putaran pertama dibatalkan, putaran kedua tidak
    // pernah mulai.) Putaran yang sempat tumpang tindih aman, karena klaim
    // lease di database hanya memberi satu worker per batch dan per foto.
    let cancelled = false;
    let lastStatus = status;

    (async () => {
      while (!cancelled) {
        try {
          const result = await continueBatchAction(batchId);
          if (cancelled || !result.batch) break;
          setTrouble(false);
          setProgress(result.batch.progress);
          setPhotos(result.photos);
          setFollowUp(result.followUp);
          if (result.batch.status !== lastStatus) {
            lastStatus = result.batch.status;
            setStatus(result.batch.status);
            // Status akhir: muat ulang supaya hasil per baris dan laporan tampil.
            if (!isWorking(result.batch.status)) router.refresh();
          }
          const followUpBusy = Boolean(result.followUp && isWorking(result.followUp.status));
          if (!isWorking(result.batch.status) && !photosActive(result.photos) && !followUpBusy) {
            router.refresh();
            break;
          }
        } catch {
          setTrouble(true);
        }
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      }
    })();

    return () => {
      cancelled = true;
    };
    // `status` sengaja tidak menjadi dependensi: putaran membaca status
    // terbarunya sendiri, dan efek hanya perlu dipasang ulang saat aktif berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, active, router]);

  const photoTotal = photos ? photos.pending + photos.running + photos.done + photos.failed + photos.skipped : 0;
  if (!progress && photoTotal === 0 && !followUp) return null;
  const finished = progress ? progress.done + progress.failed + progress.skipped : 0;
  const percent = progress && progress.total > 0 ? Math.round((finished / progress.total) * 100) : 0;
  const photoFinished = photos ? photos.done + photos.failed + photos.skipped : 0;

  return (
    <div className="mt-6 max-w-xl space-y-3 rounded-xl border border-border bg-card p-4" aria-live="polite">
      {progress ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-foreground">{BATCH_STATUS_LABEL[status]}</span>
            <span className="tabular text-muted-foreground">
              {finished} dari {progress.total} baris
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={finished}
            aria-label="Progres penerapan batch"
            className="h-2.5 overflow-hidden rounded-pill bg-muted"
          >
            <div
              className="h-full rounded-pill bg-brand transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress.done} berhasil · {progress.failed} gagal · {progress.skipped} dilewati
          </p>
        </div>
      ) : null}

      {followUp ? (
        <div className="space-y-1 border-t border-border pt-3 text-xs" data-testid="price-progress">
          <p className="text-sm font-semibold text-foreground">
            Harga resmi: {BATCH_STATUS_LABEL[followUp.status]}
            {followUp.progress
              ? ` · ${followUp.progress.done + followUp.progress.failed + followUp.progress.skipped} dari ${followUp.progress.total}`
              : ""}
          </p>
          <Link href={`/admin/import/batch/${followUp.id}`} className="text-brand underline underline-offset-2">
            Lihat hasil per harga
          </Link>
        </div>
      ) : null}

      {photos && photoTotal > 0 ? (
        <div className="space-y-1 border-t border-border pt-3 text-xs" data-testid="photo-progress">
          <p className="text-sm font-semibold text-foreground">
            Foto: {photoFinished} dari {photoTotal} selesai
          </p>
          <p className="text-muted-foreground">
            {photos.done} tersimpan · {photos.pending + photos.running} menunggu · {photos.failed} gagal
          </p>
          {photos.failed > 0 ? (
            <p className="text-warning">
              Foto yang gagal tidak menghalangi data produk. Alasannya terlihat di halaman sunting produk.
            </p>
          ) : null}
        </div>
      ) : null}

      {active ? (
        <p className="text-xs text-muted-foreground">
          Diproses bertahap. Boleh menutup halaman ini; prosesnya dilanjutkan otomatis dan bisa dipantau lagi nanti.
        </p>
      ) : null}
      {trouble ? (
        <p role="alert" className="text-xs text-warning">
          Koneksi ke server terputus sebentar. Mencoba lagi…
        </p>
      ) : null}
    </div>
  );
}
