"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/admin/actions";
import { formatIdr } from "@/lib/catalog/pricing";
import type { AdminProductDetail } from "@/lib/admin/queries";

/**
 * Panel varian, penawaran, dan pencatatan harga.
 *
 * Aksi hapus sengaja berupa <form> dengan tombol submit, bukan tautan. Tautan
 * yang menghapus data bisa terpicu prefetch atau crawler; operasi yang mengubah
 * data harus lewat POST.
 */

const INITIAL: ActionState = { error: null };

function Notice({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="mt-3 text-sm font-medium text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="mt-3 text-sm font-medium text-success">
        {state.message}
      </p>
    );
  }
  return null;
}

export function VariantPanel({
  product,
  addAction,
  deleteAction,
}: {
  product: AdminProductDetail;
  addAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [state, action, pending] = useActionState(addAction, INITIAL);

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-bold text-foreground">Varian</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Harga selalu terikat varian, jadi produk tanpa varian tidak bisa
        diterbitkan.
      </p>

      {product.variants.length > 0 ? (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {product.variants.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {v.ramGb}/{v.storageGb} GB
                </p>
                <p className="text-xs text-muted-foreground">
                  {v.region ?? "Region belum diketahui"} · {v.offers.length} penawaran
                </p>
              </div>
              <form action={deleteAction}>
                <input type="hidden" name="variantId" value={v.id} />
                <input type="hidden" name="productId" value={product.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Hapus
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Belum ada varian.
        </p>
      )}

      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="ramGb">RAM (GB)</Label>
          <Input id="ramGb" name="ramGb" type="number" min={1} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="storageGb">Penyimpanan (GB)</Label>
          <Input id="storageGb" name="storageGb" type="number" min={1} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">Region / garansi</Label>
          <Input id="region" name="region" placeholder="Garansi resmi Indonesia" />
        </div>
        <Button type="submit" disabled={pending}>
          Tambah
        </Button>
      </form>
      <Notice state={state} />
    </section>
  );
}

export function OfferPanel({
  product,
  addAction,
  deleteAction,
  priceAction,
  failedCheckAction,
}: {
  product: AdminProductDetail;
  addAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  deleteAction: (formData: FormData) => Promise<void>;
  priceAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  failedCheckAction: (formData: FormData) => Promise<void>;
}) {
  const [addState, add, adding] = useActionState(addAction, INITIAL);
  const [priceState, recordPrice, recording] = useActionState(priceAction, INITIAL);

  const allOffers = product.variants.flatMap((v) =>
    v.offers.map((o) => ({ ...o, variantLabel: `${v.ramGb}/${v.storageGb} GB` }))
  );

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-bold text-foreground">Penawaran dan harga</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Mencatat harga sekaligus menyimpan waktu pemeriksaan yang berhasil.
        Harga lama tidak pernah ikut terlihat baru karena penyuntingan lain.
      </p>

      {allOffers.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {allOffers.map((o) => (
            <li key={o.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {o.marketplace} · {o.sellerName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Varian {o.variantLabel} · {o.listingStatus}
                    {o.sellerVerified ? " · terverifikasi" : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {o.latestPriceIdr !== null
                      ? `Terakhir ${formatIdr(o.latestPriceIdr)} pada ${new Date(o.latestObservedAt!).toLocaleString("id-ID")}`
                      : "Belum ada harga tercatat"}
                  </p>
                </div>
                <form action={deleteAction}>
                  <input type="hidden" name="offerId" value={o.id} />
                  <input type="hidden" name="productId" value={product.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Hapus
                  </Button>
                </form>
              </div>

              <form action={recordPrice} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="offerId" value={o.id} />
                <div className="space-y-2">
                  <Label htmlFor={`price-${o.id}`}>Harga hari ini (Rp)</Label>
                  <Input
                    id={`price-${o.id}`}
                    name="priceIdr"
                    type="number"
                    min={0}
                    step={1000}
                    required
                  />
                </div>
                <Button type="submit" variant="outline" disabled={recording}>
                  Catat harga
                </Button>
              </form>

              {/*
                Mencatat pemeriksaan yang GAGAL, mis. listing hilang atau
                halamannya tidak bisa dibaca. Sengaja tidak menulis harga apa
                pun: PRD §7 butir 6 melarang percobaan gagal memperbarui waktu
                keberhasilan, karena itu akan membuat harga lama tampak baru
                diperiksa justru saat harganya sedang tidak bisa dipastikan.
              */}
              <form action={failedCheckAction} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="offerId" value={o.id} />
                <input type="hidden" name="productId" value={product.id} />
                <div className="min-w-64 flex-1 space-y-2">
                  <Label htmlFor={`gagal-${o.id}`}>Pemeriksaan gagal karena</Label>
                  <Input
                    id={`gagal-${o.id}`}
                    name="alasan"
                    placeholder="Listing tidak ditemukan"
                    required
                  />
                </div>
                <Button type="submit" variant="ghost">
                  Catat kegagalan
                </Button>
              </form>

              {o.checks.length > 0 ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Riwayat pemeriksaan ({o.checks.length} terakhir)
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs">
                    {o.checks.map((c, i) => (
                      <li key={`${o.id}-${i}`} className="flex flex-wrap gap-2">
                        <span
                          className={
                            c.outcome === "success" ? "text-success" : "text-destructive"
                          }
                        >
                          {c.outcome === "success" ? "Berhasil" : "Gagal"}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(c.attemptedAt).toLocaleString("id-ID")}
                          {c.errorSummary ? `: ${c.errorSummary}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Belum ada penawaran.
        </p>
      )}
      <Notice state={priceState} />

      {product.variants.length > 0 ? (
        <form action={add} className="mt-6 space-y-4 border-t border-border pt-5">
          <p className="text-sm font-semibold text-foreground">Tambah penawaran</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="variantId">Varian</Label>
              <select
                id="variantId"
                name="variantId"
                required
                className="flex min-h-11 w-full rounded-lg border border-border-strong bg-card px-3 text-base text-foreground"
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.ramGb}/{v.storageGb} GB
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="listingStatus">Status listing</Label>
              <select
                id="listingStatus"
                name="listingStatus"
                defaultValue="active"
                className="flex min-h-11 w-full rounded-lg border border-border-strong bg-card px-3 text-base text-foreground"
              >
                <option value="active">Aktif</option>
                <option value="out-of-stock">Habis</option>
                <option value="ambiguous">Ambigu</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketplace">Marketplace</Label>
              <Input id="marketplace" name="marketplace" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellerName">Nama penjual</Label>
              <Input id="sellerName" name="sellerName" required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="url">URL listing</Label>
              <Input id="url" name="url" type="url" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warranty">Garansi</Label>
              <Input id="warranty" name="warranty" placeholder="Boleh kosong" />
            </div>
            <div className="flex items-center gap-2 pt-8">
              <input
                id="sellerVerified"
                name="sellerVerified"
                type="checkbox"
                className="size-4"
              />
              <Label htmlFor="sellerVerified" className="font-normal">
                Penjual terverifikasi (hanya bila ada buktinya)
              </Label>
            </div>
          </div>
          <Button type="submit" disabled={adding}>
            Tambah penawaran
          </Button>
          <Notice state={addState} />
        </form>
      ) : null}
    </section>
  );
}
