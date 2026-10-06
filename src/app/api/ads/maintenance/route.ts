import { timingSafeEqual } from "node:crypto";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";

/**
 * Tugas harian iklan (docs/ads/ADS-CONTEXT.md §12.3): ringkas event mentah
 * yang lebih tua dari masa retensi ke ad_stats_daily, lalu hapus mentahnya.
 *
 * Dipanggil penjadwal (`insforge schedules`, cron `0 1 * * *`) dengan header
 * `Authorization: Bearer <ADS_CRON_SECRET>`. Tanpa secret yang cocok: 401.
 * Laporan tetap utuh walau tugas ini tidak berjalan, karena view
 * ad_daily_report membaca event mentah dan ringkasan sekaligus.
 */

function authorized(header: string | null): boolean {
  const secret = process.env.ADS_CRON_SECRET;
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await getInsforgeAdminClient().database.rpc("ad_rollup_and_purge", {
    p_retention_days: 90,
  });
  if (error) {
    console.error("[iklan] rollup gagal:", error);
    return Response.json({ error: "rollup gagal" }, { status: 500 });
  }
  return Response.json({ purged: data ?? 0 });
}
