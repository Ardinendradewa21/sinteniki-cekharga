"use server";

import { z } from "zod";

import { recordAudit } from "@/lib/admin/audit";
import { consumeStaffQuota } from "@/lib/assistant/ai/quota";
import { hasAiCredentials } from "@/lib/assistant/ai/client";
import { requireStaff } from "@/lib/auth/dal";
import { createRateLimiter } from "@/lib/rate-limit";
import { draftFromVideo, VIDEO_DRAFT_LIMITS, type VideoDraft } from "@/lib/reviews/ai-draft";
import { getCandidate } from "@/lib/reviews/queries";

/**
 * Aksi "Buat draf dengan AI" di halaman tulis ringkasan (admin saja).
 *
 * Urutan pembatas (aturan system design 1): hak akses di server, batas per
 * menit per admin, lalu kuota harian per admin di database. Draf tidak
 * disimpan; ia hanya mengisi formulir dan admin yang menerbitkan.
 */

const perMinute = createRateLimiter({ limit: VIDEO_DRAFT_LIMITS.perMinute, windowMs: 60_000 });

export type DraftActionResult = { ok: true; draft: VideoDraft } | { ok: false; error: string };

export async function draftReviewFromVideoAction(candidateId: string, aspect: string): Promise<DraftActionResult> {
  const admin = await requireStaff([]);
  const parsed = z.object({ id: z.uuid(), aspect: z.enum(["umum", "kamera"]) }).safeParse({ id: candidateId, aspect });
  if (!parsed.success) return { ok: false, error: "Permintaan tidak valid." };
  if (!hasAiCredentials()) return { ok: false, error: "Kunci OpenRouter belum terpasang. Tulis ringkasan manual." };

  const candidate = await getCandidate(parsed.data.id);
  if (!candidate) return { ok: false, error: "Kandidat video tidak ditemukan." };

  const limit = perMinute.check(admin.userId || admin.email);
  if (!limit.allowed) return { ok: false, error: `Terlalu cepat. Tunggu ${limit.retryAfterSec} detik.` };
  const quota = await consumeStaffQuota("draf-ulasan-video", admin.userId || admin.email, VIDEO_DRAFT_LIMITS.perAdminDaily);
  if (!quota.allowed) {
    return {
      ok: false,
      error:
        quota.reason === "client"
          ? `Jatah draf AI hari ini (${VIDEO_DRAFT_LIMITS.perAdminDaily} video) sudah habis. Tulis manual atau lanjut besok.`
          : "Kuota AI sedang tidak tersedia. Tulis ringkasan manual.",
    };
  }

  const result = await draftFromVideo({
    youtubeId: candidate.video.youtubeId,
    productName: candidate.product.name,
    channel: candidate.channel.title,
    title: candidate.video.title,
    aspect: parsed.data.aspect,
  });
  await recordAudit(admin, "ulasan.draf-ai", "review_candidate", candidate.id, {
    aspect: parsed.data.aspect,
    berhasil: result.ok,
  });
  return result.ok ? result : { ok: false, error: result.reason };
}
