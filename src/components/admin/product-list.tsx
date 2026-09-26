"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { AdminProductRow } from "@/lib/admin/queries";
import { formatIdr } from "@/lib/catalog/pricing";

const GENERIC_PRODUCT_IMAGE = "/images/generic-device.svg";

function DeleteSelectedButton({ count }: { count: number }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="destructive"
      size="sm"
      disabled={count === 0 || pending}
    >
      {pending ? "Menghapus…" : `Hapus terpilih${count ? ` (${count})` : ""}`}
    </Button>
  );
}

function StatusSelectedButtons({ count }: { count: number }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="submit"
        name="status"
        value="published"
        size="sm"
        disabled={count === 0 || pending}
      >
        {pending ? "Memproses…" : "Terbitkan"}
      </Button>
      <Button
        type="submit"
        name="status"
        value="draft"
        variant="outline"
        size="sm"
        disabled={count === 0 || pending}
      >
        Jadikan draft
      </Button>
    </div>
  );
}

function ProductThumbnail({ product }: { product: AdminProductRow }) {
  const [failed, setFailed] = useState(false);
  const usesFallback = failed || product.image.isGenericIllustration;

  return (
    <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30 p-1.5">
      <Image
        src={failed ? GENERIC_PRODUCT_IMAGE : product.image.src}
        alt={failed ? "Ilustrasi generik perangkat smartphone" : product.image.alt}
        width={64}
        height={64}
        sizes="64px"
        className="size-full object-contain"
        onError={() => setFailed(true)}
      />
      {usesFallback ? (
        <span className="sr-only">Gambar produk belum tersedia.</span>
      ) : null}
    </div>
  );
}

function ProductPrice({ product }: { product: AdminProductRow }) {
  if (!product.recordedPrice) {
    return (
      <span className="text-sm font-medium text-muted-foreground">
        Belum ada harga
      </span>
    );
  }

  return (
    <div>
      <p className="tabular text-sm font-extrabold text-foreground">
        {formatIdr(product.recordedPrice.priceIdr)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">Harga tercatat</p>
    </div>
  );
}

function ProductStatus({ status }: { status: AdminProductRow["status"] }) {
  return (
    <span
      className={
        status === "published"
          ? "inline-flex rounded-pill bg-success-muted px-3 py-1 text-xs font-semibold text-success"
          : "inline-flex rounded-pill bg-warning-muted px-3 py-1 text-xs font-semibold text-warning"
      }
    >
      {status === "published" ? "Terbit" : "Draft"}
    </span>
  );
}

export function AdminProductList({
  products,
  deleteAction,
  statusAction,
  returnTo,
}: {
  products: AdminProductRow[];
  deleteAction: (formData: FormData) => Promise<void>;
  statusAction: (formData: FormData) => Promise<void>;
  returnTo: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allSelected = products.length > 0 && selected.size === products.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selected.size > 0 && selected.size < products.length;
    }
  }, [products.length, selected.size]);

  function toggleProduct(productId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((product) => product.id)));
  }

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex min-h-14 flex-wrap items-center gap-4 border-b border-border bg-muted/40 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-foreground">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="size-5 cursor-pointer rounded border-border accent-foreground"
          />
          Pilih semua di halaman ini
        </label>

        <p className="mr-auto text-xs text-muted-foreground sm:text-sm">
          {selected.size > 0
            ? `${selected.size} produk dipilih`
            : "Pilih produk untuk tindakan massal"}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <form action={statusAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            {[...selected].map((productId) => (
              <input
                key={productId}
                type="hidden"
                name="productIds"
                value={productId}
              />
            ))}
            <StatusSelectedButtons count={selected.size} />
          </form>

          <form
            action={deleteAction}
            onSubmit={(event) => {
              const confirmed =
                selected.size > 0 &&
                window.confirm(
                  `Hapus permanen ${selected.size} produk beserta seluruh data terkait? Tindakan ini tidak bisa dibatalkan.`
                );
              if (!confirmed) event.preventDefault();
            }}
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            {[...selected].map((productId) => (
              <input
                key={productId}
                type="hidden"
                name="productIds"
                value={productId}
              />
            ))}
            <DeleteSelectedButton count={selected.size} />
          </form>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="border-b border-border bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-14 px-4 py-3">
                <span className="sr-only">Pilih</span>
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">Produk</th>
              <th scope="col" className="px-3 py-3 font-semibold">Brand</th>
              <th scope="col" className="px-3 py-3 font-semibold">Harga</th>
              <th scope="col" className="px-3 py-3 font-semibold">Status</th>
              <th scope="col" className="px-3 py-3 font-semibold">Data</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((product) => {
              const checked = selected.has(product.id);

              return (
                <tr
                  key={product.id}
                  className={
                    checked
                      ? "bg-primary/5"
                      : "transition-colors hover:bg-muted/20"
                  }
                >
                  <td className="px-4 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(product.id)}
                      aria-label={`Pilih ${product.brand} ${product.model}`}
                      className="size-5 cursor-pointer rounded border-border accent-foreground"
                    />
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex min-w-64 items-center gap-3">
                      <ProductThumbnail key={product.image.src} product={product} />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="line-clamp-2 text-sm font-bold text-foreground outline-none transition-colors hover:text-primary focus-visible:rounded focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {product.model}
                        </Link>
                        <p className="mt-1 max-w-60 truncate text-xs text-muted-foreground">
                          {product.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-foreground">
                    {product.brand}
                  </td>
                  <td className="px-3 py-3">
                    <ProductPrice product={product} />
                  </td>
                  <td className="px-3 py-3">
                    <ProductStatus status={product.status} />
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    <p>{product.variantCount} varian</p>
                    <p className="mt-1">{product.offerCount} penawaran</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/products/${product.id}`}>Edit</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {products.map((product) => {
          const checked = selected.has(product.id);

          return (
            <li
              key={product.id}
              className={checked ? "bg-primary/5" : undefined}
            >
              <article className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProduct(product.id)}
                    aria-label={`Pilih ${product.brand} ${product.model}`}
                    className="mt-5 size-5 shrink-0 cursor-pointer rounded border-border accent-foreground"
                  />

                  <ProductThumbnail key={product.image.src} product={product} />

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="line-clamp-2 text-sm font-bold text-foreground outline-none transition-colors hover:text-primary focus-visible:rounded focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {product.model}
                    </Link>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {product.brand} · {product.slug}
                    </p>
                  </div>

                  <ProductStatus status={product.status} />
                </div>

                <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
                  <div>
                    <ProductPrice product={product} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product.variantCount} varian · {product.offerCount} penawaran
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/products/${product.id}`}>Edit</Link>
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
