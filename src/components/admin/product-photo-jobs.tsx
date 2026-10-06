import { RetryPhotosButton } from "@/components/admin/retry-photos-button";
import type { ProductPhotoJob } from "@/lib/import/photo-jobs";

/**
 * Antrean foto satu produk di halaman sunting: foto yang masih diproses atau
 * gagal beserta alasannya. Tidak tampil bila semua foto sudah selesai.
 */

const KIND_LABEL: Record<ProductPhotoJob["kind"], string> = {
  primary: "Foto utama",
  gallery: "Foto galeri",
  reprocess: "Proses ulang",
};

const STATUS_LABEL: Partial<Record<ProductPhotoJob["status"], string>> = {
  pending: "Menunggu diproses",
  running: "Sedang diproses",
  failed: "Gagal",
};

export function ProductPhotoJobs({ productId, jobs }: { productId: string; jobs: ProductPhotoJob[] }) {
  if (jobs.length === 0) return null;
  const failed = jobs.filter((job) => job.status === "failed").length;

  return (
    <section aria-labelledby="antrean-foto" className="rounded-xl border border-border bg-card p-5">
      <h2 id="antrean-foto" className="text-base font-bold text-foreground">
        Antrean foto
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Foto diunduh dan dibersihkan latarnya secara terpisah dari data produk.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {jobs.map((job) => (
          <li key={job.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-foreground">{KIND_LABEL[job.kind]}</span>
              <a
                href={job.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-w-md truncate text-xs text-brand underline underline-offset-2"
              >
                {job.imageUrl}
              </a>
              {job.lastError ? <span className="block text-xs text-destructive">{job.lastError}</span> : null}
            </span>
            <span
              className={
                job.status === "failed"
                  ? "rounded-pill bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive"
                  : "rounded-pill bg-warning-muted px-2.5 py-0.5 text-xs font-semibold text-warning"
              }
            >
              {STATUS_LABEL[job.status] ?? job.status}
              {job.status === "failed" ? ` (${job.attempts}x)` : ""}
            </span>
          </li>
        ))}
      </ul>
      {failed > 0 ? (
        <div className="mt-4">
          <RetryPhotosButton productId={productId} />
        </div>
      ) : null}
    </section>
  );
}
