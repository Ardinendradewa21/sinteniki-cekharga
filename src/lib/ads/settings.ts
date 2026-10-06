import "server-only";

import { unstable_cache } from "next/cache";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { getDataSourceMode } from "@/lib/config";

/**
 * Pengaturan iklan dari tabel ad_settings (hanya terbaca lewat kunci admin).
 * Nilai kosong berarti fitur terkait mati: tanpa `adsense_client`, AdSense
 * dan banner persetujuan tidak dimuat sama sekali.
 */

export type AdSettings = {
  adsenseClient: string | null;
  salesEmail: string | null;
  salesWhatsapp: string | null;
  ppnRatePercent: number | null;
};

const EMPTY: AdSettings = { adsenseClient: null, salesEmail: null, salesWhatsapp: null, ppnRatePercent: null };

const load = unstable_cache(
  async (): Promise<AdSettings> => {
    const { data, error } = await getInsforgeAdminClient().database.from("ad_settings").select("key, value");
    if (error) throw new Error("Pengaturan iklan gagal dibaca.");
    const map = new Map(((data ?? []) as { key: string; value: string | null }[]).map((row) => [row.key, row.value]));
    const clean = (key: string) => map.get(key)?.trim() || null;
    const ppn = Number(clean("ppn_rate_percent"));
    return {
      adsenseClient: /^ca-pub-\d{10,20}$/.test(clean("adsense_client") ?? "") ? clean("adsense_client") : null,
      salesEmail: clean("sales_email"),
      salesWhatsapp: clean("sales_whatsapp"),
      ppnRatePercent: Number.isFinite(ppn) && ppn > 0 ? ppn : null,
    };
  },
  ["ads-settings", "v1"],
  { tags: ["ads"], revalidate: 300 }
);

export async function getAdSettings(): Promise<AdSettings> {
  if (getDataSourceMode() !== "live") return EMPTY;
  try {
    return await load();
  } catch (error) {
    console.error("[iklan] pengaturan gagal dibaca:", error);
    return EMPTY;
  }
}

/** ID unit AdSense per slot, dari env `ADSENSE_SLOT_<KODE_SLOT>` (mis. ADSENSE_SLOT_HOME_TOP). */
export function adsenseSlotId(slotCode: string): string | null {
  const value = process.env[`ADSENSE_SLOT_${slotCode.toUpperCase()}`]?.trim();
  return value && /^\d{6,20}$/.test(value) ? value : null;
}
