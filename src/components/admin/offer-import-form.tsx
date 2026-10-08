"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/admin/file-drop";
import { ImageRightsFields } from "@/components/admin/image-rights-fields";
import { TemplateDownloadButton } from "@/components/admin/template-download-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewOffersAction, type PreviewState } from "@/lib/import/batch-actions";

/**
 * Impor penawaran dan harga lewat batch pratinjau.
 *
 * Laporannya memisahkan tiga angka yang maknanya berbeda: penawaran baru,
 * penawaran yang diperbarui, dan harga yang tercatat. Menggabungkannya jadi
 * satu angka "berhasil" akan menyembunyikan hal penting, misalnya penawaran
 * masuk tetapi harganya gagal tercatat.
 */
export function OfferImportForm({
  template,
  shopeeTemplate,
}: {
  template: string;
  shopeeTemplate: string;
}) {
  const [state, action, pending] = useActionState<PreviewState, FormData>(
    previewOffersAction,
    { error: null }
  );

  return (
    <div className="space-y-6">
      <form action={action} className="rounded-xl border border-border bg-card p-6">
        <FileDrop
          id="berkas-penawaran"
          name="berkas"
          required
          lastModifiedName="file_last_modified"
          label="Berkas CSV penawaran"
          hint="Menerima templat CekHarga, hasil scraping Shopee, dan ekspor ekstensi browser dari erafone.com (kolom boleh bergeser; dibaca menurut isinya). Judul Shopee tanpa memori hanya memakai varian dasar bila RAM katalog seragam dan penyimpanan terkecilnya tunggal; judul Erafone tanpa memori dilewati."
        />

        <ImageRightsFields
          idPrefix="offer-image"
          hint="Bila dasar hak pakai dipilih, foto tiap warna dari listing (saat ini Erafone) diunduh, latar putihnya dihapus, lalu ditambahkan ke galeri produk (maksimal 8 foto per produk). Lewati bila hak pakainya belum jelas; harga tetap diimpor tanpa foto."
        />

        <div className="mt-5 space-y-2 rounded-xl border border-border bg-muted/30 p-4">
          <Label htmlFor="seller-name">Nama toko default (opsional)</Label>
          <Input
            id="seller-name"
            name="seller_name"
            maxLength={160}
            placeholder="Contoh: Xiaomi Official Store"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dipakai hanya bila CSV tidak mempunyai <code>seller_name</code>. Untuk
            judul bertanda Official Store, sistem mencoba membentuk nama toko,
            tetapi tidak otomatis memberi badge terverifikasi. Jika nama toko
            tetap tidak diketahui, sistem memakai label netral berdasarkan ID
            toko pada URL Shopee.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Rating, jumlah terjual, dan URL gambar tetap boleh ada di CSV, tetapi
            tidak dimasukkan sebagai harga atau bukti seller terverifikasi.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Gunakan <code>scraped_at</code> atau <code>observed_at</code> untuk
            waktu harga. File lama tanpa kolom tersebut memakai waktu terakhir
            berkas diubah.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Menyiapkan pratinjau..." : "Buat pratinjau"}
          </Button>
          <TemplateDownloadButton content={template} filename="templat-penawaran-cekharga.csv">
            Templat CekHarga
          </TemplateDownloadButton>
          <TemplateDownloadButton content={shopeeTemplate} filename="templat-scraper-shopee.csv">
            Templat scraper Shopee
          </TemplateDownloadButton>
        </div>

        {state.error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>

    </div>
  );
}
