"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { importCsvAction } from "@/lib/import/actions";
import { EMPTY_REPORT, type ImportReport } from "@/lib/import/report";

/**
 * Form impor CSV.
 *
 * Laporan hasilnya sengaja rinci: berapa yang masuk, berapa yang diperbarui,
 * dan APA ALASAN tiap baris yang dilewati. Impor yang cuma bilang "berhasil"
 * membuat data hilang diam-diam tanpa ada yang tahu.
 */
export function ImportForm() {
  const [report, action, pending] = useActionState<ImportReport, FormData>(
    importCsvAction,
    EMPTY_REPORT
  );

  return (
    <div className="space-y-6">
      <form action={action} className="rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="berkas">Berkas CSV</Label>
          <input
            id="berkas"
            name="berkas"
            type="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm text-foreground file:mr-4 file:min-h-11 file:rounded-pill file:border file:border-border-strong file:bg-card file:px-4 file:text-sm file:font-medium file:text-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Kolom yang dibaca mengikuti format ekspor GSMArena. Harga di berkas
            tidak pernah diimpor.
          </p>
        </div>

        <Button type="submit" className="mt-5" disabled={pending}>
          {pending ? "Memproses..." : "Impor sebagai draft"}
        </Button>

        {report.error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-destructive">
            {report.error}
          </p>
        ) : null}
      </form>

      {report.summary ? (
        <section role="status" className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Hasil impor</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Baris terbaca</dt>
              <dd className="text-lg font-bold text-foreground">{report.summary.totalRows}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Produk baru</dt>
              <dd className="text-lg font-bold text-success">{report.summary.created}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Diperbarui</dt>
              <dd className="text-lg font-bold text-foreground">{report.summary.updated}</dd>
            </div>
          </dl>

          {report.summary.malformedLines.length > 0 ? (
            <p className="mt-4 text-sm text-warning">
              {report.summary.malformedLines.length} baris diabaikan karena jumlah
              kolomnya tidak cocok header (baris{" "}
              {report.summary.malformedLines.slice(0, 10).join(", ")}
              {report.summary.malformedLines.length > 10 ? ", dan seterusnya" : ""}).
            </p>
          ) : null}

          {report.summary.skipped.length > 0 ? (
            <div className="mt-5 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">
                {report.summary.skipped.length} baris dilewati, beserta alasannya
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {report.summary.skipped.map((s, i) => (
                  <li key={`${s.label}-${i}`}>
                    <span className="font-medium text-foreground">{s.label}</span>: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Semua baris terbaca tanpa ada yang dilewati.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
