import Link from "next/link";
import type { Metadata } from "next";

import { ImportForm } from "@/components/admin/import-form";
import { OfferImportForm } from "@/components/admin/offer-import-form";
import { PhotoReprocessForm } from "@/components/admin/photo-reprocess-form";
import {
  templatePenawaran,
  templateShopeeScrape,
} from "@/lib/import/offers";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/dal";
import { listBatches } from "@/lib/import/batches";

export const metadata: Metadata = {
  title: "Pusat Impor",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BATCH_STATUS = {
  draft: { label: "Menunggu ditinjau", tone: "bg-brand-muted text-brand" },
  applied: { label: "Diterapkan", tone: "bg-success-muted text-success" },
  discarded: { label: "Dibatalkan", tone: "bg-muted text-muted-foreground" },
} as const;

export default async function ImportPage() {
  await requireAdmin();
  const batches = await listBatches(12).catch(() => null);

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Pusat Impor
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Semua sumber data (CSV spesifikasi, CSV penawaran dari Shopee atau
            Erafone, dan tarik otomatis) diseragamkan dulu menjadi batch
            pratinjau. Tinjau tabelnya, lalu terapkan baris yang dipilih. Produk
            baru selalu masuk sebagai draft.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/products">Kelola produk</Link>
        </Button>
      </div>

      <section aria-labelledby="batch-terbaru" className="mt-8">
        <h2 id="batch-terbaru" className="text-lg font-bold text-foreground">
          Batch terbaru
        </h2>
        {batches === null ? (
          <p className="mt-3 text-sm text-destructive">Daftar batch gagal dibaca.</p>
        ) : batches.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Belum ada batch. Unggah berkas di bawah atau kirim hasil dari Tarik otomatis.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {batches.map((batch) => (
              <li key={batch.id}>
                <Link
                  href={`/admin/import/batch/${batch.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {batch.sourceLabel}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {batch.kind === "specs" ? "Spesifikasi" : "Penawaran"} ·{" "}
                      {batch.origin === "scrape" ? "Tarik otomatis" : "CSV"} ·{" "}
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jakarta",
                      }).format(new Date(batch.createdAt))}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground tabular">
                      {batch.counts.create ?? 0} baru · {batch.counts.update ?? 0} berubah ·{" "}
                      {batch.counts.skip ?? 0} dilewati
                    </span>
                    <span className={`rounded-pill px-2.5 py-0.5 font-semibold ${BATCH_STATUS[batch.status].tone}`}>
                      {BATCH_STATUS[batch.status].label}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 rounded-xl border border-border bg-warning-muted p-5">
        <p className="text-sm font-semibold text-warning">
          Yang tidak ikut diimpor
        </p>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground">
          <li>
            Harga. Kolom harga di dataset ini berisi harga referensi
            internasional dengan mata uang campur, termasuk Rupee India yang
            simbolnya mirip Rupiah. Harga hanya boleh berasal dari penawaran
            marketplace yang dicatat beserta waktu pemeriksaannya.
          </li>
          <li>
            Perangkat selain smartphone. Tablet dan jam tangan dilewati dengan
            alasan yang dinyatakan, bukan disimpan diam-diam.
          </li>
          <li>
            Ulasan reviewer. Kurasinya manual dari channel pilihan, tidak pernah
            ditarik otomatis.
          </li>
        </ul>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Spesifikasi produk
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Mengisi identitas dan spesifikasi dari dataset. Hasilnya masuk sebagai
          draft.
        </p>
        <div className="mt-5">
          <ImportForm />
        </div>
      </section>

      <section className="mt-12 border-t border-border pt-10">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Penawaran dan harga
        </h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Mengisi listing marketplace beserta harganya sekaligus. Hasil scraping
          Shopee dan ekspor ekstensi browser dari erafone.com dipraproses
          otomatis. Produk dan varian harus sudah ada; listing multi-varian atau
          nama yang tidak cocok tepat akan dilewati agar harga tidak menempel ke
          produk yang salah.
        </p>
        <div className="mt-5">
          <OfferImportForm
            template={templatePenawaran()}
            shopeeTemplate={templateShopeeScrape()}
          />
        </div>
      </section>

      <section className="mt-12 border-t border-border pt-10">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Foto produk
        </h2>
        <div className="mt-5">
          <PhotoReprocessForm />
        </div>
      </section>
    </Container>
  );
}
