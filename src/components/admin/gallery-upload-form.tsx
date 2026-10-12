"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/admin/file-drop";
import { ImageRightsFields } from "@/components/admin/image-rights-fields";
import { TemplateDownloadButton } from "@/components/admin/template-download-button";
import { previewUploadAction, type PreviewState } from "@/lib/import/batch-actions";

/**
 * Unggah galeri foto per warna (2026-10-12). Memakai aksi unggah yang sama
 * dengan formulir utama: jenis berkas dikenali dari kolomnya, lalu berkas
 * dianalisis di worker dan ditinjau per foto sebelum diterapkan.
 */
export function GalleryUploadForm({ template }: { template: string }) {
  const [state, action, pending] = useActionState<PreviewState, FormData>(previewUploadAction, { error: null });

  return (
    <form action={action} className="rounded-xl border border-border bg-card p-6">
      <FileDrop
        id="berkas-galeri"
        name="berkas"
        required
        label="Berkas galeri (CSV)"
        hint="Satu baris = satu foto. Kolom wajib: brand, model_name, color, image_url. Opsional: urutan, is_cover (ya/tidak), source_url, image_usage_basis, image_usage_rights. Kolom lain diabaikan."
      />

      <ImageRightsFields
        idPrefix="galeri-image"
        hint="Berlaku untuk baris yang tidak membawa kolom image_usage_basis sendiri. Tanpa dasar hak pakai, foto dilewati dengan alasan. Host yang diizinkan bukan berarti fotonya bebas dipakai."
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan berkas..." : "Buat pratinjau galeri"}
        </Button>
        <TemplateDownloadButton content={template} filename="templat-galeri-foto-cekharga.csv">
          Templat galeri foto
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
