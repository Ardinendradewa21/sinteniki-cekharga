import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireStaff } from "@/lib/auth/dal";
import { selectAll } from "@/lib/backend/paged-read";
import {
  addChannelAction,
  addManualVideoAction,
  rejectCandidateAction,
  syncChannelsAction,
  toggleChannelAction,
} from "@/lib/reviews/actions";
import {
  CANDIDATES_PER_PAGE,
  listPendingCandidates,
  listReviewChannels,
  productsWithPendingCandidates,
} from "@/lib/reviews/queries";
import { hasYoutubeKey } from "@/lib/reviews/youtube-client";
import { youtubeWatchUrl } from "@/lib/reviews/youtube-match";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ulasan YouTube",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
/** Aksi sinkron memicu worker lewat after(); beri waktu sampai batas fungsi. */
export const maxDuration = 60;

const MESSAGES: Record<string, string> = {
  channel: "Channel tidak valid.",
  simpan: "Perubahan gagal disimpan. Coba lagi.",
  handle: "Handle channel tidak valid. Contoh: @GadgetIn.",
  "tidak-ada": "Handle itu tidak ditemukan di YouTube.",
  youtube: "YouTube API sedang tidak bisa dihubungi. Coba lagi nanti.",
  kuota: "Kuota harian YouTube API habis. Coba lagi besok.",
  kandidat: "Kandidat tidak valid.",
  tautan: "Tautan YouTube tidak dikenali.",
  produk: "Pilih produk yang sudah terbit.",
  "video-tidak-ada": "Video tidak ditemukan atau bersifat privat.",
  "bukan-channel": "Video itu bukan dari channel terpercaya yang aktif.",
};

const OK: Record<string, string> = {
  sinkron: "Sinkronisasi diantrekan. Kandidat baru muncul dalam beberapa menit.",
  "sudah-antre": "Sinkronisasi channel itu sudah berjalan.",
  channel: "Status channel diperbarui.",
  "channel-baru": "Channel ditambahkan dan langsung disinkronkan.",
  terbit: "Ringkasan diterbitkan dan tampil di halaman produk.",
};

function formatDate(iso: string | null): string {
  if (!iso) return "belum pernah";
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
}

/**
 * Panel Ulasan YouTube (PB-40). Sistem mencarikan video kandidat dari channel
 * terpercaya; admin memilih yang relevan, menonton, lalu menulis ringkasan.
 * Hanya peran `admin` yang bisa membuka panel ini.
 */
export default async function ReviewsAdminPage(props: PageProps<"/admin/ulasan">) {
  await requireStaff([]);
  const query = await props.searchParams;
  const tab = query.tab === "channel" ? "channel" : "kandidat";
  const productFilter = typeof query.produk === "string" && /^[0-9a-f-]{36}$/.test(query.produk) ? query.produk : undefined;
  const page = Math.max(1, Number(query.hal) || 1);

  const [channels, filterOptions, candidates, products] = await Promise.all([
    listReviewChannels(),
    productsWithPendingCandidates(),
    tab === "kandidat" ? listPendingCandidates({ productId: productFilter, page }) : Promise.resolve(null),
    selectAll("products", "id, brand, model, status") as Promise<{ id: string; brand: string; model: string; status: string }[]>,
  ]);
  const published = products
    .filter((product) => product.status === "published")
    .map((product) => ({ id: product.id, name: `${product.brand} ${product.model}` }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
  const pendingTotal = filterOptions.reduce((sum, item) => sum + item.pending, 0);
  const error = typeof query.galat === "string" ? MESSAGES[query.galat] : null;
  const ok = typeof query.ok === "string" ? OK[query.ok] : null;
  const here = `/admin/ulasan?${new URLSearchParams({ ...(productFilter ? { produk: productFilter } : {}), ...(page > 1 ? { hal: String(page) } : {}) })}`;
  const totalPages = candidates ? Math.max(1, Math.ceil(candidates.total / CANDIDATES_PER_PAGE)) : 1;

  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Ulasan YouTube</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Sistem mencarikan video dari channel terpercaya yang judulnya menyebut produk katalog. Pilih video yang memang
        mengulas produk itu, tonton, lalu tulis ringkasannya. Hanya ringkasan yang kamu terbitkan yang tampil di situs.
      </p>

      {!hasYoutubeKey() ? (
        <p role="alert" className="mt-4 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm text-foreground">
          YOUTUBE_API_KEY belum diisi di environment. Sinkronisasi dan tambah video dari tautan tidak akan berjalan.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p role="status" className="mt-4 rounded-xl border border-success/40 bg-success/5 p-4 text-sm text-foreground">
          {ok}
        </p>
      ) : null}

      <nav aria-label="Bagian panel ulasan" className="mt-6 flex gap-2 border-b border-border">
        {[
          { key: "kandidat", label: `Kandidat (${pendingTotal})`, href: "/admin/ulasan" },
          { key: "channel", label: `Channel (${channels.length})`, href: "/admin/ulasan?tab=channel" },
        ].map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={tab === item.key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold transition-colors",
              tab === item.key ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "channel" ? (
        <section className="mt-6 space-y-6">
          <form action={syncChannelsAction}>
            <Button type="submit">Sinkronkan semua channel aktif</Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Cron harian juga menyinkronkan otomatis. Satu sinkronisasi memakai sekitar 1 unit kuota per 50 video.
            </p>
          </form>

          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {channels.map((channel) => (
              <li key={channel.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {channel.title ?? channel.handle}{" "}
                    <a
                      href={`https://www.youtube.com/@${channel.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-normal text-brand underline-offset-4 hover:underline"
                    >
                      @{channel.handle}
                    </a>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sinkron terakhir: {formatDate(channel.lastSyncedAt)} · {channel.pending} kandidat menunggu
                    {channel.syncing ? " · sedang disinkronkan" : ""}
                  </p>
                  {channel.lastError ? <p className="mt-1 text-xs text-destructive">Galat terakhir: {channel.lastError}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {!channel.isActive ? <Badge variant="warning">Nonaktif</Badge> : null}
                  <form action={syncChannelsAction}>
                    <input type="hidden" name="channelId" value={channel.id} />
                    <Button type="submit" variant="outline" size="sm" disabled={!channel.isActive || channel.syncing}>
                      Sinkronkan
                    </Button>
                  </form>
                  <form action={toggleChannelAction}>
                    <input type="hidden" name="channelId" value={channel.id} />
                    <input type="hidden" name="active" value={channel.isActive ? "false" : "true"} />
                    <Button type="submit" variant="ghost" size="sm">
                      {channel.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>

          <form action={addChannelAction} className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="handle">Tambah channel terpercaya</Label>
              <Input id="handle" name="handle" placeholder="@NamaChannel atau tautan channel" required className="mt-2" />
            </div>
            <Button type="submit">Tambah</Button>
          </form>
        </section>
      ) : (
        <section className="mt-6 space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <form method="get" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Label htmlFor="produk">Saring per produk</Label>
                <select
                  id="produk"
                  name="produk"
                  defaultValue={productFilter ?? ""}
                  className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground"
                >
                  <option value="">Semua produk</option>
                  {filterOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.pending})
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="outline">
                Saring
              </Button>
            </form>

            <form action={addManualVideoAction} className="grid gap-2 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Video tidak ada di daftar? Tambah dari tautan</p>
              <Input name="url" placeholder="https://www.youtube.com/watch?v=…" required aria-label="Tautan video YouTube" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  name="productId"
                  required
                  defaultValue=""
                  aria-label="Produk yang diulas"
                  className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base text-foreground sm:w-auto sm:flex-1"
                >
                  <option value="" disabled>
                    Pilih produk
                  </option>
                  {published.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline">
                  Tambah
                </Button>
              </div>
            </form>
          </div>

          {candidates && candidates.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Tidak ada kandidat yang menunggu. Sinkronisasi berikutnya berjalan otomatis setiap hari.
            </p>
          ) : null}

          <ul className="grid gap-3">
            {candidates?.items.map((candidate) => (
              <li key={candidate.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row">
                <a
                  href={youtubeWatchUrl(candidate.video.youtubeId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-48"
                >
                  <Image
                    src={`https://i.ytimg.com/vi/${candidate.video.youtubeId}/mqdefault.jpg`}
                    alt=""
                    fill
                    unoptimized
                    sizes="192px"
                    className="object-cover"
                  />
                  <span className="sr-only">Buka video di YouTube (tab baru)</span>
                </a>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">{candidate.video.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {candidate.channel.title} · {new Date(candidate.video.publishedAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{candidate.product.name}</Badge>
                    {candidate.looksLikeReview ? <Badge variant="success">Tampak ulasan</Badge> : <Badge variant="outline">Mungkin berita</Badge>}
                    {candidate.suggestedAspect === "kamera" ? <Badge variant="outline">Saran: kamera</Badge> : null}
                    {candidate.source === "manual" ? <Badge variant="outline">Ditambah manual</Badge> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/admin/ulasan/${candidate.id}`}>Tulis ringkasan</Link>
                    </Button>
                    <form action={rejectCandidateAction}>
                      <input type="hidden" name="candidateId" value={candidate.id} />
                      <input type="hidden" name="back" value={here} />
                      <Button type="submit" variant="ghost" size="sm">
                        Bukan ulasan produk ini
                      </Button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <nav aria-label="Halaman kandidat" className="flex items-center justify-between gap-3 text-sm">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/ulasan?${new URLSearchParams({ ...(productFilter ? { produk: productFilter } : {}), hal: String(page - 1) })}`}>
                    Sebelumnya
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Halaman {page} dari {totalPages}
              </span>
              {page < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/ulasan?${new URLSearchParams({ ...(productFilter ? { produk: productFilter } : {}), hal: String(page + 1) })}`}>
                    Berikutnya
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      )}
    </Container>
  );
}
