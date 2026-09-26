"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/admin/file-drop";
import { ImageRightsFields } from "@/components/admin/image-rights-fields";
import { previewSpecsAction, type PreviewState } from "@/lib/import/batch-actions";

/**
 * Form impor CSV spesifikasi. Berkas tidak langsung ditulis: hasil
 * penyeragamannya disimpan sebagai batch pratinjau dulu, lalu admin meninjau
 * tabelnya sebelum menerapkan.
 */
export function ImportForm() {
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
          hint="Kolom yang dibaca mengikuti format ekspor GSMArena. Harga di berkas tidak pernah diimpor."
        />

        <ImageRightsFields
          idPrefix="spec-image"
          hint="CSV boleh memakai kolom image_url atau marketplace_image_url. Pilihan ini berlaku untuk foto yang tidak membawa kolom image_usage_rights sendiri. Tanpa dasar hak pakai, spesifikasi tetap masuk dan foto dilewati. Foto yang valid diperkecil maksimal 1200 px, latar putihnya dihapus, lalu disimpan sebagai WebP."
        />

        <Button type="submit" className="mt-5" disabled={pending}>
          {pending ? "Menyiapkan pratinjau..." : "Buat pratinjau"}
        </Button>

        {state.error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>

    </div>
  );
}
