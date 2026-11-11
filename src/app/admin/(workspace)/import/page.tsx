import Link from "next/link";
import type { Metadata } from "next";

import { UploadForm } from "@/components/admin/upload-form";
import { PhotoReprocessForm } from "@/components/admin/photo-reprocess-form";
import { PriceHelperLink } from "@/components/admin/price-helper-link";
import { ScrapeWorkbench } from "@/components/admin/scrape-workbench";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { NavTabs } from "@/components/ui/nav-tabs";
import { requireStaff } from "@/lib/auth/dal";
import {
  batchAgeDays,
  batchStatusView,
  DRAFT_TTL_DAYS,
} from "@/lib/import/batch-status";
import { listBatches, type BatchSummary } from "@/lib/import/batches";
import { PHOTO_HELPER_BOOKMARKLET } from "@/lib/import/photo-helper";
import { PRICE_HELPER_BOOKMARKLET } from "@/lib/import/price-helper";
import { templateTerpadu } from "@/lib/import/unified";
import { photoJobCounts } from "@/lib/import/photo-jobs";
import { MAX_PHOTOS_PER_COLOR, MAX_PHOTOS_PER_PRODUCT } from "@/lib/import/photo-rules";
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
 *   Unggah CSV     — CSV gabungan: penawaran dan foto per warna dalam satu
 *                    berkas (Sprint 8-9). Spesifikasi tidak lewat CSV.
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
  { id: "foto", label: "Antrean foto" },
  { id: "salin", label: "Salin harga & foto" },
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
                {KIND_LABEL[batch.kind]} ·{" "}
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

const KIND_LABEL: Record<BatchSummary["kind"], string> = {
  specs: "Spesifikasi",
  offers: "Penawaran",
  photos: "Galeri foto",
};

const ORIGIN_LABEL: Record<BatchSummary["origin"], string> = {
  csv: "CSV",
  scrape: "Tarik otomatis",
  schedule: "Pemeriksaan harian",
};

const COLUMN_GROUPS = [
  {
    title: "Identitas (setiap baris)",
    columns: "brand, model_name, ram_gb, storage_gb",
    note: "Produk harus sudah ada di katalog dan dicocokkan lewat merek + model. slug opsional; bila diisi, harus menunjuk produk yang sama.",
  },
  {
    title: "Penawaran (satu baris per varian per toko)",
    columns: "marketplace, seller_name, offer_url, price_idr, observed_at, warranty, listing_status, seller_verified, color",
    note: "Harga kosong tetap kosong, bukan nol. observed_at kosong memakai tanggal berkas.",
  },
  {
    title: "Foto (satu baris per foto)",
    columns: "color, image_url, urutan, is_cover, image_source_url, image_usage_basis, image_usage_rights",
    note: "Foto yang sama di beberapa baris dihitung sekali. Foto wajib menyebut warnanya.",
  },
];

function UploadTab() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Unggah CSV gabungan</h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Satu berkas untuk penawaran dan harga serta foto per warna, untuk produk yang sudah ada di katalog. Berkas boleh
          berisi keduanya atau salah satunya saja, dan kamu memilih bagian mana yang diimpor. Bila keduanya ada, harga
          ditinjau dulu, lalu foto sebagai tahap berikutnya. Produk baru dan spesifikasinya ditambahkan lewat tab{" "}
          <Link href="/admin/import?tab=tarik" className="font-semibold text-brand underline-offset-4 hover:underline">
            Tarik otomatis
          </Link>
          , lalu disunting di halaman produk.
        </p>
        <div className="mt-5">
          <UploadForm template={templateTerpadu()} />
        </div>
      </section>

      <section aria-labelledby="panduan-kolom">
        <h2 id="panduan-kolom" className="text-lg font-bold text-foreground">
          Panduan kolom
        </h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Jenis baris dikenali dari kolom yang terisi, bukan dari urutan atau nama tab. Kolom boleh kosong dan nilai yang
          dirapikan otomatis (harga, tanggal, kapasitas) ditampilkan di pratinjau.
        </p>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          {COLUMN_GROUPS.map((group) => (
            <div key={group.title} className="rounded-xl border border-border bg-card p-4">
              <dt className="text-sm font-semibold text-foreground">{group.title}</dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">
                <code className="text-xs leading-relaxed break-words text-foreground">{group.columns}</code>
                <p className="mt-1.5">{group.note}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/40 p-5 text-sm leading-relaxed text-foreground">
          <p className="font-semibold">Aturan foto</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Paling banyak {MAX_PHOTOS_PER_COLOR} foto per warna dan {MAX_PHOTOS_PER_PRODUCT} foto per produk. Saat batas
              tercapai, sampul dan urutan terkecil didahulukan.
            </li>
            <li>Satu sampul per warna (is_cover = ya). Sampul yang sudah dipilih admin tidak ditimpa impor.</li>
            <li>
              URL foto yang sama untuk dua warna, atau warna di luar daftar warna spesifikasi, ditandai Perlu tinjau.
            </li>
            <li>Foto diproses di antrean terpisah; hasilnya terlihat di tab Antrean foto dan halaman produk.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-warning-muted p-5">
          <p className="text-sm font-semibold text-warning">Yang tidak ikut diimpor</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground">
            <li>
              Spesifikasi dan produk baru. Keduanya diambil lewat Tarik otomatis; kolom spesifikasi di sheet lama
              diabaikan dengan catatan di pratinjau.
            </li>
            <li>Harga untuk produk yang belum ada di katalog. Barisnya dilewati beserta alasannya.</li>
            <li>Ulasan reviewer. Kurasinya di menu Ulasan YouTube, tidak lewat berkas.</li>
          </ul>
        </div>
      </div>
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

/**
 * Alat bantu salin harga (Sprint 12): bookmarklet yang dijalankan admin di
 * halaman produk marketplace yang ia buka sendiri. Tidak ada scraping server.
 */
function PriceHelperTab() {
  return (
    <section aria-labelledby="salin-harga" className="space-y-6">
      <div className="max-w-3xl">
        <h2 id="salin-harga" className="text-lg font-bold text-foreground">
          Alat bantu salin harga
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Mempercepat pencatatan harga e-commerce secara manual. Kamu tetap membuka halaman produk seperti biasa (dengan
          akunmu sendiri); satu klik menyalin satu baris berformat CSV gabungan untuk ditempel ke Google Sheet. Tidak ada
          yang mengambil data otomatis di latar belakang, jadi tidak melanggar aturan marketplace maupun aturan proyek.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">1. Pasang sekali</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tampilkan bilah bookmark browser (Ctrl+Shift+B), lalu seret tombol ini ke bilah tersebut.
        </p>
        <div className="mt-3">
          <PriceHelperLink href={PRICE_HELPER_BOOKMARKLET} />
        </div>
      </div>

      <ol className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm leading-relaxed text-foreground">
        <li>
          <strong>2. Buka halaman produk</strong> di Shopee, Tokopedia, Blibli, Lazada, TikTok Shop, atau Erafone, lalu
          pilih varian (RAM/penyimpanan) dan warnanya di halaman itu.
        </li>
        <li>
          <strong>3. Klik bookmark &ldquo;Salin ke CekHarga&rdquo;.</strong> Panel kecil muncul di kanan atas berisi judul, harga yang
          terlihat, marketplace, dan RAM/penyimpanan bila tertulis di judul. Bila harga terdeteksi salah, klik salah satu
          tombol harga di panel, atau blok teks harga di halaman sebelum mengeklik bookmark.
        </li>
        <li>
          <strong>4. Lengkapi lalu klik &ldquo;Salin baris&rdquo;.</strong> Merek, model, dan nama toko diingat untuk klik berikutnya
          di situs yang sama. Waktu pemeriksaan diisi otomatis (WIB) dan URL dirapikan tanpa parameter pelacak.
        </li>
        <li>
          <strong>5. Tempel di baris kosong sheet</strong> (Ctrl+V). Kolomnya sudah urut sesuai templat CSV gabungan.
          Ganti varian di halaman dan ulangi. Setelah selesai, unduh sheet sebagai CSV dan unggah di tab Unggah CSV.
        </li>
      </ol>

      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Bila marketplace menutup panel atau memblokir bookmark, salin manual seperti biasa. Alat ini hanya membaca
        halaman yang sedang kamu lihat dan tidak mengirim apa pun ke server CekHarga.
      </p>

      <PhotoHelperSection />
    </section>
  );
}

/**
 * Alat bantu salin foto galeri resmi (Sprint 14): bookmarklet yang membaca
 * galeri per warna di halaman produk motorola.com/id yang sedang dibuka admin.
 */
function PhotoHelperSection() {
  return (
    <div className="space-y-6 border-t border-border pt-6">
      <div className="max-w-3xl">
        <h2 id="salin-foto" className="text-lg font-bold text-foreground">
          Alat bantu salin foto galeri resmi
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Untuk Motorola: satu klik di halaman produk motorola.com/id menyalin semua foto per warna (paling banyak 6 per
          warna, foto pertama jadi sampul) sebagai baris CSV gabungan. Tidak perlu lagi menyalin URL gambar satu per satu.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">1. Pasang sekali</p>
        <p className="mt-1 text-sm text-muted-foreground">Seret tombol ini ke bilah bookmark browser.</p>
        <div className="mt-3">
          <PriceHelperLink href={PHOTO_HELPER_BOOKMARKLET} label="Salin foto ke CekHarga" />
        </div>
      </div>

      <ol className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm leading-relaxed text-foreground">
        <li>
          <strong>2. Buka halaman produk HP</strong> di motorola.com/id (mis. dari menu Smartphone) dan tunggu sampai
          pilihan warna tampil.
        </li>
        <li>
          <strong>3. Klik bookmark &ldquo;Salin foto ke CekHarga&rdquo;.</strong> Panel menampilkan setiap warna, jumlah
          fotonya, dan model yang ditebak dari alamat halaman. Samakan nama model dengan nama di katalog, rapikan nama
          warna bila perlu, dan hapus centang warna yang tidak dijual di Indonesia.
        </li>
        <li>
          <strong>4. Klik &ldquo;Salin baris&rdquo;, lalu tempel di sheet</strong> (Ctrl+V). Satu baris per foto, kolomnya urut
          sesuai templat CSV gabungan. Nama model dan warna yang kamu ubah diingat untuk halaman yang sama.
        </li>
        <li>
          <strong>5. Unggah CSV di tab Unggah CSV</strong> dengan bagian &ldquo;Foto per warna&rdquo; dicentang, lalu pilih dasar hak pakai foto di
          form. Kolom dasar hak pakai sengaja dibiarkan kosong oleh alat ini.
        </li>
      </ol>
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

      <NavTabs
        label="Sumber impor"
        className="mt-6"
        items={TABS.map((item) => ({
          href: `/admin/import?tab=${item.id}`,
          label: item.label,
          active: tab === item.id,
        }))}
      />

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
        {tab === "salin" ? <PriceHelperTab /> : null}
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
