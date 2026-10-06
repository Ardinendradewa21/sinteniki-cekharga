import Link from "next/link";
import type { Metadata } from "next";

import { ImportForm } from "@/components/admin/import-form";
import { OfferImportForm } from "@/components/admin/offer-import-form";
import { PhotoReprocessForm } from "@/components/admin/photo-reprocess-form";
import { ScrapeWorkbench } from "@/components/admin/scrape-workbench";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/dal";
import {
  batchAgeDays,
  batchStatusView,
  DRAFT_TTL_DAYS,
} from "@/lib/import/batch-status";
import { listBatches, type BatchSummary } from "@/lib/import/batches";
import { templatePenawaran, templateShopeeScrape } from "@/lib/import/offers";
import { photoJobCounts } from "@/lib/import/photo-jobs";
import { getSession, listRecentSessions } from "@/lib/scrape/sessions";
import { SCRAPE_BRAND_LABELS, scrapeBrandOf, type ScrapeBrand } from "@/lib/scrape/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pusat Impor",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
/** Batas waktu Server Action di halaman ini (unggah, tarik otomatis, proses foto). */
export const maxDuration = 60;

/**
 * Pusat Impor: satu pintu untuk semua sumber data (rencana kerja impor, Fase 3.3).
 *
 *   Unggah CSV     — spesifikasi (dataset GSMArena) dan penawaran (templat,
 *                    Shopee, Erafone).
 *   Tarik otomatis — daftar + harga dari situs resmi, spesifikasi dari GSMArena.
 *   Foto           — antrean foto produk dan proses ulang foto lama.
 *   Riwayat        — semua batch beserta statusnya.
 *
 * Semua sumber berakhir di tempat yang sama: batch pratinjau → tinjau →
 * terapkan bertahap. Tidak ada yang menulis katalog tanpa lewat batch.
 */

const TABS = [
  { id: "unggah", label: "Unggah CSV" },
  { id: "tarik", label: "Tarik otomatis" },
  { id: "foto", label: "Foto" },
  { id: "riwayat", label: "Riwayat batch" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(
    new Date(value)
  );
}

async function BatchList({ limit }: { limit: number }) {
  const batches = await listBatches(limit).catch(() => null);
  const now = new Date();
  if (batches === null) return <p className="mt-3 text-sm text-destructive">Daftar batch gagal dibaca.</p>;
  if (batches.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Belum ada batch. Unggah berkas atau kirim hasil dari Tarik otomatis.
      </p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {batches.map((batch) => (
        <li key={batch.id}>
          <Link
            href={`/admin/import/batch/${batch.id}`}
            className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{batch.sourceLabel}</span>
              <span className="block text-xs text-muted-foreground">
                {batch.kind === "specs" ? "Spesifikasi" : "Penawaran"} ·{" "}
                {ORIGIN_LABEL[batch.origin]} · {formatTime(batch.createdAt)}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground tabular">
                {batch.progress
                  ? `${batch.progress.done} berhasil · ${batch.progress.failed} gagal dari ${batch.progress.total}`
                  : `${batch.counts.create ?? 0} baru · ${batch.counts.update ?? 0} berubah · ${batch.counts.skip ?? 0} dilewati`}
              </span>
              {batch.status === "draft" && !batchStatusView(batch, now).expired ? (
                <span className="text-muted-foreground">
                  {(() => {
                    const left = DRAFT_TTL_DAYS - batchAgeDays(batch.createdAt, now);
                    return left <= 1 ? "kedaluwarsa besok" : `kedaluwarsa ${left} hari lagi`;
                  })()}
                </span>
              ) : null}
              <span className={`rounded-pill px-2.5 py-0.5 font-semibold ${batchStatusView(batch, now).tone}`}>
                {batchStatusView(batch, now).label}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const ORIGIN_LABEL: Record<BatchSummary["origin"], string> = {
  csv: "CSV",
  scrape: "Tarik otomatis",
  schedule: "Pemeriksaan harian",
};

function UploadTab() {
  return (
    <div className="space-y-10">
      <div className="rounded-xl border border-border bg-warning-muted p-5">
        <p className="text-sm font-semibold text-warning">Yang tidak ikut diimpor</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground">
          <li>
            Harga dari dataset spesifikasi. Kolom harganya berisi harga referensi internasional dengan mata uang campur,
            termasuk Rupee India yang simbolnya mirip Rupiah. Harga hanya boleh berasal dari penawaran marketplace yang
            dicatat beserta waktu pemeriksaannya.
          </li>
          <li>Perangkat selain smartphone. Tablet dan jam tangan dilewati dengan alasan yang dinyatakan.</li>
          <li>Ulasan reviewer. Kurasinya manual dari channel pilihan, tidak pernah ditarik otomatis.</li>
        </ul>
      </div>

      <section>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Spesifikasi produk</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Mengisi identitas dan spesifikasi dari dataset. Hasilnya masuk sebagai draft.
        </p>
        <div className="mt-5">
          <ImportForm />
        </div>
      </section>

      <section className="border-t border-border pt-10">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Penawaran dan harga</h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Mengisi listing marketplace beserta harganya sekaligus. Hasil scraping Shopee dan ekspor ekstensi browser dari
          erafone.com dipraproses otomatis. Produk dan varian harus sudah ada; listing multi-varian atau nama yang tidak
          cocok tepat akan dilewati agar harga tidak menempel ke produk yang salah.
        </p>
        <div className="mt-5">
          <OfferImportForm template={templatePenawaran()} shopeeTemplate={templateShopeeScrape()} />
        </div>
      </section>
    </div>
  );
}

async function ScrapeTab({
  sessionId,
  brand,
  search,
}: {
  sessionId: string | null;
  brand: ScrapeBrand | null;
  search: string;
}) {
  const [session, recent] = await Promise.all([sessionId ? getSession(sessionId) : null, listRecentSessions(5)]);
  return (
    <div className="space-y-6">
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        Daftar model dan harga per varian diambil dari situs resmi merek, spesifikasinya dari GSMArena. Hasilnya
        disimpan sebagai sesi di server, jadi aman bila halaman dimuat ulang. Model yang dikirim masuk ke batch pratinjau
        bersama harga resminya; produk baru tetap draft.
      </p>

      <div className="rounded-xl border border-border bg-warning-muted p-5">
        <p className="text-sm font-semibold text-warning">Batasan yang perlu diketahui</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground">
          <li>
            Harga berasal dari teks di situs resmi pada saat diambil, dan waktu itu yang dicatat sebagai waktu
            pemeriksaan. Situs resmi juga memuat model lama; periksa temuan kuning sebelum menyimpan.
          </li>
          <li>Pengambilan sengaja pelan dan berhenti bila situs sumber meminta verifikasi anti-bot. Verifikasi itu tidak ditembus.</li>
          <li>Produk yang sudah terbit tidak diturunkan menjadi draft; hanya spesifikasinya yang diperbarui.</li>
        </ul>
      </div>

      {recent.length > 0 ? (
        <section aria-labelledby="sesi-terakhir">
          <h2 id="sesi-terakhir" className="text-sm font-bold text-foreground">
            Sesi terakhir
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recent.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/import?tab=tarik&sesi=${item.id}`}
                  aria-current={item.id === session?.id ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-pill border px-3.5 text-sm transition-colors",
                    item.id === session?.id ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <span className="font-semibold">{SCRAPE_BRAND_LABELS[item.brand]?.split(" (")[0] ?? item.brand}</span>
                  <span className="text-xs opacity-80">
                    {item.resolved}/{item.models} model · {formatTime(item.fetchedAt)}
                    {item.status === "committed" ? " · terkirim" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sessionId && !session ? (
        <p role="alert" className="text-sm text-destructive">Sesi tarik tidak ditemukan. Muat daftar model baru.</p>
      ) : null}

      {/* key: pindah sesi = mulai dari state sesi itu, bukan sisa sesi sebelumnya. */}
      <ScrapeWorkbench key={session?.id ?? "baru"} initialSession={session} initialBrand={brand} initialFilter={search} />
    </div>
  );
}

async function PhotoTab() {
  const counts = await photoJobCounts();
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-bold text-foreground">Antrean foto</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Foto dari impor diproses terpisah dari data produk: diunduh, dibersihkan latarnya, lalu disimpan.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["Menunggu", counts.pending + counts.running, "text-foreground"],
              ["Tersimpan", counts.done, "text-success"],
              ["Gagal", counts.failed, "text-destructive"],
              ["Dilewati", counts.skipped, "text-muted-foreground"],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className={cn("text-lg font-bold tabular", tone)}>{value}</dd>
            </div>
          ))}
        </dl>
        {counts.failed > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Alasan foto yang gagal terlihat di halaman sunting produknya, beserta tombol coba ulang.
          </p>
        ) : null}
      </section>
      <PhotoReprocessForm />
    </div>
  );
}

export default async function ImportPage(props: PageProps<"/admin/import">) {
  await requireStaff([]);
  const params = await props.searchParams;
  const requested = typeof params.tab === "string" ? params.tab : "";
  const tab: TabId = TABS.some((item) => item.id === requested) ? (requested as TabId) : "unggah";
  const sessionId = typeof params.sesi === "string" ? params.sesi : null;
  const brand = scrapeBrandOf(typeof params.merek === "string" ? params.merek : "");
  const search = typeof params.cari === "string" ? params.cari.slice(0, 80) : "";

  // Halaman ini hanya membaca. Draft basi ditandai "Kedaluwarsa" di tampilan,
  // ditolak saat diterapkan (queueBatch), dan dibatalkan job harian.

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Pusat Impor</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Semua sumber data diseragamkan dulu menjadi batch pratinjau. Tinjau tabelnya, lalu terapkan baris yang dipilih.
            Produk baru selalu masuk sebagai draft.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/products">Kelola produk</Link>
        </Button>
      </div>

      <nav aria-label="Sumber impor" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/admin/import?tab=${item.id}`}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm font-semibold transition-colors",
              tab === item.id
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        {tab === "unggah" ? (
          <>
            <section aria-labelledby="batch-terbaru" className="mb-10">
              <h2 id="batch-terbaru" className="text-lg font-bold text-foreground">
                Batch terbaru
              </h2>
              <BatchList limit={5} />
            </section>
            <UploadTab />
          </>
        ) : null}
        {tab === "tarik" ? <ScrapeTab sessionId={sessionId} brand={brand} search={search} /> : null}
        {tab === "foto" ? <PhotoTab /> : null}
        {tab === "riwayat" ? (
          <section aria-labelledby="riwayat">
            <h2 id="riwayat" className="text-lg font-bold text-foreground">
              Riwayat batch
            </h2>
            <BatchList limit={40} />
          </section>
        ) : null}
      </div>
    </Container>
  );
}
