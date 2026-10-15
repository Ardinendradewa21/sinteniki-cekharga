import "server-only";

import { createHmac } from "node:crypto";

import { AI_LIMITS } from "@/lib/assistant/ai/client";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";

/**
 * Kuota harian asisten AI (aturan system design 1, PB-21).
 *
 * Pembatas per menit (`rateLimit` di client.ts) meredam semburan, tetapi
 * hidup di memori satu instance. Kuota harian di sini dihitung bersama di
 * database (`ai_consume_quota`), jadi biaya terburuk per hari benar-benar
 * terbatas walau aplikasi berjalan di banyak instance.
 *
 * IP tidak pernah disimpan: yang dikirim ke database hanya HMAC-nya, dengan
 * rahasia `AI_QUOTA_SECRET` (cadangan: `INSFORGE_API_KEY`, pola yang sama
 * dengan dedupe event iklan).
 *
 * Bila database kuota tidak bisa dihubungi, permintaan DITOLAK (gagal
 * tertutup). Tanpa hitungan, batas biaya harian tidak bisa dijamin; pengguna
 * tetap punya jalur form yang tidak memanggil model.
 */

type QuotaDecision =
  | { allowed: true }
  | { allowed: false; reason: "client" | "global" | "unavailable" };

export function quotaSubject(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(`ai-quota:${ip}`).digest("hex").slice(0, 40);
}

export function quotaMessage(reason: Exclude<QuotaDecision, { allowed: true }>["reason"]): string {
  switch (reason) {
    case "client":
      return "Batas harian Tanya AI dari perangkat ini sudah tercapai. Gunakan form pencarian, atau coba lagi besok.";
    case "global":
      return "Tanya AI sedang mencapai batas harian. Gunakan form pencarian, atau coba lagi besok.";
    case "unavailable":
      return "Tanya AI sedang tidak bisa dipakai. Gunakan form pencarian dulu.";
  }
}

function quotaSecret(): string | null {
  return process.env.AI_QUOTA_SECRET?.trim() || process.env.INSFORGE_API_KEY?.trim() || null;
}

export async function consumeDailyQuota(ip: string): Promise<QuotaDecision> {
  const secret = quotaSecret();
  if (!secret) {
    console.error("[ai-kuota] AI_QUOTA_SECRET dan INSFORGE_API_KEY kosong; kuota tidak bisa dihitung.");
    return { allowed: false, reason: "unavailable" };
  }

  const { data, error } = await getInsforgeAdminClient().database.rpc("ai_consume_quota", {
    p_subject: quotaSubject(ip, secret),
    p_subject_limit: AI_LIMITS.dailyPerClient,
    p_global_limit: AI_LIMITS.dailyGlobal,
  });
  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; subject_calls: number; global_calls: number }
    | undefined;
  if (error || !row) {
    console.error("[ai-kuota] kuota gagal dibaca:", error);
    return { allowed: false, reason: "unavailable" };
  }
  if (row.allowed) return { allowed: true };
  return { allowed: false, reason: row.subject_calls >= AI_LIMITS.dailyPerClient ? "client" : "global" };
}

/** Retensi hitungan harian; dipanggil cron harian. */
export async function purgeAiUsage(keepDays = 30): Promise<number> {
  const { data, error } = await getInsforgeAdminClient().database.rpc("ai_purge_usage", { p_keep_days: keepDays });
  if (error) throw new Error("Hitungan kuota AI lama gagal dihapus.");
  return Number(data ?? 0);
}
