import Form from "next/form";
import Link from "next/link";
import type { Metadata } from "next";

import { AdminProductList } from "@/components/admin/product-list";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteProductsBulkAction,
  setProductsStatusBulkAction,
} from "@/lib/admin/actions";
import { listAdminProductBrands, listAdminProductsPage } from "@/lib/admin/queries";

export const metadata: Metadata = {
  title: "Kelola Produk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function stringParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function pageParam(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(stringParam(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function countParam(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(stringParam(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function productsHref(query: string, brand: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (brand) params.set("brand", brand);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/admin/products?${search}` : "/admin/products";
}

/**
 * Daftar produk untuk admin (PRD FR-07).
 *
 * Pencarian dan pagination disimpan di URL supaya hasilnya dapat dimuat ulang
 * dan tombol kembali browser tetap bekerja. Pilihan hapus hanya berlaku pada
 * halaman yang sedang terlihat, bukan diam-diam ke seluruh hasil pencarian.
 */
export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/admin/products">) {
  const params = await searchParams;
  const query = stringParam(params.q).trim().slice(0, 80);
  const requestedBrand = stringParam(params.brand).trim().slice(0, 80);
  const brands = await listAdminProductBrands();
  const brand = brands.includes(requestedBrand) ? requestedBrand : "";
  const requestedPage = pageParam(params.page);
  const result = await listAdminProductsPage({ query, brand, page: requestedPage });
  const changedCount = countParam(params.jumlah);
  const showDeletedMessage = params.pesan === "dihapus";
  const showStatusMessage = params.pesan === "status";
  const resultStatus = params.status === "published" ? "published" : "draft";
  const errorCode = stringParam(params.galat);
  const returnTo = productsHref(query, brand, result.page);
  const firstItem = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const lastItem = Math.min(result.page * result.pageSize, result.total);
  const pageNumbers = [
    ...new Set([1, result.page - 1, result.page, result.page + 1, result.totalPages]),
  ]
    .filter((page) => page >= 1 && page <= result.totalPages)
    .sort((a, b) => a - b);

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Kelola Produk
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {brand && query
              ? `${result.total} produk merek ${brand} cocok dengan “${query}”.`
              : brand
                ? `${result.total} produk merek ${brand}.`
                : query
                  ? `${result.total} produk cocok dengan “${query}”.`
                  : `${result.total} produk tersimpan.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/admin">Dasbor</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/products/baru">Tambah produk</Link>
          </Button>
        </div>
      </div>

      {showDeletedMessage ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-success/30 bg-success-muted p-4 text-sm text-foreground"
        >
          {changedCount} produk berhasil dihapus permanen.
        </p>
      ) : null}

      {showStatusMessage ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-success/30 bg-success-muted p-4 text-sm text-foreground"
        >
          {changedCount > 0
            ? `${changedCount} produk berhasil dijadikan ${resultStatus === "published" ? "terbit" : "draft"}.`
            : `Tidak ada perubahan. Semua produk terpilih sudah berstatus ${resultStatus === "published" ? "terbit" : "draft"}.`}
        </p>
      ) : null}

      {errorCode ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground"
        >
          {errorCode === "pilihan-hapus"
            ? "Pilih sedikitnya satu produk untuk dihapus."
            : errorCode === "pilihan-status"
              ? "Pilih sedikitnya satu produk untuk diubah statusnya."
              : errorCode === "tanpa-varian-banyak"
                ? `${changedCount} produk terpilih belum memiliki varian. Tidak ada status yang diubah.`
                : errorCode === "status-banyak"
                  ? "Status produk terpilih gagal diubah. Tidak ada perubahan yang dilakukan."
                  : "Produk terpilih gagal dihapus. Tidak ada perubahan yang dilakukan."}
        </p>
      ) : null}

      {requestedBrand && !brand ? (
        <p role="status" className="mt-6 rounded-xl border border-warning/30 bg-warning-muted p-4 text-sm text-foreground">
          Merek yang dipilih tidak tersedia lagi. Semua merek ditampilkan.
        </p>
      ) : null}

      <Form
        action="/admin/products"
        className="mt-8 flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="cari-produk-admin" className="mb-1.5 block text-xs font-semibold text-foreground">
            Cari produk
          </label>
          <Input
            id="cari-produk-admin"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Cari merek, model, atau slug produk…"
            className="w-full"
          />
        </div>
        <div className="sm:w-52">
          <label htmlFor="filter-merek-admin" className="mb-1.5 block text-xs font-semibold text-foreground">
            Filter merek
          </label>
          <select
            id="filter-merek-admin"
            name="brand"
            defaultValue={brand}
            className="flex h-10 w-full rounded-lg border border-border-strong bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Semua merek</option>
            {brands.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <Button type="submit">Terapkan</Button>
        {query || brand ? (
          <Button asChild type="button" variant="outline">
            <Link href="/admin/products">Reset filter</Link>
          </Button>
        ) : null}
      </Form>

      {result.items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p>
            {brand && query
              ? `Tidak ada produk merek ${brand} yang cocok dengan “${query}”.`
              : brand
                ? `Tidak ada produk merek ${brand}.`
                : query
                  ? `Tidak ada produk yang cocok dengan “${query}”.`
                  : "Belum ada produk. Mulai dengan menambah produk baru atau mengimpor dataset."}
          </p>
          {query || brand ? (
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/admin/products">Tampilkan semua produk</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs text-muted-foreground">
            Menampilkan {firstItem}-{lastItem} dari {result.total} produk.
          </p>

          <AdminProductList
            key={`${query}:${brand}:${result.page}`}
            products={result.items}
            deleteAction={deleteProductsBulkAction}
            statusAction={setProductsStatusBulkAction}
            returnTo={returnTo}
          />

          <nav
            aria-label="Pagination produk admin"
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
          >
            {result.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={productsHref(query, brand, result.page - 1)}>Sebelumnya</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Sebelumnya
              </Button>
            )}

            {pageNumbers.map((page, index) => {
              const previous = pageNumbers[index - 1];
              return (
                <span key={page} className="contents">
                  {previous && page - previous > 1 ? (
                    <span aria-hidden className="px-1 text-muted-foreground">
                      …
                    </span>
                  ) : null}
                  <Button
                    asChild
                    variant={page === result.page ? "default" : "outline"}
                    size="sm"
                  >
                    <Link
                      href={productsHref(query, brand, page)}
                      aria-current={page === result.page ? "page" : undefined}
                    >
                      {page}
                    </Link>
                  </Button>
                </span>
              );
            })}

            {result.page < result.totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={productsHref(query, brand, result.page + 1)}>Berikutnya</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Berikutnya
              </Button>
            )}
          </nav>
        </>
      )}
    </Container>
  );
}
