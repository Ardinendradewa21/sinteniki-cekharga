import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import { listAdminProducts, listRecentAudit } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";
import { checkBackendHealth } from "@/lib/backend/health";
import { getDataSourceMode } from "@/lib/config";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Kerangka admin (PRD FR-07).
 *
 * `requireAdmin()` dipanggil PALING AWAL, sebelum data apa pun diambil. Kalau
 * pemanggilan itu dipindah ke bawah atau dilewati di halaman admin berikutnya,
 * halaman tersebut menjadi terbuka, karena proxy hanya melakukan pemeriksaan
 * optimistis.
 *
 * Isi CRUD-nya dikerjakan di BE-4. Sprint ini membuktikan gerbangnya bekerja.
 */
export default async function AdminPage() {
  const admin = await requireAdmin();
  const [health, products, audit] = await Promise.all([
    checkBackendHealth(),
    listAdminProducts(),
    listRecentAudit(10),
  ]);
  const draftCount = products.filter((p) => p.status === "draft").length;

  return (
    <Container className="py-10 md:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
            Admin CekHarga
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Masuk sebagai {admin.email}
          </p>
        </div>

        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            Keluar
          </Button>
        </form>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-sm text-muted-foreground">Sumber data aktif</dt>
          <dd className="mt-1 text-base font-bold text-foreground">
            {getDataSourceMode() === "live" ? "Database (live)" : "Fixture demo"}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-sm text-muted-foreground">Status backend</dt>
          <dd className="mt-1 text-base font-bold text-foreground">
            {health.status === "reachable"
              ? health.catalogSchemaReady
                ? "Terhubung, skema siap"
                : "Terhubung, skema belum lengkap"
              : health.status === "not-configured"
                ? "Belum dikonfigurasi"
                : "Tidak bisa dihubungi"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <dt className="text-sm text-muted-foreground">Produk tercatat</dt>
          <dd className="mt-1 text-base font-bold text-foreground">
            {products.length} produk, {draftCount} draft
          </dd>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-5">
          <Button asChild>
            <Link href="/admin/products">Kelola produk</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/import">Impor dataset</Link>
          </Button>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-bold text-foreground">Perubahan terakhir</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Setiap perubahan data tercatat beserta pelaku dan waktunya.
        </p>
        {audit.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Belum ada perubahan tercatat.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border text-sm">
            {audit.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span className="text-foreground">
                  <span className="font-medium">{row.operation}</span>{" "}
                  <span className="text-muted-foreground">{row.objectType}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.actorEmail ?? "akun dihapus"} ·{" "}
                  {new Date(row.createdAt).toLocaleString("id-ID")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-bold text-foreground">Yang belum tersedia</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Kurasi ringkasan review belum dibuat, dan pemeriksaan harga masih
          manual lewat halaman produk. Keduanya dikerjakan setelah ini.
        </p>
      </div>
    </Container>
  );
}
