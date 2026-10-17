import { bearerMatches } from "@/lib/backend/bearer";
import { runWorkerPass } from "@/lib/import/worker-pass";

/**
 * Cron worker Vercel (Sprint 8, 17 Oktober 2026), dua kali sehari setelah
 * pemeriksaan harga harian: 01.00 dan 03.00 UTC (08.xx dan 10.xx WIB; Hobby
 * menjalankan cron kapan saja dalam jam itu).
 *
 * Alasannya: cron harian membuat satu batch harga per merek, tetapi
 * anggarannya habis untuk membaca situs resmi, sehingga sebagian batch
 * tertahan "queued" sampai ada worker. Worker per menit InsForge belum tentu
 * terpasang; cron ini menjamin batch harga hari itu tetap diterapkan.
 * Header `Authorization: Bearer <CRON_SECRET>` dikirim Vercel otomatis.
 */

export const maxDuration = 300;

const TOTAL_BUDGET_MS = 270_000;

export async function GET(request: Request) {
  if (!bearerMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await runWorkerPass(TOTAL_BUDGET_MS, 10));
}
