import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { BLOCK_COOLDOWN_HOURS, cooldownMessage, cooldownUntil } from "@/lib/scrape/cooldown-rules";

/**
 * Pemeriksa masa tenang per host (lihat cooldown-rules.ts).
 *
 * Sumber kebenarannya catatan job yang sudah ada: job tarik berstatus
 * `blocked` menyimpan pesan blokir yang menyebut host-nya, jadi tidak perlu
 * tabel atau migrasi baru. Hasil baca disimpan 60 detik per host supaya
 * pengambilan beruntun tidak menanyai database setiap request.
 */

/** Dilempar selama masa tenang. BUKAN ScrapeBlockedError: menunggu tidak boleh memperpanjang masa tenang. */
export class ScrapeCooldownError extends Error {}

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; lastBlockedAt: string | null }>();

async function lastBlockedAt(host: string): Promise<string | null> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.lastBlockedAt;

  const since = new Date(Date.now() - BLOCK_COOLDOWN_HOURS * 3_600_000).toISOString();
  const { data, error } = await getInsforgeAdminClient()
    .database.from("scrape_jobs")
    .select("finished_at")
    .eq("status", "blocked")
    .gte("finished_at", since)
    .ilike("error", `%${host}%`)
    .order("finished_at", { ascending: false })
    .limit(1);
  if (error) {
    // Gagal membaca bukan alasan memblokir admin; catat dan lanjutkan.
    console.error("[tarik] masa tenang gagal dibaca:", error);
    return null;
  }
  const value = ((data ?? []) as { finished_at: string | null }[])[0]?.finished_at ?? null;
  cache.set(host, { at: Date.now(), lastBlockedAt: value });
  return value;
}

/** Lempar ScrapeCooldownError bila host masih dalam masa tenang. */
export async function assertNoCooldown(host: string): Promise<void> {
  const until = cooldownUntil(await lastBlockedAt(host));
  if (until) throw new ScrapeCooldownError(cooldownMessage(host, until));
}

/** Untuk UI: akhir masa tenang host, atau null. */
export async function cooldownFor(host: string): Promise<Date | null> {
  return cooldownUntil(await lastBlockedAt(host));
}

/**
 * Blokir baru terjadi di proses ini: masa tenang langsung berlaku tanpa
 * menunggu job-nya selesai tercatat atau cache 60 detik kedaluwarsa.
 */
export function rememberBlock(host: string, at: number = Date.now()): void {
  cache.set(host, { at, lastBlockedAt: new Date(at).toISOString() });
}
