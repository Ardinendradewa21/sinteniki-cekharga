"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { reprocessPhotosAction } from "@/lib/import/photo-actions";
import { EMPTY_PHOTO_REPORT, type PhotoReprocessReport } from "@/lib/import/report";

/**
 * Tombol proses ulang foto lama: mengunduh ulang dari URL asli dan menyimpan
 * versi berlatar transparan. Berjalan per batch; klik lagi selama sisanya > 0.
 */
export function PhotoReprocessForm() {
  const [report, action, pending] = useActionState<PhotoReprocessReport, FormData>(
    reprocessPhotosAction,
    EMPTY_PHOTO_REPORT
  );
  const summary = report.summary;

  return (
    <form action={action} className="rounded-xl border border-border bg-card p-6">
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        Foto yang diimpor sebelum latar putih dihapus masih tampil sebagai kotak
        putih di mode gelap. Tombol ini mengunduh ulang foto dari sumber aslinya
        dan menyimpannya dengan latar transparan. Foto yang ponselnya menempel
        ke tepi bingkai dibiarkan apa adanya supaya objeknya tidak terpotong.
      </p>

      <div className="mt-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Memproses foto..." : "Proses ulang foto lama"}
        </Button>
      </div>

      {report.error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {report.error}
        </p>
      ) : null}

      {summary ? (
        <div role="status" className="mt-5 space-y-2 text-sm text-foreground">
          <p>
            <span className="font-semibold text-success">{summary.processed}</span> foto
            diproses ulang.{" "}
            {summary.remaining > 0
              ? `${summary.remaining} foto lama tersisa; klik lagi untuk melanjutkan.`
              : "Semua foto sudah memakai versi terbaru."}
          </p>
          {summary.withoutOrigin > 0 ? (
            <p className="text-muted-foreground">
              {summary.withoutOrigin} foto tidak menyimpan URL asli, jadi harus
              diimpor ulang lewat CSV spesifikasi.
            </p>
          ) : null}
          {summary.failed.length > 0 ? (
            <ul className="space-y-1 text-muted-foreground">
              {summary.failed.slice(0, 20).map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <span className="font-medium text-foreground">{item.label}</span>:{" "}
                  {item.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
