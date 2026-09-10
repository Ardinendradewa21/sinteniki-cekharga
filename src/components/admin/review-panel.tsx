"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/admin/actions";
import type { AdminProductDetail } from "@/lib/admin/queries";

/**
 * Kurasi ringkasan review (PRD FR-07).
 *
 * Tiga hal yang membedakan panel ini dari form konten biasa:
 *
 * 1. Tidak ada penggabungan pendapat. Dua reviewer yang menilai produk sama
 *    dengan kesimpulan berbeda sama-sama tersimpan dan sama-sama tampil.
 *    FR-07 secara khusus meminta perbedaan pendapat tidak dihapus.
 * 2. URL video dan timestamp wajib jadi bagian catatan, bukan pelengkap.
 *    Ringkasan pendapat orang lain tanpa jalan untuk memeriksanya adalah klaim
 *    tanpa sumber.
 * 3. Review baru selalu draft. Ringkasan itu membawa nama channel orang lain,
 *    jadi harus ditinjau sebelum terbit.
 */

const INITIAL: ActionState = { error: null };

function Textarea({
  name,
  label,
  hint,
  rows = 3,
  required,
}: {
  name: string;
  label: string;
  hint?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        className="w-full rounded-lg border border-border-strong bg-card px-3 py-2 text-base leading-relaxed text-foreground"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ReviewPanel({
  product,
  addAction,
  statusAction,
  deleteAction,
}: {
  product: AdminProductDetail;
  addAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  statusAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [state, action, pending] = useActionState(addAction, INITIAL);

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-bold text-foreground">Ringkasan review</h2>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Dikurasi manual dari channel pilihan. Kalau dua reviewer berbeda
        pendapat, catat keduanya apa adanya; jangan disatukan menjadi satu
        kesimpulan.
      </p>

      {product.reviews.length > 0 ? (
        <ul className="mt-5 space-y-4">
          {product.reviews.map((r) => (
            <li key={r.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {r.channelName}
                    <span
                      className={
                        r.status === "published"
                          ? "ml-3 rounded-pill bg-success-muted px-2.5 py-0.5 text-xs font-semibold text-success"
                          : "ml-3 rounded-pill bg-warning-muted px-2.5 py-0.5 text-xs font-semibold text-warning"
                      }
                    >
                      {r.status === "published" ? "Terbit" : "Draft"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.aspect} · {new Date(r.publishedAt).toLocaleDateString("id-ID")}
                    {r.variantLabel ? ` · varian ${r.variantLabel}` : " · seluruh varian"}
                    {r.timestampSeconds !== null
                      ? ` · menit ${Math.floor(r.timestampSeconds / 60)}:${String(r.timestampSeconds % 60).padStart(2, "0")}`
                      : ""}
                  </p>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {r.summary}
                  </p>
                  {r.strengths.length > 0 || r.limitations.length > 0 ? (
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      {r.strengths.length > 0 ? (
                        <p>
                          <span className="font-medium text-success">Kelebihan:</span>{" "}
                          {r.strengths.join("; ")}
                        </p>
                      ) : null}
                      {r.limitations.length > 0 ? (
                        <p>
                          <span className="font-medium text-warning">Keterbatasan:</span>{" "}
                          {r.limitations.join("; ")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-2">
                  <form action={statusAction}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <input type="hidden" name="productId" value={product.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={r.status === "published" ? "draft" : "published"}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      {r.status === "published" ? "Tarik" : "Terbitkan"}
                    </Button>
                  </form>
                  <form action={deleteAction}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <input type="hidden" name="productId" value={product.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Hapus
                    </Button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Belum ada ringkasan review.
        </p>
      )}

      <form action={action} className="mt-6 space-y-4 border-t border-border pt-5">
        <p className="text-sm font-semibold text-foreground">Tambah ringkasan</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="channelName">Nama channel</Label>
            <Input id="channelName" name="channelName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aspect">Aspek yang diulas</Label>
            <Input id="aspect" name="aspect" placeholder="Baterai, kamera, performa" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="videoUrl">URL video</Label>
            <Input id="videoUrl" name="videoUrl" type="url" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publishedAt">Tanggal publikasi video</Label>
            <Input id="publishedAt" name="publishedAt" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timestampSeconds">
              Timestamp (detik)
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                boleh kosong
              </span>
            </Label>
            <Input id="timestampSeconds" name="timestampSeconds" type="number" min={0} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="variantId">Berlaku untuk</Label>
            <select
              id="variantId"
              name="variantId"
              defaultValue=""
              className="flex min-h-11 w-full rounded-lg border border-border-strong bg-card px-3 text-base text-foreground"
            >
              <option value="">Seluruh varian</option>
              {product.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  Varian {v.ramGb}/{v.storageGb} GB
                </option>
              ))}
            </select>
          </div>
        </div>

        <Textarea
          name="summary"
          label="Ringkasan temuan"
          hint="Tulis ulang temuan reviewer dengan kalimat sendiri, jangan salin transkrip."
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea name="strengths" label="Kelebihan" hint="Satu per baris." />
          <Textarea name="limitations" label="Keterbatasan" hint="Satu per baris." />
        </div>
        <Textarea
          name="testContext"
          label="Konteks pengujian"
          hint="Mis. pemakaian 5 hari, jaringan 4G, kecerahan otomatis."
          rows={2}
        />

        {state.error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p role="status" className="text-sm font-medium text-success">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          Simpan sebagai draft
        </Button>
      </form>
    </section>
  );
}
