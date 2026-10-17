import { bearerMatches } from "@/lib/backend/bearer";
import { runWorkerPass } from "@/lib/import/worker-pass";

/**
 * Worker terjadwal penerapan batch impor (rencana kerja impor, Fase 1.4).
 *
 * Dipanggil InsForge Schedules setiap menit (`* * * * *`) dengan header
 * `Authorization: Bearer <IMPORT_WORKER_SECRET>`. Cron Vercel Hobby hanya
 * harian, jadi penjadwal per menit memakai InsForge (pg_cron). Tanpa secret
 * yang cocok: 401. Cadangan tanpa InsForge: cron worker Vercel
 * (/api/cron/worker) dua kali sehari.
 *
 * Satu panggilan mengerjakan batch antre atau macet, job latar (scrape_jobs),
 * lalu antrean foto, sampai anggaran waktunya habis. Perawatan harian
 * (draft kedaluwarsa, retensi, pemeriksaan harga) ada di `/api/cron/daily`.
 */

export const maxDuration = 60;

const TOTAL_BUDGET_MS = 45_000;

export async function POST(request: Request) {
  if (!bearerMatches(request.headers.get("authorization"), process.env.IMPORT_WORKER_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await runWorkerPass(TOTAL_BUDGET_MS, 5));
}
