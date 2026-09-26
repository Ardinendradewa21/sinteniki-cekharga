import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons";

import type {
  AdminImportRun,
  AdminProductOverviewRow,
} from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? dateTimeFormatter.format(date)
    : "Waktu tidak tercatat";
}

type ProductIssue = {
  label: string;
  severity: number;
};

function issuesFor(product: AdminProductOverviewRow): ProductIssue[] {
  const issues: ProductIssue[] = [];

  if (product.variantCount === 0) {
    issues.push({ label: "Tanpa varian", severity: 5 });
  }
  if (product.offerCount === 0) {
    issues.push({ label: "Tanpa penawaran", severity: 4 });
  } else if (product.priceStatus === "missing") {
    issues.push({ label: "Harga belum tercatat", severity: 4 });
  } else if (product.priceStatus === "stale") {
    issues.push({ label: "Harga kedaluwarsa", severity: 3 });
  }
  if (!product.hasPhoto) {
    issues.push({ label: "Tanpa foto asli", severity: 2 });
  }

  return issues;
}

function HealthMetric({
  label,
  value,
  total,
  description,
  inverse = false,
}: {
  label: string;
  value: number;
  total: number;
  description: string;
  inverse?: boolean;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const progress = percentage;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
          <dd className="mt-2 text-2xl font-extrabold tabular-nums text-foreground">
            {value}
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              / {total}
            </span>
          </dd>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
            inverse && value > 0
              ? "bg-warning-muted text-warning"
              : "bg-brand-muted text-brand"
          )}
        >
          {percentage}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: ${value} dari ${total}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full",
            inverse && value > 0 ? "bg-warning" : "bg-brand"
          )}
          style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ImportHistory({ imports }: { imports: AdminImportRun[] }) {
  return (
    <section
      aria-labelledby="riwayat-impor"
      className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
            <HugeiconsIcon icon={Upload04Icon} size={20} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <h2 id="riwayat-impor" className="text-lg font-bold text-foreground">
              Riwayat impor
            </h2>
            <p className="text-sm text-muted-foreground">Enam proses terbaru dari audit admin.</p>
          </div>
        </div>
        <Link
          href="/admin/import"
          className="inline-flex min-h-10 shrink-0 items-center text-xs font-bold text-brand hover:underline"
        >
          Impor data
        </Link>
      </div>

      {imports.length === 0 ? (
        <p className="mt-5 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          Belum ada proses impor yang tercatat.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-border">
          {imports.map((run) => (
            <li key={run.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground" title={run.fileName}>
                    {run.fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {run.kind === "offers" ? "Penawaran & harga" : "Spesifikasi produk"}
                    {" · "}{run.totalRows} baris
                    {run.actorEmail ? ` · ${run.actorEmail}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(run.createdAt)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-full bg-brand-muted px-2 py-1 text-brand">
                  {run.created} baru
                </span>
                <span className="rounded-full bg-muted px-2 py-1 text-foreground">
                  {run.updated} diperbarui
                </span>
                {run.kind === "offers" ? (
                  <span className="rounded-full bg-success-muted px-2 py-1 text-success">
                    {run.pricesRecorded} harga
                  </span>
                ) : null}
                {run.skipped > 0 ? (
                  <span className="rounded-full bg-warning-muted px-2 py-1 text-warning">
                    {run.skipped} dilewati
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function AdminDataHealth({
  products,
  imports,
  freshnessHours,
}: {
  products: AdminProductOverviewRow[];
  imports: AdminImportRun[];
  freshnessHours: number;
}) {
  const total = products.length;
  const productsWithPhoto = products.filter((product) => product.hasPhoto).length;
  const productsWithVariants = products.filter((product) => product.variantCount > 0).length;
  const freshPrices = products.filter((product) => product.priceStatus === "fresh").length;
  const attention = products
    .map((product) => ({ product, issues: issuesFor(product) }))
    .filter((item) => item.issues.length > 0)
    .sort(
      (a, b) =>
        Number(b.product.status === "published") -
          Number(a.product.status === "published") ||
        Math.max(...b.issues.map((issue) => issue.severity)) -
          Math.max(...a.issues.map((issue) => issue.severity)) ||
        b.issues.length - a.issues.length ||
        a.product.brand.localeCompare(b.product.brand, "id")
    );
  const publishedAttention = attention.filter(
    (item) => item.product.status === "published"
  ).length;

  return (
    <section aria-labelledby="kesehatan-katalog" className="mt-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-muted text-brand">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} strokeWidth={1.8} aria-hidden />
        </span>
        <div>
          <h2 id="kesehatan-katalog" className="text-lg font-bold text-foreground">
            Kesehatan katalog
          </h2>
          <p className="text-sm text-muted-foreground">
            Menunjukkan data yang perlu dilengkapi, bukan sekadar jumlah produk.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <HealthMetric
          label="Punya foto asli"
          value={productsWithPhoto}
          total={total}
          description="Ilustrasi generik tidak dihitung sebagai foto produk."
        />
        <HealthMetric
          label="Punya varian"
          value={productsWithVariants}
          total={total}
          description="Minimal satu kombinasi RAM dan penyimpanan."
        />
        <HealthMetric
          label="Harga masih segar"
          value={freshPrices}
          total={total}
          description={`Berdasarkan batas freshness ${freshnessHours} jam.`}
        />
        <HealthMetric
          label="Perlu ditinjau"
          value={attention.length}
          total={total}
          inverse
          description={`${publishedAttention} produk terbit ikut membutuhkan perhatian.`}
        />
      </dl>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <section
          aria-labelledby="antrean-perbaikan"
          className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-muted text-warning">
              <HugeiconsIcon icon={Alert02Icon} size={20} strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <h2 id="antrean-perbaikan" className="text-lg font-bold text-foreground">
                Antrean perbaikan
              </h2>
              <p className="text-sm text-muted-foreground">
                Produk terbit dan masalah paling penting ditampilkan lebih dulu.
              </p>
            </div>
          </div>

          {attention.length === 0 ? (
            <p className="mt-5 rounded-xl bg-success-muted p-4 text-sm text-success">
              Semua produk sudah memiliki foto, varian, penawaran, dan harga segar.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {attention.slice(0, 8).map(({ product, issues }) => (
                <li key={product.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="group flex min-h-11 items-start justify-between gap-4 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground group-hover:text-brand">
                        {product.brand} {product.model}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {issues.map((issue) => (
                          <span
                            key={issue.label}
                            className="rounded-full bg-warning-muted px-2 py-0.5 text-[10px] font-bold text-warning"
                          >
                            {issue.label}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold",
                        product.status === "published"
                          ? "bg-success-muted text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {product.status === "published" ? "Terbit" : "Draft"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {attention.length > 8 ? (
            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              Menampilkan 8 prioritas dari {attention.length} produk yang perlu ditinjau.
            </p>
          ) : null}
        </section>

        <ImportHistory imports={imports} />
      </div>
    </section>
  );
}
