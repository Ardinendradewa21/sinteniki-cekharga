import "server-only";

import { isRetryableScrapeFailure, SCRAPE_MAX_ATTEMPTS, scrapeBackoffMs, type ScrapeFailure } from "@/lib/scrape/retry-rules";

/**
 * Klien YouTube Data API v3 (PB-40). Hanya endpoint baca dengan API key.
 *
 * Hemat kuota: daftar unggahan channel dibaca lewat `playlistItems.list`
 * (1 unit per 50 video), bukan `search.list` (100 unit). Kuota default
 * 10.000 unit per hari cukup untuk sinkronisasi harian semua channel.
 *
 * Kegagalan layanan luar (aturan system design 7): timeout 10 detik per
 * permintaan, percobaan ulang terbatas untuk galat jaringan dan 5xx, dan
 * tidak pernah mengulang 4xx (kuota habis, key salah). Pemanggil menerima
 * galat yang bisa dibaca admin; halaman publik tidak bergantung pada API ini.
 */

const API = "https://www.googleapis.com/youtube/v3";
const TIMEOUT_MS = 10_000;

export class YoutubeApiError extends Error {
  readonly status: number;
  readonly quotaExceeded: boolean;

  constructor(message: string, status: number, quotaExceeded = false) {
    super(message);
    this.status = status;
    this.quotaExceeded = quotaExceeded;
  }
}

export function hasYoutubeKey(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY?.trim());
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new YoutubeApiError("YOUTUBE_API_KEY belum diisi di environment.", 0);
  const url = `${API}/${path}?${new URLSearchParams({ ...params, key })}`;

  for (let attempt = 1; ; attempt += 1) {
    let failure: ScrapeFailure;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
      if (response.ok) return (await response.json()) as T;
      const body = (await response.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[] } } | null;
      const reason = body?.error?.errors?.[0]?.reason ?? "";
      const quota = reason === "quotaExceeded" || reason === "dailyLimitExceeded";
      if (response.status < 500) {
        throw new YoutubeApiError(
          quota
            ? "Kuota harian YouTube API habis. Sinkronisasi dilanjutkan besok."
            : `YouTube API menolak permintaan (${response.status}${reason ? `, ${reason}` : ""}).`,
          response.status,
          quota
        );
      }
      failure = { kind: "http", status: response.status };
    } catch (error) {
      if (error instanceof YoutubeApiError) throw error;
      failure = { kind: "network" };
    }
    if (attempt >= SCRAPE_MAX_ATTEMPTS || !isRetryableScrapeFailure(failure)) {
      throw new YoutubeApiError(
        failure.kind === "http" ? `YouTube API sedang bermasalah (${failure.status}).` : "YouTube API tidak bisa dihubungi.",
        failure.kind === "http" ? failure.status : 0
      );
    }
    await new Promise((resolve) => setTimeout(resolve, scrapeBackoffMs(attempt)));
  }
}

type YoutubeChannel = { channelId: string; title: string; uploadsPlaylistId: string };

export async function resolveChannelHandle(handle: string): Promise<YoutubeChannel | null> {
  const data = await call<{
    items?: { id: string; snippet: { title: string }; contentDetails: { relatedPlaylists: { uploads: string } } }[];
  }>("channels", { part: "snippet,contentDetails", forHandle: handle });
  const item = data.items?.[0];
  return item ? { channelId: item.id, title: item.snippet.title, uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads } : null;
}

type YoutubeUpload = { videoId: string; title: string; publishedAt: string };

/**
 * Unggahan channel dari yang terbaru, berhenti di video yang lebih lama dari
 * `since` atau setelah `maxPages` halaman (50 video per halaman).
 */
export async function listUploads(playlistId: string, since: Date, maxPages: number): Promise<YoutubeUpload[]> {
  const uploads: YoutubeUpload[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const data = await call<{
      nextPageToken?: string;
      items?: { snippet: { title: string }; contentDetails: { videoId: string; videoPublishedAt?: string } }[];
    }>("playlistItems", { part: "snippet,contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) });
    let reachedOld = false;
    for (const item of data.items ?? []) {
      const publishedAt = item.contentDetails.videoPublishedAt;
      // Video privat/terhapus tidak punya tanggal terbit; lewati.
      if (!publishedAt) continue;
      if (new Date(publishedAt) < since) {
        reachedOld = true;
        continue;
      }
      uploads.push({ videoId: item.contentDetails.videoId, title: item.snippet.title, publishedAt });
    }
    pageToken = data.nextPageToken;
    if (reachedOld || !pageToken) break;
  }
  return uploads;
}

type YoutubeVideo = YoutubeUpload & { channelId: string; channelTitle: string };

/** Detail video untuk tambah manual: 1 unit untuk sampai 50 ID. */
export async function getVideos(videoIds: readonly string[]): Promise<YoutubeVideo[]> {
  if (videoIds.length === 0) return [];
  const data = await call<{
    items?: { id: string; snippet: { title: string; publishedAt: string; channelId: string; channelTitle: string } }[];
  }>("videos", { part: "snippet", id: videoIds.slice(0, 50).join(",") });
  return (data.items ?? []).map((item) => ({
    videoId: item.id,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
  }));
}
