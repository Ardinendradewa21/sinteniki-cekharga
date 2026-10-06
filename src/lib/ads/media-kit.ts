import "server-only";

import { unstable_cache } from "next/cache";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { getDataSourceMode } from "@/lib/config";
import type { PricingModel } from "@/lib/ads/billing";

/**
 * Data media kit publik (/iklan): slot aktif dan rate card yang sudah diisi.
 * Tarif memang untuk dipublikasikan; data bisnis lain (kontrak, IO,
 * advertiser) tidak pernah dibaca di sini.
 */

export type MediaKitSlot = {
  code: string;
  label: string;
  page: string;
  desktopSize: string | null;
  mobileSize: string | null;
  allowsNative: boolean;
  rates: { model: PricingModel; rate: number; minOrder: string | null }[];
};

const load = unstable_cache(
  async (): Promise<MediaKitSlot[]> => {
    const db = getInsforgeAdminClient().database;
    const [slots, rates] = await Promise.all([
      db
        .from("ad_slots")
        .select("id, code, label, page, desktop_size, mobile_size, allows_native")
        .eq("is_active", true)
        .eq("kind", "banner")
        .order("sort_order"),
      db.from("ad_rate_card").select("slot_id, pricing_model, rate, min_order").gt("rate", 0),
    ]);
    if (slots.error || rates.error) throw new Error("Media kit gagal dibaca.");
    const rateRows = (rates.data ?? []) as { slot_id: string; pricing_model: PricingModel; rate: number; min_order: string | null }[];
    return ((slots.data ?? []) as Record<string, unknown>[]).map((slot) => ({
      code: String(slot.code),
      label: String(slot.label),
      page: String(slot.page),
      desktopSize: (slot.desktop_size as string | null) ?? null,
      mobileSize: (slot.mobile_size as string | null) ?? null,
      allowsNative: Boolean(slot.allows_native),
      rates: rateRows
        .filter((row) => row.slot_id === slot.id)
        .map((row) => ({ model: row.pricing_model, rate: Number(row.rate), minOrder: row.min_order })),
    }));
  },
  ["ads-media-kit", "v1"],
  { tags: ["ads"], revalidate: 600 }
);

export async function getMediaKit(): Promise<MediaKitSlot[] | null> {
  if (getDataSourceMode() !== "live") return null;
  try {
    return await load();
  } catch (error) {
    console.error("[iklan] media kit gagal dibaca:", error);
    return null;
  }
}
