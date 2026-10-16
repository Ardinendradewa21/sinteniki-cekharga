import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectWhereIn } from "@/lib/backend/paged-read";

/**
 * Bacaan panel admin Ulasan (PB-40). Setiap daftar dibaca dengan beberapa
 * query `.in()` sekaligus, bukan satu query per baris (aturan system design 4).
 */

export const CANDIDATES_PER_PAGE = 30;

function db() {
  return getInsforgeAdminClient().database;
}

type ReviewChannel = {
  id: string;
  handle: string;
  title: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  pending: number;
  syncing: boolean;
};

export async function listReviewChannels(): Promise<ReviewChannel[]> {
  const [channels, candidates, jobs] = await Promise.all([
    db().from("review_channels").select("id, handle, title, is_active, last_synced_at, last_error").order("handle"),
    db().from("review_candidates").select("video_id").eq("status", "pending").limit(5000),
    db().from("scrape_jobs").select("official_id").eq("kind", "youtube").in("status", ["queued", "running"]),
  ]);
  if (channels.error) throw new Error("Daftar channel gagal dibaca.");
  const videoIds = [...new Set(((candidates.data ?? []) as { video_id: string }[]).map((row) => row.video_id))];
  const videos = videoIds.length ? await selectWhereIn("review_videos", "id, channel_id", "id", videoIds) : [];
  const channelOfVideo = new Map(videos.map((row) => [String(row.id), String(row.channel_id)]));
  const pendingByChannel = new Map<string, number>();
  for (const row of (candidates.data ?? []) as { video_id: string }[]) {
    const channel = channelOfVideo.get(row.video_id);
    if (channel) pendingByChannel.set(channel, (pendingByChannel.get(channel) ?? 0) + 1);
  }
  const syncing = new Set(((jobs.data ?? []) as { official_id: string }[]).map((row) => row.official_id));

  return ((channels.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    handle: String(row.handle),
    title: (row.title as string | null) ?? null,
    isActive: row.is_active === true,
    lastSyncedAt: (row.last_synced_at as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    pending: pendingByChannel.get(String(row.id)) ?? 0,
    syncing: syncing.has(String(row.id)),
  }));
}

type ReviewCandidate = {
  id: string;
  status: "pending" | "used" | "rejected";
  source: "otomatis" | "manual";
  suggestedAspect: "umum" | "kamera";
  looksLikeReview: boolean;
  product: { id: string; name: string; slug: string };
  video: { youtubeId: string; title: string; publishedAt: string };
  channel: { id: string; title: string };
};

async function hydrate(rows: Record<string, unknown>[]): Promise<ReviewCandidate[]> {
  if (rows.length === 0) return [];
  const videos = await selectWhereIn(
    "review_videos",
    "id, youtube_video_id, channel_id, title, published_at",
    "id",
    rows.map((row) => String(row.video_id))
  );
  const [products, channels] = await Promise.all([
    selectWhereIn("products", "id, brand, model, slug", "id", rows.map((row) => String(row.product_id)), { includeDeleted: true }),
    selectWhereIn("review_channels", "id, handle, title", "id", videos.map((row) => String(row.channel_id))),
  ]);
  const videoById = new Map(videos.map((row) => [String(row.id), row]));
  const productById = new Map(products.map((row) => [String(row.id), row]));
  const channelById = new Map(channels.map((row) => [String(row.id), row]));

  return rows.flatMap((row) => {
    const video = videoById.get(String(row.video_id));
    const product = productById.get(String(row.product_id));
    const channel = video ? channelById.get(String(video.channel_id)) : undefined;
    if (!video || !product || !channel) return [];
    return [
      {
        id: String(row.id),
        status: row.status as ReviewCandidate["status"],
        source: row.source as ReviewCandidate["source"],
        suggestedAspect: row.suggested_aspect === "kamera" ? "kamera" : "umum",
        looksLikeReview: row.looks_like_review === true,
        product: { id: String(product.id), name: `${product.brand} ${product.model}`, slug: String(product.slug) },
        video: { youtubeId: String(video.youtube_video_id), title: String(video.title), publishedAt: String(video.published_at) },
        channel: { id: String(channel.id), title: String(channel.title ?? channel.handle) },
      },
    ];
  });
}

const CANDIDATE_COLUMNS = "id, video_id, product_id, suggested_aspect, looks_like_review, status, source, created_at";

/** Antrean kandidat: yang tampak seperti ulasan dulu, lalu yang terbaru. */
export async function listPendingCandidates(options: { productId?: string; page: number }): Promise<{
  items: ReviewCandidate[];
  total: number;
}> {
  let query = db()
    .from("review_candidates")
    .select(CANDIDATE_COLUMNS, { count: "exact" })
    .eq("status", "pending");
  if (options.productId) query = query.eq("product_id", options.productId);
  const from = (options.page - 1) * CANDIDATES_PER_PAGE;
  const { data, error, count } = await query
    .order("looks_like_review", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + CANDIDATES_PER_PAGE - 1);
  if (error) throw new Error("Kandidat ulasan gagal dibaca.");
  const items = await hydrate((data ?? []) as Record<string, unknown>[]);
  // Urutan kedua di dalam halaman: video terbaru lebih dulu.
  items.sort((a, b) => Number(b.looksLikeReview) - Number(a.looksLikeReview) || b.video.publishedAt.localeCompare(a.video.publishedAt));
  return { items, total: count ?? items.length };
}

export async function getCandidate(id: string): Promise<ReviewCandidate | null> {
  const { data, error } = await db().from("review_candidates").select(CANDIDATE_COLUMNS).eq("id", id).limit(1);
  if (error) throw new Error("Kandidat ulasan gagal dibaca.");
  return (await hydrate((data ?? []) as Record<string, unknown>[]))[0] ?? null;
}

/** Produk yang punya kandidat menunggu, untuk saringan di panel. */
export async function productsWithPendingCandidates(): Promise<{ id: string; name: string; pending: number }[]> {
  const { data, error } = await db().from("review_candidates").select("product_id").eq("status", "pending").limit(5000);
  if (error) throw new Error("Kandidat ulasan gagal dibaca.");
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { product_id: string }[]) counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
  if (counts.size === 0) return [];
  const products = await selectWhereIn("products", "id, brand, model", "id", [...counts.keys()], { includeDeleted: true });
  return products
    .map((row) => ({ id: String(row.id), name: `${row.brand} ${row.model}`, pending: counts.get(String(row.id)) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}
