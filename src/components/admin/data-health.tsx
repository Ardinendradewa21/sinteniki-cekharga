import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons";

import type { AdminProductOverviewRow } from "@/lib/admin/queries";
import { batchStatusView } from "@/lib/import/batch-status";
import type { BatchSummary } from "@/lib/import/batches";
import { scrapeBrandOf } from "@/lib/scrape/types";
import { Badge } from "@/components/ui/badge";
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
  if (product.specGaps.length > 0) {
    issues.push({ label: `${gapLabel(product.specGaps)} belum tercatat`, severity: 1 });
  }

  return issues;
}

function gapLabel(gaps: AdminProductOverviewRow["specGaps"]): string {
  return gaps.map((gap) => (gap === "nfc" ? "NFC" : "IP rating")).join(" & ");
}

/** Tautan ke tab Tarik otomatis yang sudah memilih merek dan mencari modelnya. */
function rescrapeHref(product: AdminProductOverviewRow): string | null {
  const brand = scrapeBrandOf(product.brand);
  if (!brand) return null;
  const params = new URLSearchParams({ tab: "tarik", merek: brand, cari: product.model });
  return `/admin/import?${params}`;
}

const GAP_LIST_LIMIT = 40;

type GapGroup = {
  id: string;
  title: string;
  description: string;
  items: AdminProductOverviewRow[];
  action: { href: string; label: string };
  /** Tarik ulang hanya membantu bila sumbernya memang bisa mengisi celah ini. */
  rescrape: boolean;
};

/**
 * Celah data pada produk yang SUDAH terbit, dikelompokkan per jenis tindakan.
 * Produk draft sengaja tidak dihitung: belum tampil ke publik, dan biasanya
 * memang masih dilengkapi.
 */
function PublishedGaps({ products }: { products: AdminProductOverviewRow[] }) {
  const published = products.filter((product) => product.status === "published");
  const groups: GapGroup[] = [
    {
      id: "tanpa-penawaran",
      title: "Tanpa penawaran",
      description:
        "Halaman publiknya hanya menampilkan spesifikasi tanpa harga. Tarik ulang harga resmi, atau unggah CSV penawaran untuk toko lain.",
      items: published.filter((product) => product.offerCount === 0),
      action: { href: "/admin/import?tab=unggah", label: "Unggah CSV penawaran" },
      rescrape: true,
    },
    {
      id: "tanpa-foto",
      title: "Tanpa foto asli",
      description:
        "Masih memakai ilustrasi generik. Tarik ulang dari sumbernya, lalu pantau hasil unduhannya di tab Foto.",
      items: published.filter((product) => !product.hasPhoto),
      action: { href: "/admin/import?tab=foto", label: "Buka antrean foto" },
      rescrape: true,
    },
    {
      id: "spesifikasi-kosong",
      title: "NFC atau IP rating belum tercatat",
      description:
        "Sumber spesifikasi menulis “tergantung pasar” atau tidak mengisinya, jadi tarik ulang tidak mengubah apa pun. Cek situs resmi merek lalu isi di halaman sunting. IP kosong bisa berarti perangkat memang tanpa sertifikasi.",
      items: published.filter((product) => product.specGaps.length > 0),
      action: { href: "/admin/products", label: "Kelola produk" },
      rescrape: false,
    },
  ];

  return (
    <section
      aria-labelledby="celah-produk-terbit"
      className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <h2 id="celah-produk-terbit" className="text-lg font-bold text-foreground">
        Celah data produk terbit
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {published.length} produk tampil di situs publik. Buka tiap kelompok untuk melihat produknya.
      </p>

      <div className="mt-4 space-y-3">
        {groups.map((group) => (
          <details
            key={group.id}
            data-testid={`gap-${group.id}`}
            className="rounded-xl border border-border open:bg-muted/30"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 focus-visible:ring-2 focus-visible:ring-ring">
              <span className="text-sm font-semibold text-foreground">{group.title}</span>
              <Badge variant={group.items.length > 0 ? "warning" : "success"} className="tabular-nums">
                {group.items.length} produk
              </Badge>
            </summary>
            <div className="border-t border-border px-4 pb-4 pt-3">
              <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">{group.description}</p>
              {group.items.length === 0 ? (
                <p className="mt-3 text-sm text-success">Tidak ada produk terbit di kelompok ini.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {group.items.slice(0, GAP_LIST_LIMIT).map((product) => {
                    const rescrape = group.rescrape ? rescrapeHref(product) : null;
                    return (
                      <li key={product.id} className="flex flex-wrap items-center justify-between gap-x-4 py-1">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg text-sm font-medium text-foreground hover:text-brand focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="truncate">
                            {product.brand} {product.model}
                          </span>
                          {group.id === "spesifikasi-kosong" ? (
                            <Badge variant="warning">{gapLabel(product.specGaps)}</Badge>
                          ) : null}
                        </Link>
                        {rescrape ? (
                          <Link
                            href={rescrape}
                            className="inline-flex min-h-11 items-center text-xs font-bold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Tarik ulang
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {group.items.length > GAP_LIST_LIMIT ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Menampilkan {GAP_LIST_LIMIT} dari {group.items.length} produk.
                </p>
              ) : null}
              <Link
                href={group.action.href}
                className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {group.action.label}
              </Link>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
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

  // Struktur <dl> yang valid: setiap kartu adalah grup div berisi tepat satu
  // <dt> dan satu <dd>. Angka, persentase, progres, dan keterangan semuanya
  // menjelaskan istilah yang sama, jadi berada di dalam <dd>.
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-2">
        <div className="flex items-start justify-between gap-3">
          <span className="text-2xl font-extrabold tabular-nums text-foreground">
            {value}
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              / {total}
            </span>
          </span>
          <Badge variant={inverse && value > 0 ? "warning" : "brand"} className="tabular-nums">
            {percentage}%
          </Badge>
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
      </dd>
    </div>
  );
}

function ImportHistory({ batches }: { batches: BatchSummary[] }) {
  const now = new Date();
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
            <p className="text-sm text-muted-foreground">
              Enam batch terbaru buatan admin. Pemeriksaan harga harian ada di tab Riwayat.
            </p>
          </div>
        </div>
        <Link
          href="/admin/import?tab=riwayat"
          className="inline-flex min-h-11 shrink-0 items-center text-xs font-bold text-brand hover:underline"
        >
          Semua batch
        </Link>
      </div>

      {batches.length === 0 ? (
        <p className="mt-5 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          Belum ada batch impor.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-border">
          {batches.map((batch) => {
            const created = batch.counts.create ?? 0;
            const updated = batch.counts.update ?? 0;
            return (
              <li key={batch.id} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/admin/import/batch/${batch.id}`}
                  className="group block rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold text-foreground group-hover:text-brand"
                        title={batch.sourceLabel}
                      >
                        {batch.sourceLabel}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {batch.kind === "offers" ? "Penawaran & harga" : "Spesifikasi produk"}
                        {batch.origin === "scrape" ? " · tarik otomatis" : " · CSV"}
                        {batch.createdByEmail ? ` · ${batch.createdByEmail}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(batch.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {/* Warna status mengikuti BATCH_STATUS_TONE (sumber tunggal status batch). */}
                    <Badge variant="muted" className={batchStatusView(batch, now).tone}>
                      {batchStatusView(batch, now).label}
                    </Badge>
                    <Badge variant="brand">{created} baru</Badge>
                    <Badge variant="muted">{updated} diperbarui</Badge>
                    {batch.progress && batch.progress.failed > 0 ? (
                      <Badge variant="destructive">{batch.progress.failed} gagal</Badge>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
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
  imports: BatchSummary[];
  freshnessHours: number;
}) {
  const total = products.length;
  const published = products.filter((product) => product.status === "published").length;
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
  // "Perlu ditinjau" hanya menghitung produk TERBIT yang halamannya kehilangan
  // inti informasinya (tanpa varian/penawaran/harga). Harga kedaluwarsa sudah
  // punya metrik sendiri dan diatasi pemeriksaan harian; spesifikasi kosong
  // ada di panel celah data. Menggabungkan semuanya membuat angka ini selalu
  // 100% sehingga tidak membantu memilih apa yang dikerjakan dulu.
  const BLOCKING_SEVERITY = 4;
  const publishedBlocked = attention.filter(
    (item) =>
      item.product.status === "published" &&
      item.issues.some((issue) => issue.severity >= BLOCKING_SEVERITY)
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
          label="Terbit tanpa harga"
          value={publishedBlocked}
          total={published}
          inverse
          description="Produk terbit tanpa varian, penawaran, atau harga tercatat. Prioritas pertama."
        />
      </dl>

      <PublishedGaps products={products} />

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
              Semua produk sudah memiliki foto, varian, penawaran, harga segar, NFC, dan IP rating.
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
                          <Badge key={issue.label} variant="warning">
                            {issue.label}
                          </Badge>
                        ))}
                      </span>
                    </span>
                    <Badge variant={product.status === "published" ? "success" : "muted"}>
                      {product.status === "published" ? "Terbit" : "Draft"}
                    </Badge>
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

        <ImportHistory batches={imports} />
      </div>
    </section>
  );
}
