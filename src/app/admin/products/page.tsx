import Link from "next/link";
import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { listAdminProducts } from "@/lib/admin/queries";

export const metadata: Metadata = {
  title: "Kelola Produk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Daftar produk untuk admin (PRD FR-07).
 *
 * Menampilkan draft DAN terpublikasi, dengan status yang selalu terlihat. Kalau
 * status tidak dipajang jelas, admin gampang mengira sesuatu sudah terbit
 * padahal belum, atau sebaliknya.
 */
export default async function AdminProductsPage() {
  const products = await listAdminProducts();
  const draftCount = products.filter((p) => p.status === "draft").length;

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Kelola Produk
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {products.length} produk, {draftCount} masih draft.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/admin">Dasbor</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/products/baru">Tambah produk</Link>
          </Button>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="mt-8 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Belum ada produk. Mulai dengan menambah satu, atau tunggu fitur impor
          dataset.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/products/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-4 p-5 transition-colors duration-150 hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {p.brand} {p.model}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.slug} · {p.variantCount} varian · {p.offerCount} penawaran
                  </p>
                </div>
                <span
                  className={
                    p.status === "published"
                      ? "rounded-pill bg-success-muted px-3 py-1 text-xs font-semibold text-success"
                      : "rounded-pill bg-warning-muted px-3 py-1 text-xs font-semibold text-warning"
                  }
                >
                  {p.status === "published" ? "Terbit" : "Draft"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
