"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/admin/file-drop";
import { ImageRightsFields } from "@/components/admin/image-rights-fields";
import { TemplateDownloadButton } from "@/components/admin/template-download-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewUploadAction, type PreviewState } from "@/lib/import/batch-actions";

/**
 * Satu formulir unggah untuk semua data impor (2026-10-11).
 *
 * Jenis berkas dikenali dari isinya (canonical.ts `detectFileKind`), jadi
 * tidak ada lagi formulir terpisah untuk spesifikasi dan penawaran. Berkas
 * tidak langsung ditulis: unggahan disimpan, dianalisis di worker, lalu admin
 * meninjau pratinjaunya per produk sebelum menerapkan.
 *
 * Templat terpadu adalah templat utama; templat format lama tetap bisa
 * diunduh untuk berkas yang sudah ada di tim.
 */
export function UploadForm({
  templates,
}: {
  templates: { unified: string; specs: string; offers: string; shopee: string };
}) {
  const [state, action, pending] = useActionState<PreviewState, FormData>(previewUploadAction, { error: null });

  return (
    <form action={action} className="rounded-xl border border-border bg-card p-6">
      <FileDrop
        id="berkas"
        name="berkas"
        required
        // Tanggal berkas dipakai sebagai waktu pengamatan harga bila kolom observed_at kosong.
        lastModifiedName="file_last_modified"
        label="Berkas CSV"
        hint="Templat terpadu: spesifikasi dan harga dalam satu berkas, kolom boleh kosong. Format lama tetap diterima: ekspor GSMArena, templat penawaran, hasil scraper Shopee, dan ekspor ekstensi erafone.com. Jenis berkas dikenali dari isinya."
      />

      <ImageRightsFields
        idPrefix="upload-image"
        hint="Berlaku untuk foto di berkas (kolom image_url, marketplace_image_url, atau foto listing Erafone) yang tidak membawa kolom image_usage_rights sendiri. Tanpa dasar hak pakai, data tetap masuk dan foto dilewati. Foto yang valid diperkecil maksimal 1200 px, latar putihnya dihapus, lalu disimpan sebagai WebP."
      />

      <details className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-foreground">
          Opsi lanjutan: berkas scraper Shopee
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
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan berkas..." : "Buat pratinjau"}
        </Button>
        <TemplateDownloadButton content={templates.unified} filename="templat-terpadu-cekharga.csv">
          Templat terpadu
        </TemplateDownloadButton>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted-foreground">
        <span>Format lama:</span>
        <TemplateDownloadButton variant="link" content={templates.specs} filename="templat-spesifikasi-cekharga.csv">
          Templat spesifikasi
        </TemplateDownloadButton>
        <TemplateDownloadButton variant="link" content={templates.offers} filename="templat-penawaran-cekharga.csv">
          Templat penawaran
        </TemplateDownloadButton>
        <TemplateDownloadButton variant="link" content={templates.shopee} filename="templat-scraper-shopee.csv">
          Templat scraper Shopee
        </TemplateDownloadButton>
      </div>

      {state.error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
