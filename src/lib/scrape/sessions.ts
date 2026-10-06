import "server-only";

import type { AdminSession } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import type { LineupItem, PreviewItem, ScrapeBrand } from "@/lib/scrape/types";

/**
 * Sesi tarik otomatis yang disimpan di server (rencana kerja impor, Fase 3.1).
 *
 * Daftar model + harga disimpan saat dimuat; hasil spesifikasi per model
 * disimpan saat diambil. Browser hanya memegang ID sesi (di URL), sehingga
 * refresh atau pindah perangkat tidak menghilangkan pekerjaan, dan data yang
 * akhirnya ditulis ke katalog selalu berasal dari server, bukan dari browser.
 */

export type ResultState =
  | { status: "ok"; item: PreviewItem }
  | { status: "error"; error: string; blocked: boolean };

export type ScrapeSession = {
  id: string;
  brand: ScrapeBrand;
  lineup: LineupItem[];
  fetchedAt: string;
  status: "open" | "committed";
  batchId: string | null;
  createdAt: string;
  results: Record<string, ResultState>;
};

export type ScrapeSessionSummary = {
  id: string;
  brand: ScrapeBrand;
  models: number;
  resolved: number;
  fetchedAt: string;
  status: "open" | "committed";
  batchId: string | null;
};

const UUID = /^[0-9a-f-]{36}$/i;
const STALE_COMMIT_MS = 5 * 60_000;
/** Sesi tarik disimpan selama ini, lalu dihapus worker terjadwal. */
export const SESSION_RETENTION_DAYS = 30;

function db() {
  return getInsforgeAdminClient().database;
}

/**
 * Hasil model untuk sejumlah sesi, dibaca per halaman sampai habis.
 * `scrape_results` memakai kunci gabungan (session_id, official_id) tanpa
 * kolom `id`, jadi tidak bisa memakai `selectWhereIn` (yang mengurutkan
 * berdasarkan `id`); urutannya memakai kunci itu sendiri.
 */
async function readResults(sessionIds: string[], columns: string): Promise<Record<string, unknown>[]> {
  if (sessionIds.length === 0) return [];
  const rows: Record<string, unknown>[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from("scrape_results")
      .select(columns)
      .in("session_id", sessionIds)
      .order("session_id", { ascending: true })
      .order("official_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[tarik] hasil model gagal dibaca:", error);
      throw new Error("Hasil tarik gagal dibaca.");
    }
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

export async function createSession(
  brand: ScrapeBrand,
  lineup: LineupItem[],
  fetchedAt: string,
  admin: AdminSession
): Promise<string | null> {
  const { data, error } = await db()
    .from("scrape_sessions")
    .insert([{ brand, lineup, fetched_at: fetchedAt, created_by: admin.userId, created_by_email: admin.email }])
    .select("id");
  if (error) {
    console.error("[tarik] sesi gagal disimpan:", error);
    return null;
  }
  return ((data ?? [])[0] as { id: string } | undefined)?.id ?? null;
}

export async function getSession(id: string): Promise<ScrapeSession | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db()
    .from("scrape_sessions")
    .select("id, brand, lineup, fetched_at, status, batch_id, created_at")
    .eq("id", id)
    .limit(1);
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (error || !row) return null;

  const results = await readResults([id], "official_id, item, error, blocked").catch(() => []);
  return {
    id: String(row.id),
    brand: row.brand as ScrapeBrand,
    lineup: (row.lineup ?? []) as LineupItem[],
    fetchedAt: String(row.fetched_at),
    status: row.status as ScrapeSession["status"],
    batchId: row.batch_id ? String(row.batch_id) : null,
    createdAt: String(row.created_at),
    results: Object.fromEntries(
      results.map((result) => [
        String(result.official_id),
        result.item
          ? { status: "ok" as const, item: result.item as PreviewItem }
          : { status: "error" as const, error: String(result.error ?? "Gagal diambil."), blocked: Boolean(result.blocked) },
      ])
    ),
  };
}

export async function saveResult(sessionId: string, officialId: string, state: ResultState): Promise<void> {
  const { error } = await db()
    .from("scrape_results")
    .upsert(
      [
        {
          session_id: sessionId,
          official_id: officialId,
          item: state.status === "ok" ? state.item : null,
          error: state.status === "error" ? state.error.slice(0, 500) : null,
          blocked: state.status === "error" ? state.blocked : false,
          resolved_at: new Date().toISOString(),
        },
      ],
      { onConflict: "session_id,official_id" }
    );
  if (error) console.error("[tarik] hasil model gagal disimpan:", error);
}

/**
 * Menandai sesi sudah dikirim ke Pusat Impor. Atomik: hanya satu permintaan
 * yang berhasil memindahkan `open → committed`, jadi klik ganda tidak
 * membuat dua batch.
 */
export async function claimCommit(sessionId: string): Promise<boolean> {
  // Sesi "committed" tanpa batch yang sudah lebih dari 5 menit berarti proses
  // pengiriman mati di tengah jalan; boleh diklaim ulang supaya tidak terkunci.
  // Dua UPDATE atomik terpisah, bukan satu `.or(... and(...))`: filter `or`
  // bersarang di UPDATE ditolak PostgREST InsForge ("column ... does not exist").
  const fresh = await db()
    .from("scrape_sessions")
    .update({ status: "committed" })
    .eq("id", sessionId)
    .eq("status", "open")
    .select("id");
  if (!fresh.error && (fresh.data ?? []).length > 0) return true;

  const stale = new Date(Date.now() - STALE_COMMIT_MS).toISOString();
  const reclaimed = await db()
    .from("scrape_sessions")
    .update({ status: "committed" })
    .eq("id", sessionId)
    .eq("status", "committed")
    .is("batch_id", null)
    .lt("updated_at", stale)
    .select("id");
  return !reclaimed.error && (reclaimed.data ?? []).length > 0;
}

/**
 * Menghapus sesi lama beserta hasilnya. Harga di dalamnya sudah tidak layak
 * dikirim (lihat SESSION_PRICE_MAX_AGE_DAYS), jadi menyimpannya hanya
 * membesarkan tabel. Batch yang sudah dibuat tidak terpengaruh.
 */
export async function purgeOldSessions(maxAgeDays = SESSION_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000).toISOString();
  const { data, error } = await db().from("scrape_sessions").delete().lt("created_at", cutoff).select("id");
  if (error) {
    console.error("[tarik] sesi lama gagal dihapus:", error);
    return 0;
  }
  return (data ?? []).length;
}

export async function linkBatch(sessionId: string, batchId: string | null): Promise<void> {
  // batchId null = pembuatan batch gagal: sesi dibuka lagi supaya bisa dicoba ulang.
  await db()
    .from("scrape_sessions")
    .update(batchId ? { batch_id: batchId } : { status: "open" })
    .eq("id", sessionId);
}

export async function listRecentSessions(limit = 5): Promise<ScrapeSessionSummary[]> {
  const { data, error } = await db()
    .from("scrape_sessions")
    .select("id, brand, lineup, fetched_at, status, batch_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  const rows = (data ?? []) as Record<string, unknown>[];
  const counts = await readResults(rows.map((row) => String(row.id)), "session_id").catch(() => []);
  const resolvedBySession = new Map<string, number>();
  for (const row of counts) resolvedBySession.set(String(row.session_id), (resolvedBySession.get(String(row.session_id)) ?? 0) + 1);
  return rows.map((row) => ({
    id: String(row.id),
    brand: row.brand as ScrapeBrand,
    models: Array.isArray(row.lineup) ? row.lineup.length : 0,
    resolved: resolvedBySession.get(String(row.id)) ?? 0,
    fetchedAt: String(row.fetched_at),
    status: row.status as ScrapeSession["status"],
    batchId: row.batch_id ? String(row.batch_id) : null,
  }));
}
