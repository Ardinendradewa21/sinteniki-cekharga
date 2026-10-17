import Image from "next/image";

import { PhotoActionForm } from "@/components/admin/photo-action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  changePhotoColorAction,
  deletePhotoAction,
  movePhotoAction,
  setCoverAction,
} from "@/lib/admin/photo-admin-actions";
import type { AdminPhoto } from "@/lib/admin/product-photos";
import { IMAGE_USAGE_BASIS_LABELS, isImageUsageBasis } from "@/lib/import/image-rights";
import { MAX_PHOTOS_PER_COLOR, MAX_UNCOLORED_PHOTOS } from "@/lib/import/photo-rules";

/**
 * Panel foto per warna di halaman sunting produk (2026-10-12). Urutan di
 * panel = urutan di situs publik: sampul dulu, lalu urutan foto.
 *
 * Semua aksi berupa tombol biasa (bisa dipakai lewat keyboard, target 44 px).
 * Hapus memakai <details> sebagai konfirmasi: dua langkah, tanpa dialog JS.
 */
export function ProductPhotoManager({
  productId,
  groups,
  colorChoices,
}: {
  productId: string;
  groups: { color: string | null; photos: AdminPhoto[] }[];
  colorChoices: string[];
}) {
  const total = groups.reduce((sum, group) => sum + group.photos.length, 0);
  return (
    <section aria-labelledby="foto-per-warna" className="rounded-xl border border-border bg-card p-5">
      <h2 id="foto-per-warna" className="text-base font-bold text-foreground">
        Foto per warna
        <span className="ml-2 text-sm font-normal text-muted-foreground">{total} foto</span>
      </h2>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Paling banyak {MAX_PHOTOS_PER_COLOR} foto per warna dan {MAX_UNCOLORED_PHOTOS} foto umum. Sampul tampil paling
        depan saat warna itu dipilih di situs. Menghapus foto juga menghapus berkasnya dari storage.
      </p>

      {total === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Belum ada foto. Tambahkan lewat CSV gabungan di Pusat Impor (baris foto: color, image_url, urutan, is_cover).
        </p>
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map((group) => {
            const movable = group.photos.filter((photo) => !photo.is_cover);
            return (
              <div key={group.color ?? "umum"}>
                <h3 className="text-sm font-semibold text-foreground">
                  {group.color ?? "Foto umum (tanpa warna)"}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {group.photos.length}/{group.color ? MAX_PHOTOS_PER_COLOR : MAX_UNCOLORED_PHOTOS}
                  </span>
                </h3>
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {group.photos.map((photo) => {
                    const position = movable.findIndex((row) => row.id === photo.id);
                    return (
                      <li key={photo.id} className="flex flex-wrap items-start gap-4 p-3">
                        <span className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                          <Image src={photo.src} alt={photo.alt} fill sizes="80px" className="object-contain p-1" />
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {photo.is_cover ? <Badge>Sampul</Badge> : null}
                            <span>Sumber: {photo.source}</span>
                            <span>
                              · Hak pakai:{" "}
                              {isImageUsageBasis(photo.usage_basis) ? IMAGE_USAGE_BASIS_LABELS[photo.usage_basis] : photo.usage_basis}
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {!photo.is_cover ? (
                              <>
                                <PhotoActionForm action={movePhotoAction} productId={productId} photoId={photo.id} hidden={{ direction: "up" }}>
                                  <Button type="submit" size="sm" variant="outline" disabled={position <= 0} aria-label={`Naikkan foto ${photo.alt}`}>
                                    Naik
                                  </Button>
                                </PhotoActionForm>
                                <PhotoActionForm action={movePhotoAction} productId={productId} photoId={photo.id} hidden={{ direction: "down" }}>
                                  <Button
                                    type="submit"
                                    size="sm"
                                    variant="outline"
                                    disabled={position < 0 || position >= movable.length - 1}
                                    aria-label={`Turunkan foto ${photo.alt}`}
                                  >
                                    Turun
                                  </Button>
                                </PhotoActionForm>
                                <PhotoActionForm action={setCoverAction} productId={productId} photoId={photo.id}>
                                  <Button type="submit" size="sm" variant="outline">
                                    Jadikan sampul
                                  </Button>
                                </PhotoActionForm>
                              </>
                            ) : null}
                          </div>
                          <PhotoActionForm action={changePhotoColorAction} productId={productId} photoId={photo.id}>
                            <label htmlFor={`warna-${photo.id}`} className="text-xs text-muted-foreground">
                              Pindah ke warna
                            </label>
                            <select
                              id={`warna-${photo.id}`}
                              name="color"
                              defaultValue={photo.color ?? ""}
                              className="min-h-11 rounded-lg border border-border-strong bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <option value="">Tanpa warna (foto umum)</option>
                              {colorChoices.map((color) => (
                                <option key={color} value={color}>
                                  {color}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" size="sm" variant="outline">
                              Pindahkan
                            </Button>
                          </PhotoActionForm>
                          <details>
                            <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-destructive">
                              Hapus foto
                            </summary>
                            <PhotoActionForm action={deletePhotoAction} productId={productId} photoId={photo.id} className="mt-2">
                              <Button type="submit" size="sm" variant="destructive">
                                Ya, hapus foto ini
                              </Button>
                            </PhotoActionForm>
                          </details>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
