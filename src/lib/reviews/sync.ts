import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectAll } from "@/lib/backend/paged-read";
import { chunk } from "@/lib/import/batch";
import { listUploads, resolveChannelHandle, YoutubeApiError } from "@/lib/reviews/youtube-client";
import { matchVideoTitle, type MatchableProduct } from "@/lib/reviews/youtube-match";

/**
 * Sinkronisasi video kandidat dari channel terpercaya (PB-40).
 *
 * Satu job `youtube` di scrape_jobs per channel (aturan system design 3);
 * aksi admin dan cron harian hanya mengantrekan, worker yang mengerjakan.
 * Setiap sinkronisasi membaca ulang unggahan dalam jendela waktu dan hanya
 * menyimpan video yang judulnya cocok dengan produk katalog. Produk yang baru
 * ditambahkan otomatis ikut dicocokkan pada sinkronisasi berikutnya.
 *
 * Idempoten (aturan 6): video unik per ID YouTube, kandidat unik per
 * video x produk. Kandidat yang sudah ditolak atau dipakai tidak muncul lagi.
 */

/** Jendela unggahan yang dibaca. Produk katalog umumnya rilis dua tahun terakhir. */
const WINDOW_DAYS = 540;
/** Batas halaman per channel (50 video per halaman, 1 unit kuota per halaman). */
const MAX_PAGES = 40;
/** Kebijakan YouTube API: data yang tidak diperbarui lebih dari 30 hari dihapus. */
const STALE_DAYS = 30;

function db() {
  return getInsforgeAdminClient().database;
}

type ChannelRow = {
  id: string;
  handle: string;
  uploads_playlist_id: string | null;
  is_active: boolean;
};

export async function enqueueChannelSync(
  channelIds: readonly string[] | "all",
  actor: { userId: string; email: string } | null
): Promise<number> {
  let ids = channelIds === "all" ? [] : [...channelIds];
  if (channelIds === "all") {
    const { data, error } = await db().from("review_channels").select("id").eq("is_active", true);
    if (error) throw new Error("Daftar channel gagal dibaca.");
    ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
  }
  if (ids.length === 0) return 0;

  const active = await db()
    .from("scrape_jobs")
    .select("official_id")
    .eq("kind", "youtube")
    .in("status", ["queued", "running"])
    .in("official_id", ids);
  if (active.error) throw new Error("Status job sinkronisasi gagal dibaca.");
  const busy = new Set(((active.data ?? []) as { official_id: string }[]).map((row) => row.official_id));
  const fresh = ids.filter((id) => !busy.has(id));
  if (fresh.length === 0) return 0;

  const { error } = await db()
    .from("scrape_jobs")
    .insert(
      fresh.map((id) => ({
        kind: "youtube",
        brand: "youtube",
        official_id: id,
        created_by: actor?.userId || null,
        created_by_email: actor?.email ?? "cron",
      }))
    );
  // Indeks unik menolak job ganda bila dua pemicu berbarengan; itu bukan galat.
  if (error && !String(error.message ?? "").includes("duplicate")) {
    console.error("[ulasan-sinkron] job gagal dibuat:", error);
    throw new Error("Job sinkronisasi gagal dibuat.");
  }
  return fresh.length;
}

async function publishedProducts(): Promise<MatchableProduct[]> {
  const rows = (await selectAll("products", "id, brand, model, status")) as {
    id: string;
    brand: string;
    model: string;
    status: string;
  }[];
  return rows.filter((row) => row.status === "published").map(({ id, brand, model }) => ({ id, brand, model }));
}

/** Dijalankan worker untuk satu job `youtube`. Mengembalikan status akhir job. */
export async function syncChannel(channelId: string): Promise<{ status: "done" | "failed" | "cancelled"; error: string | null }> {
  const { data, error } = await db()
    .from("review_channels")
    .select("id, handle, uploads_playlist_id, is_active")
    .eq("id", channelId)
    .limit(1);
  const channel = ((data ?? []) as ChannelRow[])[0];
  if (error || !channel) return { status: "failed", error: "Channel tidak ditemukan." };
  if (!channel.is_active) return { status: "cancelled", error: "Channel dinonaktifkan admin." };

  try {
    let playlist = channel.uploads_playlist_id;
    if (!playlist) {
      const resolved = await resolveChannelHandle(channel.handle);
      if (!resolved) throw new YoutubeApiError(`Handle @${channel.handle} tidak ditemukan di YouTube.`, 404);
      playlist = resolved.uploadsPlaylistId;
      await db()
        .from("review_channels")
        .update({ youtube_channel_id: resolved.channelId, title: resolved.title, uploads_playlist_id: playlist })
        .eq("id", channel.id);
    }

    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    const [uploads, products] = await Promise.all([listUploads(playlist, since, MAX_PAGES), publishedProducts()]);
    const matched = uploads
      .map((upload) => ({ upload, matches: matchVideoTitle(upload.title, products) }))
      .filter((entry) => entry.matches.length > 0);

    const seenAt = new Date().toISOString();
    for (const group of chunk(matched, 200)) {
      const videos = await db()
        .from("review_videos")
        .upsert(
          group.map(({ upload }) => ({
            youtube_video_id: upload.videoId,
            channel_id: channel.id,
            title: upload.title,
            published_at: upload.publishedAt,
            last_seen_at: seenAt,
          })),
          { onConflict: "youtube_video_id" }
        )
        .select("id, youtube_video_id");
      if (videos.error) throw new Error("Video kandidat gagal disimpan.");
      const idOf = new Map(((videos.data ?? []) as { id: string; youtube_video_id: string }[]).map((row) => [row.youtube_video_id, row.id]));

      const candidates = group.flatMap(({ upload, matches }) =>
        matches.map((match) => ({
          video_id: idOf.get(upload.videoId),
          product_id: match.productId,
          suggested_aspect: match.suggestedAspect,
          looks_like_review: match.looksLikeReview,
        }))
      );
      const inserted = await db()
        .from("review_candidates")
        .upsert(
          candidates.filter((row) => row.video_id),
          { onConflict: "video_id,product_id", ignoreDuplicates: true }
        );
      if (inserted.error) throw new Error("Kandidat ulasan gagal disimpan.");
    }

    await db().from("review_channels").update({ last_synced_at: seenAt, last_error: null }).eq("id", channel.id);
    return { status: "done", error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sinkronisasi gagal.";
    console.error(`[ulasan-sinkron] @${channel.handle}:`, error);
    await db().from("review_channels").update({ last_error: message.slice(0, 300) }).eq("id", channel.id);
    return { status: "failed", error: message };
  }
}

/**
 * Retensi data YouTube: video yang tidak terlihat lagi lebih dari 30 hari
 * dihapus bersama kandidatnya. Ringkasan admin tetap ada (kolom
 * candidate_id menjadi NULL), karena itu tulisan CekHarga sendiri.
 */
export async function purgeStaleYoutubeVideos(keepDays = STALE_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - keepDays * 86_400_000).toISOString();
  const { data, error } = await db().from("review_videos").delete().lt("last_seen_at", cutoff).select("id");
  if (error) throw new Error("Video YouTube lama gagal dihapus.");
  return (data ?? []).length;
}
