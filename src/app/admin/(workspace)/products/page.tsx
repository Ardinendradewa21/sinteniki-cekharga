import Form from "next/form";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminProductList } from "@/components/admin/product-list";
import { RememberProductFilter } from "@/components/admin/remember-product-filter";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteProductsBulkAction,
  setProductsStatusBulkAction,
} from "@/lib/admin/actions";
import { ADMIN_PRODUCT_FILTER_COOKIE } from "@/lib/admin/preferences-config";
import { listAdminProductBrands, listAdminProductsPage } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

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

function filterSearch(query: string, brand: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (brand) params.set("brand", brand);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

/**
 * Tautan daftar dengan filter tertentu. Tanpa filter memakai `?semua=1`, bukan
 * `/admin/products` polos: URL polos berarti "pulihkan filter terakhir" (AV-02),
 * jadi memilih "Semua merek" harus eksplisit.
 */
function productsHref(query: string, brand: string, page: number): string {
  const search = filterSearch(query, brand, page);
  return search ? `/admin/products?${search}` : "/admin/products?semua=1";
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
  const brands = await listAdminProductBrands();
  const brandNames = brands.map((option) => option.name);

  // AV-02: kembali ke /admin/products tanpa parameter (tombol kembali, menu
  // samping, breadcrumb) memulihkan filter terakhir admin di browser ini.
  // Isi cookie divalidasi ulang; merek yang sudah tidak ada diabaikan.
  if (Object.keys(params).length === 0) {
    const saved = new URLSearchParams((await cookies()).get(ADMIN_PRODUCT_FILTER_COOKIE)?.value ?? "");
    const savedBrand = saved.get("brand") ?? "";
    const restored = filterSearch(
      (saved.get("q") ?? "").trim().slice(0, 80),
      brandNames.includes(savedBrand) ? savedBrand : "",
      pageParam(saved.get("page") ?? undefined)
    );
    if (restored) redirect(`/admin/products?${restored}`);
  }

  const query = stringParam(params.q).trim().slice(0, 80);
  const requestedBrand = stringParam(params.brand).trim().slice(0, 80);
  const brand = brandNames.includes(requestedBrand) ? requestedBrand : "";
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
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
          <Button asChild variant="outline">
            <Link href="/admin/products/perbandingan">Perbandingan pilihan</Link>
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
          {changedCount} produk berhasil dihapus. Riwayat harganya tetap tersimpan.
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
                : errorCode === "tanpa-penawaran-banyak"
                  ? `${changedCount} produk terpilih belum punya penawaran aktif. Tidak ada status yang diubah.`
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

      {/* AV-02: filter terakhir diingat di browser ini dan dipulihkan saat kembali. */}
      <RememberProductFilter value={filterSearch(query, brand, result.page)} />

      <div className="mt-8 rounded-xl border border-border bg-card p-4">
        <Form action="/admin/products" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="cari-produk-admin" className="mb-1.5 block text-xs font-semibold text-foreground">
              Cari produk
            </label>
            <Input
              id="cari-produk-admin"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Cari model atau slug produk…"
              className="w-full"
            />
          </div>
          {/* Mencari tetap di dalam merek yang sedang dipilih. */}
          {brand ? <input type="hidden" name="brand" value={brand} /> : null}
          <Button type="submit">Cari</Button>
          {query || brand ? (
            <Button asChild type="button" variant="outline">
              <Link href="/admin/products?semua=1">Reset filter</Link>
            </Button>
          ) : null}
        </Form>

        {/* Chip merek: sekali ketuk langsung menyaring, ketuk lagi untuk lepas
            (pola chip katalog publik, satu merek per kali). Urut nama supaya
            posisinya tidak berpindah. */}
        <nav aria-label="Saring menurut merek" className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold text-foreground">Merek</p>
          <ul className="flex flex-wrap gap-2">
            {[{ name: "", count: brands.reduce((sum, option) => sum + option.count, 0) }, ...brands].map((option) => {
              const active = option.name === brand;
              return (
                <li key={option.name || "semua"}>
                  <Link
                    href={productsHref(query, active && option.name ? "" : option.name, 1)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border-strong bg-card text-foreground hover:bg-muted"
                    )}
                  >
                    {option.name || "Semua"}
                    <span className="tabular text-xs opacity-80">{option.count}</span>
                    {active && option.name ? <span className="sr-only">(dipilih; ketuk lagi untuk melepas)</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

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
              <Link href="/admin/products?semua=1">Tampilkan semua produk</Link>
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
