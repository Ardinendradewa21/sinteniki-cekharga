"use server";

import { z } from "zod";

import { recordAudit } from "@/lib/admin/audit";
import { consumeStaffQuota } from "@/lib/assistant/ai/quota";
import { hasAiCredentials } from "@/lib/assistant/ai/client";
import { requireStaff } from "@/lib/auth/dal";
import { createRateLimiter } from "@/lib/rate-limit";
import { draftReview, VIDEO_DRAFT_LIMITS, type DraftSource, type VideoDraft } from "@/lib/reviews/ai-draft";
import { getCandidate, getReviewForEdit } from "@/lib/reviews/queries";

/**
 * Aksi draf ulasan dengan AI (admin saja): "Buat draf dari video", "Tempel
 * transkrip", dan "Rapikan dengan AI" (RV-02).
 *
 * Urutan pembatas (aturan system design 1): hak akses di server, batas per
 * menit per admin, lalu kuota harian per admin di database (video dan teks
 * dihitung terpisah karena biayanya jauh berbeda). Draf tidak disimpan; ia
 * hanya mengisi formulir dan admin yang menyimpan.
 */

const perMinute = createRateLimiter({ limit: VIDEO_DRAFT_LIMITS.perMinute, windowMs: 60_000 });

export type DraftActionResult = { ok: true; draft: VideoDraft } | { ok: false; error: string };

export type DraftRequest = {
  source: "video" | "transkrip" | "rapikan";
  aspect: string;
  /** Transkrip tempelan, atau isi formulir saat ini untuk "rapikan". */
  text?: string;
};

const requestSchema = z.object({
  source: z.enum(["video", "transkrip", "rapikan"]),
  aspect: z.enum(["umum", "kamera"]),
  text: z.string().max(VIDEO_DRAFT_LIMITS.transcriptMaxChars, "Bahan terlalu panjang. Potong bagian yang tidak relevan.").optional(),
});

type Subject = { id: string; kind: "review_candidate" | "review"; youtubeId: string | null; productName: string; channel: string; title: string };

async function runDraft(subject: Subject, request: DraftRequest): Promise<DraftActionResult> {
  const admin = await requireStaff([]);
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Permintaan tidak valid." };
  if (!hasAiCredentials()) return { ok: false, error: "Kunci OpenRouter belum terpasang. Tulis ringkasan manual." };
  const { source: kind, aspect } = parsed.data;
  const text = (parsed.data.text ?? "").trim();

  let source: DraftSource;
  if (kind === "video") {
    if (!subject.youtubeId) return { ok: false, error: "Ringkasan ini tidak terhubung ke video YouTube. Pakai \"Tempel transkrip\"." };
    source = { kind: "video", youtubeId: subject.youtubeId };
  } else {
    if (text.length < (kind === "transkrip" ? 200 : 40)) {
      return {
        ok: false,
        error: kind === "transkrip" ? "Tempel transkrip videonya dulu (minimal beberapa kalimat)." : "Isi ringkasan atau poin dulu, baru bisa dirapikan.",
      };
    }
    source = { kind, text };
  }

  const limit = perMinute.check(admin.userId || admin.email);
  if (!limit.allowed) return { ok: false, error: `Terlalu cepat. Tunggu ${limit.retryAfterSec} detik.` };
  const isVideo = kind === "video";
  const daily = isVideo ? VIDEO_DRAFT_LIMITS.perAdminDaily : VIDEO_DRAFT_LIMITS.perAdminDailyText;
  const quota = await consumeStaffQuota(isVideo ? "draf-ulasan-video" : "draf-ulasan-teks", admin.userId || admin.email, daily);
  if (!quota.allowed) {
    return {
      ok: false,
      error:
        quota.reason === "client"
          ? `Jatah draf AI ${isVideo ? "dari video" : "dari teks"} hari ini (${daily}) sudah habis. Tulis manual atau lanjut besok.`
          : "Kuota AI sedang tidak tersedia. Tulis ringkasan manual.",
    };
  }

  const result = await draftReview({ source, productName: subject.productName, channel: subject.channel, title: subject.title, aspect });
  await recordAudit(admin, "ulasan.draf-ai", subject.kind, subject.id, {
    sumber: kind,
    aspect,
    berhasil: result.ok,
    model: result.meta?.model ?? null,
    biayaUsd: result.meta?.costUsd ?? null,
  });
  return result.ok ? { ok: true, draft: result.draft } : { ok: false, error: result.reason };
}

/** Halaman tulis ringkasan dari kandidat video. Id diikat di server. */
export async function draftForCandidateAction(candidateId: string, request: DraftRequest): Promise<DraftActionResult> {
  await requireStaff([]);
  if (!z.uuid().safeParse(candidateId).success) return { ok: false, error: "Permintaan tidak valid." };
  const candidate = await getCandidate(candidateId);
  if (!candidate) return { ok: false, error: "Kandidat video tidak ditemukan." };
  return runDraft(
    {
      id: candidate.id,
      kind: "review_candidate",
      youtubeId: candidate.video.youtubeId,
      productName: candidate.product.name,
      channel: candidate.channel.title,
      title: candidate.video.title,
    },
    request
  );
}

/** Halaman ubah ringkasan (termasuk "Rapikan dengan AI" untuk ulasan format lama). */
export async function draftForReviewAction(reviewId: string, request: DraftRequest): Promise<DraftActionResult> {
  await requireStaff([]);
  if (!z.uuid().safeParse(reviewId).success) return { ok: false, error: "Permintaan tidak valid." };
  const review = await getReviewForEdit(reviewId);
  if (!review) return { ok: false, error: "Ringkasan tidak ditemukan." };
  return runDraft(
    {
      id: review.id,
      kind: "review",
      youtubeId: review.youtubeId,
      productName: review.productName,
      channel: review.channelName,
      title: review.videoTitle ?? "(judul tidak tersimpan)",
    },
    request
  );
}
