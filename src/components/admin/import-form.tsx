"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/admin/file-drop";
import { ImageRightsFields } from "@/components/admin/image-rights-fields";
import { TemplateDownloadButton } from "@/components/admin/template-download-button";
import { previewSpecsAction, type PreviewState } from "@/lib/import/batch-actions";

/**
 * Form impor CSV spesifikasi. Berkas tidak langsung ditulis: hasil
 * penyeragamannya disimpan sebagai batch pratinjau dulu, lalu admin meninjau
 * tabelnya sebelum menerapkan.
 */
export function ImportForm({ template }: { template: string }) {
  const [state, action, pending] = useActionState<PreviewState, FormData>(
    previewSpecsAction,
    { error: null }
  );

  return (
    <div className="space-y-6">
      <form action={action} className="rounded-xl border border-border bg-card p-6">
        <FileDrop
          id="berkas"
          name="berkas"
          required
          label="Berkas CSV"
          hint="Kolom mengikuti format ekspor GSMArena; unduh templat untuk daftar kolom yang dibaca. Wajib: brand, model_name, memory_variants_summary, dan url GSMArena sebagai kunci produk. Harga di berkas tidak pernah diimpor."
        />

        <ImageRightsFields
          idPrefix="spec-image"
          hint="CSV boleh memakai kolom image_url atau marketplace_image_url. Pilihan ini berlaku untuk foto yang tidak membawa kolom image_usage_rights sendiri. Tanpa dasar hak pakai, spesifikasi tetap masuk dan foto dilewati. Foto yang valid diperkecil maksimal 1200 px, latar putihnya dihapus, lalu disimpan sebagai WebP."
        />

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Menyiapkan pratinjau..." : "Buat pratinjau"}
          </Button>
          <TemplateDownloadButton content={template} filename="templat-spesifikasi-cekharga.csv">
            Templat spesifikasi
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
