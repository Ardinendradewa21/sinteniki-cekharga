import { bearerMatches } from "@/lib/backend/bearer";
import { expireStaleDrafts, purgeScheduledBatches } from "@/lib/import/batches";
import { listWorkableBatches, processBatchStep } from "@/lib/import/jobs";
import { processPhotoStep, purgePhotoJobs } from "@/lib/import/photo-jobs";
import { runPriceRefresh } from "@/lib/import/price-refresh";
import { purgeOldSessions } from "@/lib/scrape/sessions";

/**
 * Pekerjaan harian katalog, dipanggil Cron Vercel (`vercel.json`).
 *
 * Cron Vercel memanggil URL produksi dengan HTTP GET dan header
 * `Authorization: Bearer <CRON_SECRET>`, dalam UTC, tanpa mengulang yang gagal
 * dan tanpa mencegah dua pemanggilan tumpang tindih. Karena itu setiap tugas
 * di sini idempoten:
 *   - draft kedaluwarsa, retensi sesi/antrean/batch: UPDATE/DELETE bersyarat,
 *   - pemeriksaan harga: kunci unik per merek per tanggal WIB,
 *   - penerapan antrean: klaim lease atomik yang sama dengan worker per menit.
 *
 * Pekerjaan yang tidak selesai dalam anggaran waktu dilanjutkan worker per
 * menit (`/api/admin/import/worker`, InsForge Schedules) atau halaman batch.
 */

export const maxDuration = 60;

const TOTAL_BUDGET_MS = 50_000;

type TaskReport = { ok: true; result: unknown } | { ok: false; error: string };

async function task(run: () => Promise<unknown>): Promise<TaskReport> {
  try {
    return { ok: true, result: await run() };
  } catch (error) {
    console.error("[cron-harian] tugas gagal:", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: Request) {
  if (!bearerMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const left = () => TOTAL_BUDGET_MS - (Date.now() - started);

  const report: Record<string, TaskReport> = {
    expiredDrafts: await task(() => expireStaleDrafts(null)),
    purgedSessions: await task(() => purgeOldSessions()),
    purgedPhotoJobs: await task(() => purgePhotoJobs()),
    purgedScheduledBatches: await task(() => purgeScheduledBatches()),
    priceRefresh: await task(() => runPriceRefresh()),
  };

  // Sisa waktu dipakai menerapkan antrean (termasuk batch harga barusan).
  report.applied = await task(async () => {
    const worked: { id: string; status: string | null; processed: number }[] = [];
    for (const id of await listWorkableBatches(10)) {
      if (left() < 8_000) break;
      const step = await processBatchStep(id, Math.min(left() - 3_000, 40_000));
      if (step.claimed) worked.push({ id, status: step.status, processed: step.processed });
    }
    return worked;
  });
  report.photos = await task(() =>
    left() > 8_000 ? processPhotoStep(left() - 3_000) : Promise.resolve({ processed: 0, changed: 0 })
  );

  const failed = Object.values(report).some((item) => !item.ok);
  return Response.json(report, { status: failed ? 500 : 200 });
}
