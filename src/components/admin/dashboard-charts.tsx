import type { CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Analytics01Icon, ChartBarLineIcon } from "@hugeicons/core-free-icons";

export type AdminBrandDatum = {
  brand: string;
  count: number;
};

export function AdminDashboardCharts({
  published,
  draft,
  productsWithOffers,
  totalProducts,
  brands,
}: {
  published: number;
  draft: number;
  productsWithOffers: number;
  totalProducts: number;
  brands: AdminBrandDatum[];
}) {
  const publishedPercent = totalProducts > 0
    ? Math.round((published / totalProducts) * 100)
    : 0;
  const offerCoverage = totalProducts > 0
    ? Math.round((productsWithOffers / totalProducts) * 100)
    : 0;
  const maxBrandCount = Math.max(...brands.map((item) => item.count), 1);

  return (
    <section aria-labelledby="ringkasan-data" className="mt-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-muted text-brand">
          <HugeiconsIcon icon={Analytics01Icon} size={20} strokeWidth={1.8} aria-hidden />
        </span>
        <div>
          <h2 id="ringkasan-data" className="text-lg font-bold text-foreground">
            Ringkasan data katalog
          </h2>
          <p className="text-sm text-muted-foreground">
            Grafik memakai data database saat ini, bukan angka contoh.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h3 className="text-sm font-bold text-foreground">Status publikasi</h3>
          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
            <div
              role="img"
              aria-label={`${publishedPercent}% produk sudah diterbitkan`}
              className="relative size-36 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(var(--brand) 0 ${publishedPercent}%, var(--muted) ${publishedPercent}% 100%)`,
              }}
            >
              <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-card">
                <span className="text-2xl font-extrabold tabular-nums text-foreground">
                  {publishedPercent}%
                </span>
                <span className="text-xs text-muted-foreground">sudah terbit</span>
              </div>
            </div>
            <dl className="grid w-full gap-3">
              <div className="flex items-center justify-between rounded-xl bg-brand-muted px-4 py-3">
                <dt className="text-sm font-medium text-foreground">Terbit</dt>
                <dd className="font-bold tabular-nums text-brand">{published}</dd>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
                <dt className="text-sm font-medium text-foreground">Draft</dt>
                <dd className="font-bold tabular-nums text-foreground">{draft}</dd>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <dt className="text-sm font-medium text-foreground">Punya penawaran</dt>
                <dd className="font-bold tabular-nums text-foreground">
                  {productsWithOffers} <span className="text-xs font-medium text-muted-foreground">({offerCoverage}%)</span>
                </dd>
              </div>
            </dl>
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={ChartBarLineIcon} size={19} strokeWidth={1.8} aria-hidden className="text-brand" />
            <h3 className="text-sm font-bold text-foreground">Produk per merek</h3>
          </div>
          {brands.length > 0 ? (
            <ol className="mt-5 space-y-4" aria-label="Enam merek dengan produk terbanyak">
              {brands.map((item) => {
                const width = Math.max((item.count / maxBrandCount) * 100, 4);
                return (
                  <li key={item.brand}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-foreground">{item.brand}</span>
                      <span className="shrink-0 font-bold tabular-nums text-foreground">{item.count}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full w-[var(--bar-width)] rounded-full bg-brand transition-[width] duration-300"
                        style={{ "--bar-width": `${width}%` } as CSSProperties}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              Belum ada produk untuk digambarkan.
            </p>
          )}
        </article>
      </div>

      <article className="mt-4 flex flex-col gap-4 rounded-2xl border border-dashed border-border-strong bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h3 className="text-sm font-bold text-foreground">Statistik kunjungan situs</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Belum diaktifkan. Jumlah pengunjung tidak ditampilkan sampai provider
            analytics, kebijakan privasi, dan lingkungan deployment telah dipilih.
          </p>
        </div>
        <span className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-warning-muted px-3 text-xs font-bold text-warning">
          Menunggu deployment
        </span>
      </article>
    </section>
  );
}
