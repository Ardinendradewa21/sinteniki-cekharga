"use server";

import { after } from "next/server";
import { z } from "zod";

import { requireStaff } from "@/lib/auth/dal";
import { createBatch, stageUpload } from "@/lib/import/batches";
import { loadOfferContext } from "@/lib/import/offer-runner";
import { planPricesOnly } from "@/lib/scrape/prices-only-rules";
import { processBatchStep } from "@/lib/import/jobs";
import { readImageRights } from "@/lib/import/image-rights";
import { mapRow } from "@/lib/import/gsmarena";
import { planCommit, sessionAgeDays, SESSION_PRICE_MAX_AGE_DAYS } from "@/lib/scrape/commit-rules";
import type { SpecRow } from "@/lib/scrape/parsers";
import {
  cancelQueuedJobs,
  enqueueLineup,
  enqueueResolve,
  getScrapeJob,
  hasIdleQueuedJobs,
  processScrapeStep,
  sessionJobs,
  type ScrapeJobStatus,
} from "@/lib/scrape/jobs";
import { claimCommit, getSession, getSessionResults, linkBatch, type ResultState } from "@/lib/scrape/sessions";
import { GSMARENA_PATH, officialSourceFor } from "@/lib/scrape/sources";
import { SCRAPE_BRAND_LABELS, SCRAPE_BRANDS, type CommitSummary, type LineupItem } from "@/lib/scrape/types";

/**
 * Aksi tarik otomatis (admin). Semua langkah bekerja di atas SESI yang
 * disimpan server (lihat sessions.ts):
 *
 *   1. startLineupAction  — antrekan pengambilan daftar + harga resmi (worker membuat sesi).
 *   2. queueResolveAction — antrekan pengambilan spesifikasi model terpilih (worker menyimpan hasil).
 *      pollScrapeAction   — status untuk halaman; tidak mengambil apa pun di request.
 *   3. commitScrapeAction — kirim model terpilih ke Pusat Impor; pratinjaunya dianalisis worker.
 *
 * Pengambilan dari situs lain tidak pernah berjalan di dalam request admin
 * (aturan system design 3); lihat `@/lib/scrape/jobs`.
 *
 * Browser hanya mengirim ID sesi, ID model, dan pilihan admin. Daftar model,
 * harga resmi, dan spesifikasi tidak pernah dipercaya dari browser.
 */

const MAX_COMMIT_ITEMS = 150;
/** Batas model per antrean sekali klik; daftar merek terbesar sekitar 120 model. */
const MAX_RESOLVE_ITEMS = 200;

/** Menjadwalkan worker setelah respons dikirim (tetap jalan walau ada redirect, sampai maxDuration halaman). */
function scheduleWorker() {
  after(() => processScrapeStep());
}

/* ------------------------------------------------------------ tahap 1 */

type StartLineupResult = { ok: true; jobId: string } | { ok: false; error: string };

/** Mengantrekan pengambilan daftar model satu merek. Pengambilannya di worker. */
export async function startLineupAction(brand: string): Promise<StartLineupResult> {
  const admin = await requireStaff([]);
  const parsed = z.enum(SCRAPE_BRANDS).safeParse(brand);
  if (!parsed.success) return { ok: false, error: "Merek belum didukung." };
  const jobId = await enqueueLineup(parsed.data, admin);
  if (!jobId) return { ok: false, error: "Permintaan tarik gagal dicatat. Coba lagi." };
  scheduleWorker();
  return { ok: true, jobId };
}

/* ------------------------------------------------------------ tahap 2 */

/** Mengantrekan pengambilan spesifikasi model terpilih dari sesi. Pengambilannya di worker. */
export async function queueResolveAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireStaff([]);
  const parsed = z
    .object({
      sessionId: z.uuid(),
      officialIds: z.array(z.string().min(1).max(80)).min(1).max(MAX_RESOLVE_ITEMS),
      pathOverride: z.string().regex(GSMARENA_PATH).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data model tidak valid." };
  const { sessionId, officialIds, pathOverride } = parsed.data;

  const session = await getSession(sessionId);
  if (!session) return { ok: false, error: "Sesi tarik tidak ditemukan. Muat ulang daftar model." };
  if (session.status !== "open") {
    return { ok: false, error: "Sesi ini sudah dikirim ke Pusat Impor. Muat daftar baru untuk menarik lagi." };
  }
  const known = new Set(session.lineup.map((item) => item.officialId));
  const ids = [...new Set(officialIds)].filter((id) => known.has(id));
  if (ids.length === 0) return { ok: false, error: "Model tidak ada di daftar sesi ini." };

  if (!(await enqueueResolve(sessionId, session.brand, ids, admin, pathOverride ?? null))) {
    return { ok: false, error: "Antrean pengambilan gagal dicatat. Coba lagi." };
  }
  scheduleWorker();
  return { ok: true };
}

export async function stopResolveAction(sessionId: string): Promise<number> {
  await requireStaff([]);
  if (!z.uuid().safeParse(sessionId).success) return 0;
  return cancelQueuedJobs(sessionId, "Dihentikan admin.");
}

export type ScrapePoll = {
  /** Job daftar model yang ditanyakan (`jobId`). */
  lineup: {
    status: ScrapeJobStatus;
    error: string | null;
    sessionId: string | null;
    items: LineupItem[] | null;
    fetchedAt: string | null;
  } | null;
  /** Hasil dan status job spesifikasi sesi yang ditanyakan (`sessionId`). */
  session: {
    results: Record<string, ResultState>;
    jobs: { officialId: string; status: ScrapeJobStatus; error: string | null }[];
  } | null;
};

/**
 * Status tarik untuk polling halaman. TIDAK menjalankan pengambilan di request
 * ini: bila ada job menunggu, worker dijadwalkan lewat `after()` setelah
 * respons dikirim (worker terjadwal juga melanjutkannya bila tab ditutup).
 */
export async function pollScrapeAction(input: unknown): Promise<ScrapePoll> {
  await requireStaff([]);
  const parsed = z.object({ jobId: z.uuid().optional(), sessionId: z.uuid().optional() }).safeParse(input);
  if (!parsed.success) return { lineup: null, session: null };
  const { jobId, sessionId } = parsed.data;

  let lineup: ScrapePoll["lineup"] = null;
  if (jobId) {
    const job = await getScrapeJob(jobId);
    if (job) {
      const session = job.status === "done" && job.session_id ? await getSession(job.session_id) : null;
      lineup = {
        status: job.status,
        error: job.error,
        sessionId: job.session_id,
        items: session?.lineup ?? null,
        fetchedAt: session?.fetchedAt ?? null,
      };
    }
  }

  let sessionState: ScrapePoll["session"] = null;
  if (sessionId) {
    const [results, jobs] = await Promise.all([getSessionResults(sessionId), sessionJobs(sessionId)]);
    sessionState = {
      results,
      jobs: jobs.map((job) => ({ officialId: String(job.official_id), status: job.status, error: job.error })),
    };
  }

  if (await hasIdleQueuedJobs()) scheduleWorker();
  return { lineup, session: sessionState };
}

/* ------------------------------------------------------------ tahap 3 */

export async function commitScrapeAction(input: unknown): Promise<CommitSummary> {
  const admin = await requireStaff([]);
  const parsed = z
    .object({
      sessionId: z.uuid(),
      items: z
        .array(
          z.object({
            officialId: z.string().min(1).max(80),
            assignments: z.record(z.string().regex(/^\d{1,2}$/), z.string().regex(/^\d{1,3}\+\d{1,5}$/)).optional(),
          })
        )
        .min(1)
        .max(MAX_COMMIT_ITEMS),
      imageUsageRights: z.string().trim().max(500),
      imageUsageBasis: z.string().trim().max(40).default(""),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { error: "Data yang akan disimpan tidak valid. Muat ulang pratinjau.", specs: null, prices: null };
  }
  const { sessionId, items, imageUsageRights, imageUsageBasis } = parsed.data;

  const rights = readImageRights(imageUsageBasis, imageUsageRights);
  if (!rights.ok) return { error: rights.error, specs: null, prices: null };

  const session = await getSession(sessionId);
  if (!session) return { error: "Sesi tarik tidak ditemukan. Muat ulang daftar model.", specs: null, prices: null };
  if (session.status === "committed" && session.batchId) {
    // Klik ganda / kiriman ulang: arahkan ke batch yang sudah dibuat, jangan buat lagi.
    return { error: null, specs: null, prices: null, batchId: session.batchId };
  }
  const ageDays = sessionAgeDays(session.fetchedAt, new Date());
  if (ageDays > SESSION_PRICE_MAX_AGE_DAYS) {
    return {
      error: `Daftar harga sesi ini diambil ${ageDays} hari lalu. Muat daftar baru supaya harga yang disimpan masih berlaku.`,
      specs: null,
      prices: null,
    };
  }

  const plan = planCommit(session.results, items);
  if (plan.accepted.length === 0) {
    return { error: plan.rejected[0]?.reason ?? "Tidak ada model yang bisa dikirim.", specs: null, prices: null };
  }
  if (!(await claimCommit(sessionId))) {
    return { error: "Sesi ini sedang dikirim. Tunggu sebentar lalu muat ulang.", specs: null, prices: null };
  }

  // Waktu pengamatan harga = saat daftar harga diambil dari situs resmi,
  // bukan saat tombol Kirim diklik.
  const observedAt = session.fetchedAt;
  const offerRows = plan.accepted.flatMap(({ item, prices }) => {
    const outcome = mapRow(item.specRow as SpecRow);
    if (!outcome.ok) return [];
    const source = officialSourceFor(item.lineup.brand);
    const officialUrl = item.lineup.officialUrl;
    if (!source || !officialUrl || new URL(officialUrl).hostname !== source.host) return [];
    return prices.map((price) => {
      // Halaman khusus varian (Digimap) dipakai bila host-nya sah; selain itu halaman model.
      const url = price.url && new URL(price.url).hostname === source.host ? price.url : officialUrl;
      return {
        // Diganti slug produk yang tersimpan saat batch harga dibuat.
        source_key: outcome.candidate.sourceKey,
        ram_gb: String(price.ramGb),
        storage_gb: String(price.storageGb),
        marketplace: source.marketplace,
        seller_name: source.sellerName,
        url,
        // Garansi tidak dinyatakan eksplisit di data situs; dibiarkan kosong
        // (tidak diketahui) daripada ditebak.
        warranty: "",
        // Varian yang semua warnanya habis dicatat apa adanya, sehingga tidak
        // menjadi harga aktif (PRD §7 butir 2).
        listing_status: price.inStock === false ? "out-of-stock" : "active",
        seller_verified: "tidak",
        price_idr: String(price.priceIdr),
        observed_at: observedAt,
      };
    });
  });

  const stamp = new Date(session.fetchedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-");
  // Batch dianalisis worker (pencocokan dan diff tidak di request ini); halaman
  // batch menampilkan "Sedang dianalisis" lalu pratinjaunya.
  const created = await stageUpload({
    kind: "specs",
    origin: "scrape",
    role: "row",
    sourceLabel: `Tarik otomatis ${session.brand} ${stamp}`,
    options: {
      imageRights: rights.rights,
      scrapeSessionId: sessionId,
      ...(offerRows.length > 0
        ? {
            followUpOffers: {
              sourceLabel: `Harga resmi ${session.brand} ${stamp}`,
              defaultObservedAt: observedAt,
              rows: offerRows,
            },
          }
        : {}),
    },
    rows: plan.accepted.map(({ item }) => stringRow(item.specRow as SpecRow)),
    malformedLines: [],
    admin,
  });
  await linkBatch(sessionId, created.ok ? created.id : null);
  if (!created.ok) return { error: created.error, specs: null, prices: null };
  after(() => processBatchStep(created.id));
  return { error: null, specs: null, prices: null, batchId: created.id };
}

/** Baris CSV selalu berisi teks; nilai spesifikasi disamakan bentuknya. */
function stringRow(row: SpecRow): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)])
  );
}

export type PricesOnlySummary = {
  error: string | null;
  batchId?: string;
  matched: number;
  rows: number;
  unmatched: string[];
  notes: { name: string; reason: string }[];
};

/**
 * Tarik "harga saja" (PB-16): penawaran resmi untuk produk katalog yang sudah
 * ada, dari daftar harga sesi ini, tanpa membuka GSMArena. Hasilnya batch
 * penawaran di Pusat Impor yang DITINJAU admin sebelum diterapkan; tidak ada
 * yang tampil ke publik tanpa keputusan manusia.
 */
export async function pricesOnlyAction(sessionId: string): Promise<PricesOnlySummary> {
  const admin = await requireStaff([]);
  const empty = { matched: 0, rows: 0, unmatched: [], notes: [] };
  const session = await getSession(sessionId);
  if (!session) return { error: "Sesi tarik tidak ditemukan. Muat ulang daftar model.", ...empty };
  const ageDays = sessionAgeDays(session.fetchedAt, new Date());
  if (ageDays > SESSION_PRICE_MAX_AGE_DAYS) {
    return { error: `Daftar harga sesi ini diambil ${ageDays} hari lalu. Muat daftar baru dulu.`, ...empty };
  }
  const source = officialSourceFor(session.brand);
  if (!source) return { error: "Merek ini tidak punya sumber harga resmi; harga hanya lewat CSV penawaran.", ...empty };

  const context = await loadOfferContext();
  if (!context) return { error: "Data katalog gagal dibaca. Coba lagi sebentar.", ...empty };

  const plan = planPricesOnly({
    lineup: session.lineup,
    products: context.catalogProducts,
    source,
    brandName: SCRAPE_BRAND_LABELS[session.brand].split(" (")[0]!,
    observedAt: session.fetchedAt,
  });
  const summary = { matched: plan.matched.length, rows: plan.rows.length, unmatched: plan.unmatched, notes: plan.notes };
  if (plan.rows.length === 0) {
    return { error: "Tidak ada harga yang cocok dengan produk dan varian di katalog.", ...summary };
  }

  const created = await createBatch({
    kind: "offers",
    origin: "scrape",
    sourceLabel: `Harga saja ${source.marketplace} ${session.fetchedAt.slice(0, 10)}`,
    options: { defaultObservedAt: session.fetchedAt, imageRights: null },
    rows: plan.rows,
    malformedLines: [],
    admin,
  });
  if (!created.ok) return { error: created.error, ...summary };
  return { error: null, batchId: created.id, ...summary };
}
