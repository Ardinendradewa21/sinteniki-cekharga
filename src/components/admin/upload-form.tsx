"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/admin/file-drop";
import { ImageRightsFields } from "@/components/admin/image-rights-fields";
import { TemplateDownloadButton } from "@/components/admin/template-download-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewUploadAction, type PreviewState } from "@/lib/import/batch-actions";

const PARTS = [
  {
    value: "offers",
    title: "Penawaran & harga",
    body: "Baris yang mengisi offer_url, harga, atau toko. Harga hanya menempel ke varian yang ada.",
  },
  {
    value: "photos",
    title: "Foto per warna",
    body: "Baris yang mengisi image_url dan color, dengan urutan dan is_cover. Mengikuti aturan galeri.",
  },
] as const;

/**
 * Formulir unggah CSV gabungan (Sprint 8-9, 2026-10-17).
 *
 * Satu berkas boleh berisi baris penawaran dan foto sekaligus, atau salah
 * satunya saja. Admin memilih bagian yang ingin diimpor; kolom bagian lain
 * diabaikan saat analisis. Produk baru dan spesifikasi tidak lewat CSV,
 * melainkan lewat Tarik otomatis. Berkas tidak langsung ditulis: unggahan
 * disimpan, dianalisis di worker, lalu ditinjau per tahap (harga, lalu foto).
 */
export function UploadForm({ template }: { template: string }) {
  const [state, action, pending] = useActionState<PreviewState, FormData>(previewUploadAction, { error: null });
  const [parts, setParts] = useState<Set<string>>(() => new Set(PARTS.map((part) => part.value)));
  const toggle = (value: string) =>
    setParts((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  return (
    <form action={action} className="rounded-xl border border-border bg-card p-6">
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">Bagian yang diimpor dari berkas ini</legend>
        <p className="mt-1 text-xs text-muted-foreground">
          Satu berkas boleh berisi keduanya. Bagian yang tidak dicentang diabaikan walau kolomnya terisi.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PARTS.map((part) => (
            <label
              key={part.value}
              className="flex min-h-11 cursor-pointer gap-3 rounded-lg border border-border bg-background p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-muted/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="checkbox"
                name="bagian"
                value={part.value}
                checked={parts.has(part.value)}
                onChange={() => toggle(part.value)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
              />
              <span>
                <span className="block text-sm font-semibold text-foreground">{part.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{part.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <FileDrop
          id="berkas"
          name="berkas"
          required
          // Tanggal berkas dipakai sebagai waktu pengamatan harga bila kolom observed_at kosong.
          lastModifiedName="file_last_modified"
          label="Berkas CSV gabungan"
          hint="Ekspor sheet sebagai CSV. Satu baris boleh membawa penawaran dan foto sekaligus; kolom yang tidak dipakai biarkan kosong. Kolom spesifikasi di sheet lama diabaikan. Hasil scraper Shopee dan ekspor erafone.com tetap dikenali otomatis."
        />
      </div>

      {parts.has("photos") ? (
        <ImageRightsFields
          idPrefix="upload-image"
          hint="Berlaku untuk foto yang tidak membawa kolom image_usage_basis sendiri. Tanpa dasar hak pakai, data lain tetap masuk dan fotonya dilewati. Foto diperkecil maksimal 1200 px, tepi dan latar polosnya dirapikan, lalu disimpan sebagai WebP."
        />
      ) : null}

      <details className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-foreground">
          Opsi lanjutan: berkas hasil scraper Shopee
        </summary>
        <div className="mt-3 space-y-2">
          <Label htmlFor="seller-name">Nama toko default (opsional)</Label>
          <Input id="seller-name" name="seller_name" maxLength={160} placeholder="Contoh: Xiaomi Official Store" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dipakai hanya untuk baris Shopee yang tidak punya kolom <code>seller_name</code>. Judul bertanda Official
            Store tidak otomatis mendapat badge terverifikasi; tanpa nama toko, sistem memakai label netral dari ID toko
            pada URL Shopee. Rating dan jumlah terjual di berkas tidak pernah dipakai.
          </p>
        </div>
      </details>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || parts.size === 0}>
          {pending ? "Menyimpan berkas..." : "Buat pratinjau"}
        </Button>
        <TemplateDownloadButton content={template} filename="templat-csv-gabungan-cekharga.csv">
          Unduh templat CSV gabungan
        </TemplateDownloadButton>
      </div>
      {parts.size === 0 ? <p className="mt-2 text-sm text-warning">Pilih minimal satu bagian.</p> : null}

      {state.error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
