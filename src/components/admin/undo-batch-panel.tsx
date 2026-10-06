"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { PreviewState } from "@/lib/import/batch-actions";

/**
 * Konfirmasi undo terbatas. Ringkasannya dihitung server (planUndo); tombol
 * ini hanya meminta konfirmasi lalu menjalankan undo.
 */
export type UndoSummary = {
  removeProducts: string[];
  keepProducts: { label: string; reason: string }[];
  productsUpdated: number;
  removeOffers: number;
  keepOffers: number;
  offersUpdated: number;
  observations: number;
  checks: number;
  /** Catatan harga milik produk terbit yang tidak dihapus. */
  protectedPrices: number;
  /** Foto buatan batch pada produk draft yang tetap ada. */
  removePhotos: number;
  /** Foto buatan batch pada produk terbit (tidak dihapus). */
  protectedPhotos: number;
};

export function UndoBatchPanel({
  summary,
  action,
}: {
  summary: UndoSummary;
  action: () => Promise<PreviewState & { message?: string }>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<PreviewState & { message?: string }>(async () => {
    const result = await action();
    if (!result.error) router.refresh();
    return result;
  }, { error: null });
  const nothing =
    summary.removeProducts.length === 0 &&
    summary.removeOffers === 0 &&
    summary.observations === 0 &&
    summary.checks === 0 &&
    summary.removePhotos === 0;

  return (
    <section aria-labelledby="undo-batch" className="mt-10 rounded-xl border border-destructive/30 bg-card p-5">
      <h2 id="undo-batch" className="text-base font-bold text-foreground">
        Urungkan batch ini
      </h2>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Undo terbatas: hanya menghapus data yang DIBUAT batch ini dan belum disunting, diterbitkan, atau diperbarui
        sejak batch selesai. Perubahan pada data yang sudah ada sebelumnya tidak dikembalikan.
      </p>
      <ul className="mt-3 space-y-1 text-sm text-foreground">
        <li>{summary.removeProducts.length} produk draft akan dihapus (beserta varian, penawaran, dan fotonya)</li>
        <li>{summary.removeOffers} penawaran baru akan dihapus</li>
        <li>
          {summary.observations} catatan harga dan {summary.checks} catatan pemeriksaan dari batch ini akan dihapus
        </li>
        {summary.removePhotos > 0 ? (
          <li>{summary.removePhotos} foto yang ditambahkan batch ini ke produk draft akan dihapus</li>
        ) : null}
        <li>Antrean foto batch ini yang belum diproses dibatalkan</li>
      </ul>
      {summary.keepProducts.length +
        summary.keepOffers +
        summary.productsUpdated +
        summary.offersUpdated +
        summary.protectedPrices +
        summary.protectedPhotos >
      0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Tidak dikembalikan:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {summary.keepProducts.slice(0, 10).map((item) => (
              <li key={item.label}>
                {item.label}: {item.reason}
              </li>
            ))}
            {summary.keepOffers > 0 ? <li>{summary.keepOffers} penawaran baru yang sudah disentuh setelah batch ini atau milik produk terbit</li> : null}
            {summary.productsUpdated > 0 ? <li>{summary.productsUpdated} produk lama yang diperbarui batch ini</li> : null}
            {summary.offersUpdated > 0 ? <li>{summary.offersUpdated} penawaran lama yang diperbarui batch ini</li> : null}
            {summary.protectedPrices > 0 ? (
              <li>{summary.protectedPrices} catatan harga milik produk yang sudah terbit (halaman publiknya tidak diubah)</li>
            ) : null}
            {summary.protectedPhotos > 0 ? (
              <li>{summary.protectedPhotos} foto yang ditambahkan ke produk yang sudah terbit</li>
            ) : null}
            <li>Foto lama yang diganti batch ini (isi lamanya sudah tidak tersimpan)</li>
          </ul>
        </div>
      ) : null}
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm("Urungkan batch ini? Data yang disebut di atas akan dihapus permanen.")) event.preventDefault();
        }}
        className="mt-4 flex flex-wrap items-center gap-3"
      >
        <Button type="submit" variant="destructive" disabled={pending || nothing}>
          {pending ? "Mengurungkan…" : nothing ? "Tidak ada yang bisa diurungkan" : "Urungkan batch"}
        </Button>
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : state.message ? (
          <p role="status" className="text-sm text-foreground">
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
