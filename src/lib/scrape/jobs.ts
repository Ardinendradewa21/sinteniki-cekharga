import "server-only";

import type { AdminSession } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { friendlyError, resolveLineupItem } from "@/lib/scrape/resolve";
import { createSession, getSession, saveResult } from "@/lib/scrape/sessions";
import { fetchLineup } from "@/lib/scrape/sources";
import type { ScrapeBrand } from "@/lib/scrape/types";

/**
 * Worker tarik otomatis (aturan system design 3, sisa PB-19; tabel
 * `scrape_jobs`, migrasi scrape-jobs).
 *
 * Pengambilan dari situs resmi dan GSMArena tidak pernah berjalan di dalam
 * request admin. Aksi admin hanya mengantrekan job dan menjadwalkan worker
 * lewat `after()`; worker terjadwal (/api/admin/import/worker dan cron
 * harian) melanjutkan sisanya. Browser membaca status lewat polling.
 *
 * Kesopanan dijaga di dua lapis: klaim di database hanya memberi satu job per
 * jenis yang berjalan pada satu waktu di seluruh instance, dan jeda per host
 * tetap berlaku di dalam `politeFetch`. Begitu sumber meminta verifikasi
 * anti-bot, sisa job sesi itu dihentikan, tidak dicoba memaksa.
 */

export type ScrapeJobStatus = "queued" | "running" | "done" | "failed" | "blocked" | "cancelled";

type ScrapeJob = {
  id: string;
  kind: "lineup" | "resolve";
  brand: ScrapeBrand;
  session_id: string | null;
  official_id: string | null;
  path_override: string | null;
  status: ScrapeJobStatus;
  attempts: number;
  error: string | null;
  created_by: string | null;
  created_by_email: string | null;
};

/** Satu job = satu pengambilan; lease cukup untuk beberapa permintaan dengan jeda sopan. */
const JOB_LEASE_SECONDS = 90;
/** Percobaan maksimum untuk job yang workernya mati di tengah jalan. */
const MAX_JOB_ATTEMPTS = 3;
/** Job selesai disimpan sebentar untuk riwayat; sesi sendiri disimpan 30 hari. */
const JOB_RETENTION_DAYS = 30;

function db() {
  return getInsforgeAdminClient().database;
}

function actorOf(job: ScrapeJob): AdminSession {
  return { userId: job.created_by ?? "", email: job.created_by_email ?? "worker", role: "admin" };
}

async function finish(id: string, status: ScrapeJobStatus, error: string | null, extra: Record<string, unknown> = {}) {
  const { error: writeError } = await db()
    .from("scrape_jobs")
    .update({ status, error: error?.slice(0, 500) ?? null, lease_until: null, finished_at: new Date().toISOString(), ...extra })
    .eq("id", id);
  if (writeError) console.error("[tarik-worker] status job gagal disimpan:", writeError);
}

/* ------------------------------------------------------------- antrean */

export async function enqueueLineup(brand: ScrapeBrand, admin: AdminSession): Promise<string | null> {
  const { data, error } = await db()
    .from("scrape_jobs")
    .insert([{ kind: "lineup", brand, created_by: admin.userId || null, created_by_email: admin.email }])
    .select("id");
  if (error) console.error("[tarik] job daftar model gagal dibuat:", error);
  return ((data ?? [])[0] as { id: string } | undefined)?.id ?? null;
}

/**
 * Mengantrekan pengambilan spesifikasi. Job yang sudah ada untuk model yang
 * sama diantrekan ulang (bukan diduplikasi), termasuk saat admin memilih
 * halaman GSMArena lain (`pathOverride`).
 */
export async function enqueueResolve(
  sessionId: string,
  brand: ScrapeBrand,
  officialIds: readonly string[],
  admin: AdminSession,
  pathOverride: string | null = null
): Promise<boolean> {
  const existing = await db()
    .from("scrape_jobs")
    .select("id, official_id")
    .eq("session_id", sessionId)
    .eq("kind", "resolve")
    .in("official_id", [...officialIds]);
  if (existing.error) return false;
  const known = new Map(((existing.data ?? []) as { id: string; official_id: string }[]).map((row) => [row.official_id, row.id]));

  const requeue = [...known.values()];
  if (requeue.length > 0) {
    const { error } = await db()
      .from("scrape_jobs")
      .update({ status: "queued", error: null, attempts: 0, lease_until: null, finished_at: null, path_override: pathOverride })
      .in("id", requeue)
      .neq("status", "running");
    if (error) return false;
  }
  const fresh = officialIds.filter((id) => !known.has(id));
  if (fresh.length > 0) {
    const { error } = await db()
      .from("scrape_jobs")
      .insert(
        fresh.map((officialId) => ({
          kind: "resolve",
          brand,
          session_id: sessionId,
          official_id: officialId,
          path_override: pathOverride,
          created_by: admin.userId || null,
          created_by_email: admin.email,
        }))
      );
    if (error) {
      console.error("[tarik] job spesifikasi gagal dibuat:", error);
      return false;
    }
  }
  return true;
}

/** Menghentikan job yang belum berjalan untuk satu sesi (tombol Hentikan, atau blokir anti-bot). */
export async function cancelQueuedJobs(sessionId: string, reason: string, status: "cancelled" | "blocked" = "cancelled"): Promise<number> {
  const { data, error } = await db()
    .from("scrape_jobs")
    .update({ status, error: reason, finished_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("status", "queued")
    .select("id");
  if (error) console.error("[tarik] job gagal dihentikan:", error);
  return (data ?? []).length;
}

/* ---------------------------------------------------------------- worker */

async function runLineup(job: ScrapeJob): Promise<void> {
  try {
    const items = await fetchLineup(job.brand);
    const fetchedAt = new Date().toISOString();
    const sessionId = await createSession(job.brand, items, fetchedAt, actorOf(job));
    if (!sessionId) throw new Error("Daftar model terambil tetapi sesi gagal disimpan.");
    await finish(job.id, "done", null, { session_id: sessionId });
  } catch (error) {
    const friendly = error instanceof Error && error.message.startsWith("Daftar model terambil")
      ? { error: error.message, blocked: false }
      : friendlyError(error);
    await finish(job.id, friendly.blocked ? "blocked" : "failed", friendly.error);
  }
}

async function runResolve(job: ScrapeJob): Promise<void> {
  const session = job.session_id ? await getSession(job.session_id) : null;
  if (!session || session.status !== "open") {
    await finish(job.id, "cancelled", "Sesi tarik sudah dikirim ke Pusat Impor atau tidak ditemukan.");
    return;
  }
  const lineup = session.lineup.find((item) => item.officialId === job.official_id);
  if (!lineup) {
    await finish(job.id, "failed", "Model tidak ada di daftar sesi ini.");
    return;
  }

  const result = await resolveLineupItem(lineup, job.path_override ?? undefined);
  await saveResult(
    session.id,
    lineup.officialId,
    result.ok ? { status: "ok", item: result.item } : { status: "error", error: result.error, blocked: result.blocked }
  );
  if (result.ok) {
    await finish(job.id, "done", null);
  } else if (result.blocked) {
    // Sumber meminta verifikasi anti-bot: berhenti, jangan dipaksa.
    await finish(job.id, "blocked", result.error);
    await cancelQueuedJobs(session.id, "Dihentikan: sumber meminta verifikasi anti-bot. Coba lagi nanti.", "blocked");
  } else {
    await finish(job.id, "failed", result.error);
  }
}

/**
 * Satu langkah worker: klaim dan kerjakan job satu per satu selama masih ada
 * waktu. Aman dipanggil bersamaan dari beberapa tempat; klaim di database
 * yang menentukan siapa mengerjakan apa.
 */
export async function processScrapeStep(budgetMs = 40_000): Promise<{ processed: number }> {
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < budgetMs) {
    const claim = await db().rpc("scrape_claim_job", { p_lease_seconds: JOB_LEASE_SECONDS });
    if (claim.error) {
      console.error("[tarik-worker] klaim gagal:", claim.error);
      break;
    }
    const job = ((claim.data ?? []) as ScrapeJob[])[0];
    if (!job) break;
    processed += 1;
    if (job.attempts > MAX_JOB_ATTEMPTS) {
      await finish(job.id, "failed", `Dihentikan setelah ${MAX_JOB_ATTEMPTS} kali percobaan yang terputus.`);
      continue;
    }
    if (job.kind === "lineup") await runLineup(job);
    else await runResolve(job);
  }
  return { processed };
}

/* ---------------------------------------------------------------- status */

export async function getScrapeJob(id: string): Promise<ScrapeJob | null> {
  const { data } = await db()
    .from("scrape_jobs")
    .select("id, kind, brand, session_id, official_id, path_override, status, attempts, error, created_by, created_by_email")
    .eq("id", id)
    .limit(1);
  return ((data ?? [])[0] as ScrapeJob | undefined) ?? null;
}

export async function sessionJobs(sessionId: string): Promise<Pick<ScrapeJob, "official_id" | "status" | "error">[]> {
  const { data } = await db()
    .from("scrape_jobs")
    .select("official_id, status, error")
    .eq("session_id", sessionId)
    .eq("kind", "resolve")
    .order("created_at", { ascending: true })
    .limit(1000);
  return (data ?? []) as Pick<ScrapeJob, "official_id" | "status" | "error">[];
}

/** Ada job menunggu yang tidak sedang dipegang worker mana pun. */
export async function hasIdleQueuedJobs(): Promise<boolean> {
  const { data } = await db()
    .from("scrape_jobs")
    .select("id")
    .eq("status", "queued")
    .limit(1);
  return (data ?? []).length > 0;
}

/** Retensi: job yang sudah selesai lebih dari 30 hari dihapus (sesinya punya retensi sendiri). */
export async function purgeScrapeJobs(keepDays = JOB_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - keepDays * 86_400_000).toISOString();
  const { data, error } = await db()
    .from("scrape_jobs")
    .delete()
    .in("status", ["done", "failed", "blocked", "cancelled"])
    .lt("finished_at", cutoff)
    .select("id");
  if (error) throw new Error("Job tarik lama gagal dihapus.");
  return (data ?? []).length;
}
