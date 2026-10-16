"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import type { ActionState } from "@/lib/admin/actions";
import { recordAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/auth/dal";
import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { getCandidate } from "@/lib/reviews/queries";
import { enqueueChannelSync } from "@/lib/reviews/sync";
import { getVideos, resolveChannelHandle, YoutubeApiError } from "@/lib/reviews/youtube-client";
import { matchVideoTitle, parseYoutubeVideoId, youtubeWatchUrl } from "@/lib/reviews/youtube-match";
import { processScrapeStep } from "@/lib/scrape/jobs";

/**
 * Aksi panel Ulasan (PB-40). Semuanya hanya untuk peran `admin`
 * (requireStaff([])), dicek di server (aturan system design 5), dan tercatat
 * di audit. Pengambilan dari YouTube untuk sinkronisasi berjalan di worker;
 * aksi hanya mengantrekan lalu memicu worker lewat `after()`.
 */

const PANEL = "/admin/ulasan";

function db() {
  return getInsforgeAdminClient().database;
}

function done(path: string, query: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(query)}`);
}

/* ------------------------------------------------------------- channel */

export async function syncChannelsAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const channelId = String(formData.get("channelId") ?? "");
  const target = z.uuid().safeParse(channelId).success ? [channelId] : ("all" as const);
  const queued = await enqueueChannelSync(target, admin);
  await recordAudit(admin, "ulasan.sinkron", "review_channel", target === "all" ? null : channelId, { queued });
  after(() => processScrapeStep(50_000));
  revalidatePath(PANEL);
  done(PANEL, { tab: "channel", ok: queued > 0 ? "sinkron" : "sudah-antre" });
}

export async function toggleChannelAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const channelId = z.uuid().safeParse(formData.get("channelId"));
  if (!channelId.success) done(PANEL, { tab: "channel", galat: "channel" });
  const active = formData.get("active") === "true";
  const { error } = await db().from("review_channels").update({ is_active: active }).eq("id", channelId.data);
  if (error) done(PANEL, { tab: "channel", galat: "simpan" });
  await recordAudit(admin, active ? "ulasan.channel-aktif" : "ulasan.channel-nonaktif", "review_channel", channelId.data, {});
  revalidatePath(PANEL);
  done(PANEL, { tab: "channel", ok: "channel" });
}

const handleSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^https?:\/\/(www\.)?youtube\.com\//, "").replace(/^@/, "").replace(/\/.*$/, ""))
  .pipe(z.string().regex(/^[A-Za-z0-9._-]{3,100}$/));

export async function addChannelAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const handle = handleSchema.safeParse(formData.get("handle"));
  if (!handle.success) done(PANEL, { tab: "channel", galat: "handle" });

  let resolved;
  try {
    resolved = await resolveChannelHandle(handle.data);
  } catch (error) {
    console.error("[ulasan] handle gagal dicek:", error);
    done(PANEL, { tab: "channel", galat: "youtube" });
  }
  if (!resolved) done(PANEL, { tab: "channel", galat: "tidak-ada" });

  const { data, error } = await db()
    .from("review_channels")
    .upsert(
      [
        {
          handle: handle.data,
          youtube_channel_id: resolved.channelId,
          title: resolved.title,
          uploads_playlist_id: resolved.uploadsPlaylistId,
          is_active: true,
        },
      ],
      { onConflict: "handle" }
    )
    .select("id");
  if (error) done(PANEL, { tab: "channel", galat: "simpan" });
  const id = ((data ?? []) as { id: string }[])[0]?.id ?? null;
  await recordAudit(admin, "ulasan.channel-tambah", "review_channel", id, { handle: handle.data });
  if (id) {
    await enqueueChannelSync([id], admin);
    after(() => processScrapeStep(50_000));
  }
  revalidatePath(PANEL);
  done(PANEL, { tab: "channel", ok: "channel-baru" });
}

/* ------------------------------------------------------------ kandidat */

export async function rejectCandidateAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const id = z.uuid().safeParse(formData.get("candidateId"));
  if (!id.success) done(PANEL, { galat: "kandidat" });
  const { error } = await db()
    .from("review_candidates")
    .update({ status: "rejected", decided_by: admin.userId || null, decided_by_email: admin.email, decided_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("status", "pending");
  if (error) done(PANEL, { galat: "simpan" });
  await recordAudit(admin, "ulasan.tolak", "review_candidate", id.data, {});
  revalidatePath(PANEL);
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith(`${PANEL}?`) || back === PANEL ? back : PANEL);
}

/**
 * Tambah video dari tautan, untuk video yang tidak tertangkap pencocokan
 * judul. Channel-nya tetap harus ada di daftar channel terpercaya yang aktif.
 */
export async function addManualVideoAction(formData: FormData): Promise<void> {
  const admin = await requireStaff([]);
  const videoId = parseYoutubeVideoId(String(formData.get("url") ?? ""));
  const productId = z.uuid().safeParse(formData.get("productId"));
  if (!videoId) done(PANEL, { galat: "tautan" });
  if (!productId.success) done(PANEL, { galat: "produk" });

  let video;
  try {
    [video] = await getVideos([videoId]);
  } catch (error) {
    console.error("[ulasan] video gagal dibaca:", error);
    done(PANEL, { galat: error instanceof YoutubeApiError && error.quotaExceeded ? "kuota" : "youtube" });
  }
  if (!video) done(PANEL, { galat: "video-tidak-ada" });

  const channel = await db()
    .from("review_channels")
    .select("id")
    .eq("youtube_channel_id", video.channelId)
    .eq("is_active", true)
    .limit(1);
  const channelRow = ((channel.data ?? []) as { id: string }[])[0];
  if (!channelRow) done(PANEL, { galat: "bukan-channel" });

  const product = await db().from("products").select("id, brand, model").eq("id", productId.data).is("deleted_at", null).limit(1);
  const productRow = ((product.data ?? []) as { id: string; brand: string; model: string }[])[0];
  if (!productRow) done(PANEL, { galat: "produk" });

  const saved = await db()
    .from("review_videos")
    .upsert(
      [{ youtube_video_id: video.videoId, channel_id: channelRow.id, title: video.title, published_at: video.publishedAt, last_seen_at: new Date().toISOString() }],
      { onConflict: "youtube_video_id" }
    )
    .select("id");
  const savedId = ((saved.data ?? []) as { id: string }[])[0]?.id;
  if (saved.error || !savedId) done(PANEL, { galat: "simpan" });

  const hint = matchVideoTitle(video.title, [productRow])[0];
  const candidate = await db()
    .from("review_candidates")
    .upsert(
      [
        {
          video_id: savedId,
          product_id: productRow.id,
          suggested_aspect: hint?.suggestedAspect ?? "umum",
          looks_like_review: true,
          source: "manual",
          status: "pending",
        },
      ],
      { onConflict: "video_id,product_id" }
    )
    .select("id");
  const candidateId = ((candidate.data ?? []) as { id: string }[])[0]?.id;
  if (candidate.error || !candidateId) done(PANEL, { galat: "simpan" });
  await recordAudit(admin, "ulasan.tambah-manual", "review_candidate", candidateId, { videoId: video.videoId, productId: productRow.id });
  redirect(`${PANEL}/${candidateId}`);
}

/* ------------------------------------------------- ringkasan dari kandidat */

const summaryInput = z.object({
  aspect: z.enum(["umum", "kamera"], "Pilih aspek: umum atau kamera"),
  variantId: z.preprocess((value) => (value === "" ? null : value), z.uuid().nullable()),
  summary: z.string().trim().min(40, "Ringkasan minimal 40 karakter").max(1200, "Ringkasan maksimal 1.200 karakter"),
  strengths: z.string().max(1500).transform(lines),
  limitations: z.string().max(1500).transform(lines),
  testContext: z.preprocess((value) => (typeof value === "string" && value.trim() ? value.trim() : null), z.string().max(300).nullable()),
  timestamp: z
    .string()
    .trim()
    .max(8)
    .transform((value, context) => {
      if (!value) return null;
      const match = value.match(/^(?:(\d{1,2}):)?(\d{1,3})(?::(\d{2}))?$/);
      if (!match) {
        context.addIssue({ code: "custom", message: "Menit ditulis seperti 4:35" });
        return z.NEVER;
      }
      // "4:35" = menit:detik, "1:04:35" = jam:menit:detik, angka saja = detik.
      const [, first, second, third] = match;
      if (first !== undefined && third !== undefined) return Number(first) * 3600 + Number(second) * 60 + Number(third);
      if (first !== undefined) return Number(first) * 60 + Number(second);
      return Number(second);
    }),
  isSponsored: z.preprocess((value) => value === "on", z.boolean()),
});

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function publishFromCandidateAction(candidateId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireStaff([]);
  const parsed = summaryInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Isian belum lengkap." };
  const input = parsed.data;

  const candidate = await getCandidate(candidateId);
  if (!candidate) return { error: "Kandidat tidak ditemukan." };
  if (candidate.status === "rejected") return { error: "Kandidat ini sudah ditolak." };

  if (input.variantId) {
    const variant = await db().from("variants").select("id").eq("id", input.variantId).eq("product_id", candidate.product.id).limit(1);
    if ((variant.data ?? []).length === 0) return { error: "Varian tidak cocok dengan produk." };
  }

  const { data, error } = await db()
    .from("review_summaries")
    .insert([
      {
        product_id: candidate.product.id,
        variant_id: input.variantId,
        channel_name: candidate.channel.title,
        video_url: youtubeWatchUrl(candidate.video.youtubeId),
        youtube_video_id: candidate.video.youtubeId,
        candidate_id: candidate.id,
        published_at: candidate.video.publishedAt,
        timestamp_seconds: input.timestamp,
        aspect: input.aspect,
        summary: input.summary,
        strengths: input.strengths,
        limitations: input.limitations,
        test_context: input.testContext,
        is_sponsored: input.isSponsored,
        // Admin sudah menonton dan menulis sendiri: langsung terbit.
        status: "published",
      },
    ])
    .select("id");
  if (error) {
    const duplicate = String(error.message ?? "").includes("duplicate");
    return { error: duplicate ? "Video ini sudah punya ringkasan dengan aspek yang sama untuk produk ini." : "Ringkasan gagal disimpan." };
  }

  await db()
    .from("review_candidates")
    .update({ status: "used", decided_by: admin.userId || null, decided_by_email: admin.email, decided_at: new Date().toISOString() })
    .eq("id", candidate.id);
  const reviewId = ((data ?? []) as { id: string }[])[0]?.id ?? null;
  await recordAudit(admin, "ulasan.terbitkan", "review", reviewId, { candidateId: candidate.id, productId: candidate.product.id, aspect: input.aspect });

  invalidateCatalogCache();
  revalidatePath(PANEL);
  revalidatePath(`/admin/products/${candidate.product.id}`);
  revalidatePath(`/products/${candidate.product.slug}`);
  done(PANEL, { ok: "terbit" });
}
