import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";

/** Event iklan mentah disimpan 90 hari (ADS-CONTEXT §12.3 butir 3). */
const AD_EVENT_RETENTION_DAYS = 90;

/**
 * Meringkas event iklan yang lebih tua dari masa retensi ke ad_stats_daily,
 * lalu menghapus mentahnya. Idempoten (fungsi database `ad_rollup_and_purge`).
 * Dipanggil cron harian (`/api/cron/daily`) dan `/api/ads/maintenance`.
 */
export async function rollupAdEvents(): Promise<number> {
  const { data, error } = await getInsforgeAdminClient().database.rpc("ad_rollup_and_purge", {
    p_retention_days: AD_EVENT_RETENTION_DAYS,
  });
  if (error) throw new Error(`Ringkasan event iklan gagal: ${error.message}`);
  return Number(data ?? 0);
}

/**
 * Line item yang lewat end_at ditandai 'ended' (temuan F3 audit iklan).
 * Penayangannya sudah berhenti karena jendela waktu di `ad_live_creatives`;
 * ini merapikan status di admin. Status IO tetap diubah tim (laporan dan
 * invoice akhir mengikuti langkah "Selesai").
 */
export async function closeExpiredLineItems(): Promise<number> {
  const { data, error } = await getInsforgeAdminClient().database.rpc("ad_close_expired_line_items");
  if (error) throw new Error(`Penutupan line item gagal: ${error.message}`);
  return Number(data ?? 0);
}
