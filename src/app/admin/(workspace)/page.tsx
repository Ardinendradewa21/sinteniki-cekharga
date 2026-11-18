import type { Metadata } from "next";
import Link from "next/link";

import { AdminDataHealth } from "@/components/admin/data-health";
import { AdminDashboardCharts } from "@/components/admin/dashboard-charts";
import { KpiCount } from "@/components/admin/kpi-count";
import { RingGauge } from "@/components/admin/ring-gauge";
import { ImportQualityPanel } from "@/components/admin/import-quality";
import { OfferUrlSuggestionsPanel } from "@/components/admin/offer-url-suggestions";
import { PriceRefreshAlerts } from "@/components/admin/price-refresh-alerts";
import { RefreshHeatmap } from "@/components/admin/refresh-heatmap";
import { Container } from "@/components/layout/container";
import { Reveal, StaggerItem, StaggerList } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import {
  getImportQuality,
  listAdminProducts,
  listOfferUrlSuggestions,
  listRecentAudit,
  getStuckRefreshBatches,
  listRecentRefreshRuns,
} from "@/lib/admin/queries";
import { buildRefreshGrid } from "@/lib/admin/refresh-grid";
import { requireAdmin } from "@/lib/auth/dal";
import { checkBackendHealth } from "@/lib/backend/health";
import { getDataSourceMode, PRICING_POLICY } from "@/lib/config";
import { listBatches } from "@/lib/import/batches";
import { refreshAlerts } from "@/lib/import/price-refresh-rules";

export const metadata: Metadata = {
  title: "Dashboard Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Beranda staf non-admin. Data katalog dan impor khusus peran admin, jadi staf
 * lain (sales, adops, finance, legal) hanya melihat modul yang menjadi
 * tugasnya. Halaman yang menolak akses mengarahkan ke sini dengan
 * `?alasan=akses-ditolak`, jadi pesannya juga ditampilkan di sini.
 */
/** Sapaan menurut jam WIB, mis. "Selamat pagi". */
function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("id-ID", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(now));
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function todayLabel(now: Date): string {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jakarta" }).format(now);
}

function StaffHome({ denied }: { denied: boolean }) {
  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
      {denied ? (
        <p role="alert" className="mt-4 max-w-prose rounded-xl border border-warning/40 bg-warning-muted px-4 py-3 text-sm text-foreground">
          Halaman tadi khusus peran admin. Hubungi admin bila Anda membutuhkan aksesnya.
        </p>
      ) : null}
      <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Data katalog, impor, dan tarik otomatis dikelola peran admin. Modul yang tersedia untuk Anda:
      </p>
      <Button asChild className="mt-4">
        <Link href="/admin/iklan">Buka modul Iklan</Link>
      </Button>
    </Container>
  );
}

export default async function AdminPage(props: PageProps<"/admin">) {
  // Hak akses diperiksa sebelum data admin dibaca. Semua staf boleh masuk ke
  // halaman ini, tetapi data katalog hanya untuk peran admin.
  const staff = await requireAdmin();
  if (staff.role !== "admin") {
    const { alasan } = await props.searchParams;
    return <StaffHome denied={alasan === "akses-ditolak"} />;
  }
  const now = new Date();
  const importQualityPromise = getImportQuality(now).catch(() => null);
  // Peringatan pemeriksaan harga harian (PB-05); gagal dibaca tidak menjatuhkan dasbor.
  const refreshRunsPromise = listRecentRefreshRuns(now).catch(() => null);
  const stuckBatchesPromise = getStuckRefreshBatches(now).catch(() => null);
  const urlSuggestionsPromise = listOfferUrlSuggestions().catch(() => null);
  const [health, products, audit, imports] = await Promise.all([
    checkBackendHealth(),
    listAdminProducts(now),
    listRecentAudit(10),
    listBatches(6, { excludeScheduled: true }),
  ]);
  // Panel kualitas impor bersifat pelengkap: gagal dibaca tidak menjatuhkan dasbor.
  const importQuality = await importQualityPromise;
  const refreshRuns = await refreshRunsPromise;
  const stuckBatches = await stuckBatchesPromise;
  const urlSuggestions = await urlSuggestionsPromise;
  const draftCount = products.filter((product) => product.status === "draft").length;
  const publishedCount = products.filter((product) => product.status === "published").length;
  const productsWithOffers = products.filter((product) => product.offerCount > 0).length;
  const brandCount = new Map<string, number>();
  for (const product of products) {
    brandCount.set(product.brand, (brandCount.get(product.brand) ?? 0) + 1);
  }
  const topBrands = [...brandCount]
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand, "id"))
    .slice(0, 6);
  const sourceMode = getDataSourceMode();
  const backendReady = health.status === "reachable" && health.catalogSchemaReady;
  const backendLabel =
    health.status === "reachable"
      ? health.catalogSchemaReady
        ? "Siap digunakan"
        : "Skema belum lengkap"
      : health.status === "not-configured"
        ? "Belum dikonfigurasi"
        : "Tidak terhubung";

  const withoutOffers = products.length - productsWithOffers;
  const offerRatio = products.length > 0 ? productsWithOffers / products.length : 0;
  const publishedPercent = products.length > 0 ? Math.round((publishedCount / products.length) * 100) : 0;

  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      {/*
        Kepala dasbor gaya Veyla (AV-01): sapaan + ringkasan satu baris yang
        dihitung dari data, status backend sebagai pil bertitik "langsung".
      */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="inline-flex min-h-8 items-center gap-2 rounded-pill bg-card px-3 text-xs font-semibold text-foreground shadow-sm">
            <span aria-hidden="true" className="relative flex size-2">
              <span className={`absolute inset-0 rounded-full ${backendReady ? "animate-breathe bg-success" : "bg-warning"}`} />
              <span className={`relative size-2 rounded-full ${backendReady ? "bg-success" : "bg-warning"}`} />
            </span>
            Backend: {backendLabel} · {sourceMode === "live" ? "database live" : "data demo"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-[2.35rem] sm:leading-tight">
            <span className="sr-only">Dashboard: </span>
            {greeting(now)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="first-letter:uppercase">{todayLabel(now)}</span>
            {" · "}
            <Link href="/admin/products" className="font-semibold text-brand-text underline-offset-4 hover:underline">
              {draftCount} draft
            </Link>
            {withoutOffers > 0 ? (
              <>
                {" · "}
                <span className="font-semibold text-foreground">{withoutOffers} produk tanpa penawaran</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="border-border bg-card shadow-sm">
            <Link href="/admin/import">Impor data</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/products/baru">Tambah produk</Link>
          </Button>
        </div>
      </div>

      {/* KPI: satu kartu mint (positif), satu tinta (sorotan), sisanya putih. */}
      <StaggerList as="dl" className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StaggerItem as="div" className="flex min-h-36 flex-col justify-between rounded-2xl bg-brand-muted p-4 text-foreground shadow-sm sm:p-5">
          <dt className="text-sm font-semibold">Terbit</dt>
          <dd>
            <KpiCount value={publishedCount} className="block text-3xl font-semibold tracking-tight sm:text-4xl" />
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-text">
              <span className="rounded-pill bg-card px-2 py-0.5">{publishedPercent}%</span>
              dari {products.length} produk
            </span>
          </dd>
        </StaggerItem>
        <StaggerItem as="div" className="flex min-h-36 flex-col justify-between rounded-2xl bg-card p-4 shadow-sm sm:p-5">
          <dt className="text-sm font-semibold text-muted-foreground">Draft</dt>
          <dd>
            <KpiCount value={draftCount} className="block text-3xl font-semibold tracking-tight text-foreground sm:text-4xl" />
            <span className="mt-2 block text-xs text-muted-foreground">Belum tampil ke publik</span>
          </dd>
        </StaggerItem>
        <StaggerItem as="div" className="flex min-h-36 flex-col justify-between rounded-2xl bg-ink p-4 text-ink-foreground shadow-sm sm:p-5">
          <dt className="text-sm font-semibold text-ink-muted">Total produk</dt>
          <dd>
            <KpiCount value={products.length} className="block text-3xl font-semibold tracking-tight sm:text-4xl" />
            <span className="mt-2 block text-xs text-ink-muted">Tercatat di katalog, termasuk draft</span>
          </dd>
        </StaggerItem>
        <StaggerItem as="div" className="flex min-h-36 items-start justify-between gap-3 rounded-2xl bg-card p-4 shadow-sm sm:p-5">
          <div className="flex h-full flex-col justify-between">
            <dt className="text-sm font-semibold text-muted-foreground">Punya penawaran</dt>
            <dd>
              <span className="block text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                <KpiCount value={productsWithOffers} />
                <span className="text-base font-semibold text-muted-foreground">/{products.length}</span>
              </span>
              <span className="mt-2 block text-xs text-muted-foreground">Minimal satu penawaran toko</span>
            </dd>
          </div>
          <RingGauge ratio={offerRatio} className="hidden shrink-0 sm:block" />
        </StaggerItem>
      </StaggerList>

      {!backendReady && sourceMode === "live" ? (
        <p role="alert" className="mt-4 rounded-xl border border-warning/30 bg-warning-muted p-4 text-sm text-foreground">
          Backend belum siap untuk mode live. Periksa konfigurasi dan skema database sebelum mengubah data.
        </p>
      ) : null}

      {refreshRuns ? <PriceRefreshAlerts alerts={refreshAlerts(refreshRuns, now, stuckBatches)} /> : null}

      {/* Tile harian gaya Veyla (CD-03): merek mana gagal diperiksa, kapan. */}
      {refreshRuns ? (
        <Reveal>
          <RefreshHeatmap grid={buildRefreshGrid(refreshRuns, now)} />
        </Reveal>
      ) : null}

      <Reveal>
        <AdminDataHealth
          products={products}
          imports={imports}
          freshnessHours={PRICING_POLICY.freshnessWindowHours}
        />
      </Reveal>

      {importQuality ? (
        <Reveal>
          <ImportQualityPanel quality={importQuality} />
        </Reveal>
      ) : null}

      {urlSuggestions ? <OfferUrlSuggestionsPanel groups={urlSuggestions.groups} total={urlSuggestions.total} /> : null}

      <Reveal>
        <AdminDashboardCharts
          published={publishedCount}
          draft={draftCount}
          productsWithOffers={productsWithOffers}
          totalProducts={products.length}
          brands={topBrands}
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section aria-labelledby="aksi-admin" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 id="aksi-admin" className="text-lg font-bold text-foreground">Tindakan cepat</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pilih pekerjaan yang ingin kamu lanjutkan.</p>
          <div className="mt-5 grid grid-cols-1 gap-3">
            <Link href="/admin/products" className="group flex min-h-20 items-center justify-between gap-4 rounded-xl border border-border p-4 transition-colors hover:border-brand/40 hover:bg-brand-muted/30 focus-visible:ring-2 focus-visible:ring-ring">
              <span><span className="block text-sm font-bold text-foreground">Kelola produk</span><span className="mt-1 block text-xs text-muted-foreground">Cari, edit, atau ubah status produk.</span></span>
              <span aria-hidden="true" className="text-brand transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link href="/admin/products/baru" className="group flex min-h-20 items-center justify-between gap-4 rounded-xl border border-border p-4 transition-colors hover:border-brand/40 hover:bg-brand-muted/30 focus-visible:ring-2 focus-visible:ring-ring">
              <span><span className="block text-sm font-bold text-foreground">Tambah produk</span><span className="mt-1 block text-xs text-muted-foreground">Masukkan produk baru sebagai draft.</span></span>
              <span aria-hidden="true" className="text-brand transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link href="/admin/import" className="group flex min-h-20 items-center justify-between gap-4 rounded-xl border border-border p-4 transition-colors hover:border-brand/40 hover:bg-brand-muted/30 focus-visible:ring-2 focus-visible:ring-ring">
              <span><span className="block text-sm font-bold text-foreground">Impor data</span><span className="mt-1 block text-xs text-muted-foreground">Unggah produk dan penawaran dari berkas.</span></span>
              <span aria-hidden="true" className="text-brand transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </section>

        <section aria-labelledby="aktivitas-admin" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 id="aktivitas-admin" className="text-lg font-bold text-foreground">Perubahan terakhir</h2>
          <p className="mt-1 text-sm text-muted-foreground">Riwayat perubahan data oleh admin.</p>
          {audit.length === 0 ? (
            <p className="mt-5 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Belum ada perubahan tercatat.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {audit.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="min-w-0 text-foreground"><span className="font-semibold">{row.operation}</span>{" "}<span className="text-muted-foreground">{row.objectType}</span></span>
                  <span className="text-xs text-muted-foreground">{row.actorEmail ?? "Akun tidak tersedia"} · {new Date(row.createdAt).toLocaleString("id-ID")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Container>
  );
}
