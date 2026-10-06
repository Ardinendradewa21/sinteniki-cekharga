import type { Metadata } from "next";
import Link from "next/link";

import { AdminDataHealth } from "@/components/admin/data-health";
import { AdminDashboardCharts } from "@/components/admin/dashboard-charts";
import { ImportQualityPanel } from "@/components/admin/import-quality";
import { Container } from "@/components/layout/container";
import { Reveal, StaggerItem, StaggerList } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import {
  getImportQuality,
  listAdminProducts,
  listRecentAudit,
} from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";
import { checkBackendHealth } from "@/lib/backend/health";
import { getDataSourceMode, PRICING_POLICY } from "@/lib/config";
import { listBatches } from "@/lib/import/batches";

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
function StaffHome({ denied }: { denied: boolean }) {
  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
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
  const [health, products, audit, imports] = await Promise.all([
    checkBackendHealth(),
    listAdminProducts(now),
    listRecentAudit(10),
    listBatches(6, { excludeScheduled: true }),
  ]);
  // Panel kualitas impor bersifat pelengkap: gagal dibaca tidak menjatuhkan dasbor.
  const importQuality = await importQualityPromise;
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

  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">Ringkasan admin</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Pantau katalog dan lanjutkan pekerjaan yang paling sering dilakukan.
          </p>
        </div>
        <Button asChild><Link href="/admin/products/baru">Tambah produk</Link></Button>
      </div>

      <StaggerList as="dl" className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StaggerItem as="div" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <dt className="text-xs font-medium text-muted-foreground sm:text-sm">Total produk</dt>
          <dd className="mt-3 text-2xl font-extrabold tabular-nums text-foreground sm:text-3xl">{products.length}</dd>
          <p className="mt-1 text-xs text-muted-foreground">Tercatat di katalog</p>
        </StaggerItem>
        <StaggerItem as="div" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <dt className="text-xs font-medium text-muted-foreground sm:text-sm">Terbit</dt>
          <dd className="mt-3 text-2xl font-extrabold tabular-nums text-foreground sm:text-3xl">{publishedCount}</dd>
          <p className="mt-1 text-xs text-muted-foreground">Tampil di situs publik</p>
        </StaggerItem>
        <StaggerItem as="div" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <dt className="text-xs font-medium text-muted-foreground sm:text-sm">Draft</dt>
          <dd className="mt-3 text-2xl font-extrabold tabular-nums text-foreground sm:text-3xl">{draftCount}</dd>
          <p className="mt-1 text-xs text-muted-foreground">Belum tampil ke publik</p>
        </StaggerItem>
        <StaggerItem as="div" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <dt className="text-xs font-medium text-muted-foreground sm:text-sm">Status backend</dt>
          <dd className="mt-3 flex items-center gap-2 text-sm font-bold text-foreground sm:text-base">
            <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${backendReady ? "bg-success" : "bg-warning"}`} />
            {backendLabel}
          </dd>
          <p className="mt-2 text-xs text-muted-foreground">Mode data: {sourceMode === "live" ? "Database live" : "Demo"}</p>
        </StaggerItem>
      </StaggerList>

      {!backendReady && sourceMode === "live" ? (
        <p role="alert" className="mt-4 rounded-xl border border-warning/30 bg-warning-muted p-4 text-sm text-foreground">
          Backend belum siap untuk mode live. Periksa konfigurasi dan skema database sebelum mengubah data.
        </p>
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

      <Reveal>
        <AdminDashboardCharts
          published={publishedCount}
          draft={draftCount}
          productsWithOffers={productsWithOffers}
          totalProducts={products.length}
          brands={topBrands}
        />
      </Reveal>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section aria-labelledby="aksi-admin" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 id="aksi-admin" className="text-lg font-bold text-foreground">Tindakan cepat</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pilih pekerjaan yang ingin kamu lanjutkan.</p>
          <div className="mt-5 grid gap-3">
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
