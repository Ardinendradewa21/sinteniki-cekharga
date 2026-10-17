import "server-only";

import { listWorkableBatches, processBatchStep } from "@/lib/import/jobs";
import { processPhotoStep } from "@/lib/import/photo-jobs";
import { processScrapeStep } from "@/lib/scrape/jobs";

/**
 * Satu putaran worker latar: batch impor yang antre atau macet, job tarik
 * otomatis dan sinkron ulasan (scrape_jobs), lalu antrean foto, sampai
 * anggaran waktu habis. Dipakai worker per menit InsForge
 * (/api/admin/import/worker) dan cron worker Vercel (/api/cron/worker).
 * Klaim lease di database mencegah dua pemanggil memegang pekerjaan yang sama.
 */
export async function runWorkerPass(totalBudgetMs: number, batchLimit: number) {
  const started = Date.now();
  const left = () => totalBudgetMs - (Date.now() - started);
  const worked: { id: string; status: string | null; processed: number }[] = [];
  // Batch diulang selama masih ada waktu: satu langkah bisa belum menghabiskan batch besar.
  for (let round = 0; round < 3 && left() > 8_000; round += 1) {
    const ids = await listWorkableBatches(batchLimit);
    if (ids.length === 0) break;
    for (const id of ids) {
      if (left() < 8_000) break;
      const step = await processBatchStep(id, Math.min(left() - 3_000, 40_000));
      if (step.claimed) worked.push({ id, status: step.status, processed: step.processed });
    }
  }
  const scrapeBudget = Math.min(left() - 3_000, 60_000);
  const scrape = scrapeBudget > 5_000 ? await processScrapeStep(scrapeBudget) : { processed: 0 };
  const photoBudget = left() - 3_000;
  const photos = photoBudget > 5_000 ? await processPhotoStep(photoBudget) : { processed: 0, changed: 0 };
  return { worked, scrape, photos };
}
