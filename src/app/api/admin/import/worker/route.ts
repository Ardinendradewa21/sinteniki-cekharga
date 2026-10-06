import { bearerMatches } from "@/lib/backend/bearer";
import { listWorkableBatches, processBatchStep } from "@/lib/import/jobs";
import { processPhotoStep } from "@/lib/import/photo-jobs";

/**
 * Worker terjadwal penerapan batch impor (rencana kerja impor, Fase 1.4).
 *
 * Dipanggil InsForge Schedules setiap menit (`* * * * *`) dengan header
 * `Authorization: Bearer <IMPORT_WORKER_SECRET>`, setelah aplikasi punya URL
 * publik. Cron Vercel Hobby hanya harian, jadi penjadwal per menit memakai
 * InsForge (pg_cron). Tanpa secret yang cocok: 401.
 *
 * Satu panggilan mengerjakan batch antre atau macet, lalu antrean foto, sampai
 * anggaran waktunya habis. Sisa pekerjaan dilanjutkan panggilan berikutnya;
 * klaim lease mencegah dua worker memegang batch yang sama. Perawatan harian
 * (draft kedaluwarsa, retensi, pemeriksaan harga) ada di `/api/cron/daily`.
 */

export const maxDuration = 60;

const TOTAL_BUDGET_MS = 45_000;

export async function POST(request: Request) {
  if (!bearerMatches(request.headers.get("authorization"), process.env.IMPORT_WORKER_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const worked: { id: string; status: string | null; processed: number }[] = [];
  for (const id of await listWorkableBatches(5)) {
    const left = TOTAL_BUDGET_MS - (Date.now() - started);
    if (left < 5_000) break;
    const step = await processBatchStep(id, Math.min(left - 2_000, 40_000));
    if (step.claimed) worked.push({ id, status: step.status, processed: step.processed });
  }
  // Sisa anggaran untuk antrean foto (diproses terpisah dari penerapan).
  const photoBudget = TOTAL_BUDGET_MS - (Date.now() - started);
  const photos = photoBudget > 5_000 ? await processPhotoStep(photoBudget - 2_000) : { processed: 0, changed: 0 };
  return Response.json({ worked, photos });
}
