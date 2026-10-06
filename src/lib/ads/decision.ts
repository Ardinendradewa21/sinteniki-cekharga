import "server-only";

import { unstable_cache } from "next/cache";

import { getInsforgePublicClient } from "@/lib/backend/insforge";
import { getDataSourceMode } from "@/lib/config";

/**
 * Keputusan iklan (docs/ads/ADS-CONTEXT.md §8 butir 2).
 *
 * Aturan pemilihan untuk satu slot:
 * 1. Hanya creative yang lolos review, line item `active` dalam rentang
 *    waktu, IO `ready`/`live`, dan slot aktif. Semua syarat ini ditegakkan di
 *    fungsi database `ad_live_creatives()`, satu-satunya pintu baca publik.
 * 2. Target belum tercapai (`remaining` > 0 atau line item flat).
 * 3. Targeting kontekstual: line item yang menargetkan merek halaman ini
 *    didahulukan; line item bertarget merek lain tidak tayang di halaman lain.
 * 4. Prioritas tertinggi (angka terkecil), lalu rotasi berbobot.
 *
 * Hasil database di-cache 60 detik. Iklan tidak pernah memengaruhi data
 * katalog: modul ini tidak membaca atau menulis tabel produk/harga.
 */

export type SlotCode = string;

export type LiveSlot = {
  code: SlotCode;
  desktopSize: string | null;
  mobileSize: string | null;
  fallback: "adsense" | "gam" | "house" | "none";
  allowsNative: boolean;
};

export type ServedCreative = {
  /** campaign = iklan sungguhan (dilacak); preview = contoh/pratinjau (tidak dilacak). */
  kind: "campaign" | "preview";
  creativeId: string;
  lineItemId: string;
  slotCode: SlotCode;
  format: "display" | "native";
  imageUrl: string | null;
  imageUrlMobile: string | null;
  altText: string;
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  logoUrl: string | null;
  advertiserLabel: string;
  /** Tautan klik: endpoint redirect untuk iklan, tujuan langsung untuk pratinjau. */
  href: string;
};

export type LiveCreativeRow = LiveRow;

type LiveRow = {
  creative_id: string;
  line_item_id: string;
  slot_code: string;
  format: "display" | "native";
  image_url: string | null;
  image_url_mobile: string | null;
  alt_text: string;
  destination_url: string;
  headline: string | null;
  body: string | null;
  cta_label: string | null;
  logo_url: string | null;
  advertiser_label: string;
  priority: number;
  weight: number;
  target_brands: string[] | null;
  remaining: number | null;
};

export const ADS_CACHE_TAG = "ads";

const loadLive = unstable_cache(
  async (): Promise<LiveRow[]> => {
    const { data, error } = await getInsforgePublicClient().database.rpc("ad_live_creatives");
    if (error) throw new Error("Iklan tayang gagal dibaca.");
    return (data ?? []) as LiveRow[];
  },
  ["ads-live", "v1"],
  { tags: [ADS_CACHE_TAG], revalidate: 60 }
);

const loadSlots = unstable_cache(
  async (): Promise<LiveSlot[]> => {
    const { data, error } = await getInsforgePublicClient().database.rpc("ad_active_slots");
    if (error) throw new Error("Slot iklan gagal dibaca.");
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      code: String(row.code),
      desktopSize: (row.desktop_size as string | null) ?? null,
      mobileSize: (row.mobile_size as string | null) ?? null,
      fallback: (row.fallback as LiveSlot["fallback"]) ?? "none",
      allowsNative: Boolean(row.allows_native),
    }));
  },
  ["ads-slots", "v1"],
  { tags: [ADS_CACHE_TAG], revalidate: 60 }
);

function isLive(): boolean {
  return getDataSourceMode() === "live";
}

/**
 * Mode pratinjau (CEKHARGA_AD_PREVIEW=1): setiap slot diisi contoh iklan
 * bermerek fiktif dari public/ads supaya tata letak bisa dinilai sebelum ada
 * kampanye. Contoh berlabel "Contoh iklan", menautkan ke media kit, dan tidak
 * pernah dilacak atau ditagihkan. Jangan aktifkan di produksi.
 */
export function isAdPreview(): boolean {
  return process.env.CEKHARGA_AD_PREVIEW === "1";
}

const PREVIEW_SLOTS: Record<string, LiveSlot> = {
  home_top: { code: "home_top", desktopSize: "728x90", mobileSize: "320x100", fallback: "none", allowsNative: false },
  home_mid: { code: "home_mid", desktopSize: "970x250", mobileSize: "300x250", fallback: "none", allowsNative: false },
  catalog_top: { code: "catalog_top", desktopSize: "970x90", mobileSize: "320x100", fallback: "none", allowsNative: false },
  catalog_infeed: { code: "catalog_infeed", desktopSize: "1200x150", mobileSize: "320x100", fallback: "none", allowsNative: true },
  product_sidebar: { code: "product_sidebar", desktopSize: "300x250", mobileSize: null, fallback: "none", allowsNative: false },
  product_inline: { code: "product_inline", desktopSize: "728x90", mobileSize: "320x50", fallback: "none", allowsNative: false },
  compare_bottom: { code: "compare_bottom", desktopSize: "728x90", mobileSize: "320x50", fallback: "none", allowsNative: false },
  rail_left: { code: "rail_left", desktopSize: "160x600", mobileSize: null, fallback: "none", allowsNative: false },
  rail_right: { code: "rail_right", desktopSize: "160x600", mobileSize: null, fallback: "none", allowsNative: false },
};

function previewCreative(slotCode: SlotCode): ServedCreative | null {
  if (!PREVIEW_SLOTS[slotCode] || slotCode === "product_sidebar") return null;
  const base = {
    kind: "preview" as const,
    creativeId: `preview-${slotCode}`,
    lineItemId: `preview-${slotCode}`,
    slotCode,
    headline: null,
    body: null,
    ctaLabel: null,
    logoUrl: null,
    imageUrlMobile: null,
    href: "/iklan",
  };
  if (slotCode === "catalog_infeed") {
    return {
      ...base,
      format: "native",
      imageUrl: "/ads/contoh-native.svg",
      altText: "Contoh iklan native",
      headline: "Ruang iklan native di sela hasil katalog",
      body: "Contoh tata letak untuk mitra brand. Materi asli diisi setelah kampanye disetujui.",
      ctaLabel: "Lihat media kit",
      logoUrl: "/ads/contoh-logo.svg",
      advertiserLabel: "Contoh Brand B",
    };
  }
  if (slotCode === "rail_left" || slotCode === "rail_right") {
    const side = slotCode === "rail_left" ? "a" : "b";
    return {
      ...base,
      format: "display",
      imageUrl: `/ads/contoh-rail-${side}.svg`,
      altText: "Contoh iklan skyscraper",
      advertiserLabel: side === "a" ? "Contoh Brand A" : "Contoh Brand B",
    };
  }
  return {
    ...base,
    format: "display",
    imageUrl: "/ads/contoh-leaderboard.svg",
    imageUrlMobile: "/ads/contoh-leaderboard-mobile.svg",
    altText: "Contoh iklan banner",
    advertiserLabel: "Contoh Brand A",
  };
}

/** Slot aktif berdasarkan kode; null bila slot nonaktif atau tidak ada. */
export async function getSlot(code: SlotCode): Promise<LiveSlot | null> {
  if (isAdPreview()) return PREVIEW_SLOTS[code] ?? null;
  if (!isLive()) return null;
  try {
    return (await loadSlots()).find((slot) => slot.code === code) ?? null;
  } catch (error) {
    console.error("[iklan] slot gagal dibaca:", error);
    return null;
  }
}

/** Creative tayang berdasarkan ID (dipakai endpoint klik dan tayangan). */
export async function findLiveCreative(creativeId: string): Promise<LiveCreativeRow | null> {
  if (!isLive()) return null;
  return (await loadLive()).find((row) => row.creative_id === creativeId) ?? null;
}

function pickWeighted(rows: LiveRow[]): LiveRow | undefined {
  const total = rows.reduce((sum, row) => sum + Math.max(1, row.weight), 0);
  let roll = Math.random() * total;
  for (const row of rows) {
    roll -= Math.max(1, row.weight);
    if (roll < 0) return row;
  }
  return rows[0];
}

function toServed(row: LiveRow): ServedCreative {
  return {
    kind: "campaign",
    creativeId: row.creative_id,
    lineItemId: row.line_item_id,
    slotCode: row.slot_code,
    format: row.format,
    imageUrl: row.image_url,
    imageUrlMobile: row.image_url_mobile,
    altText: row.alt_text,
    headline: row.headline,
    body: row.body,
    ctaLabel: row.cta_label,
    logoUrl: row.logo_url,
    advertiserLabel: row.advertiser_label,
    href: `/api/ads/click/${row.creative_id}?slot=${encodeURIComponent(row.slot_code)}`,
  };
}

/**
 * Pilih creative untuk slot. `exclude` berisi line item yang sudah tampil di
 * halaman yang sama, supaya satu kampanye tidak muncul dua kali.
 */
export async function decide(
  slotCode: SlotCode,
  { brand, exclude = [] }: { brand?: string | null; exclude?: string[] } = {}
): Promise<ServedCreative | null> {
  if (isAdPreview()) return previewCreative(slotCode);
  if (!isLive()) return null;
  let rows: LiveRow[];
  try {
    rows = await loadLive();
  } catch (error) {
    console.error("[iklan] keputusan iklan dilewati:", error);
    return null;
  }

  const wanted = brand?.trim().toLowerCase() ?? null;
  const eligible = rows.filter(
    (row) =>
      row.slot_code === slotCode &&
      !exclude.includes(row.line_item_id) &&
      (row.remaining === null || row.remaining > 0) &&
      (row.format === "native" ? Boolean(row.headline) : Boolean(row.image_url))
  );
  const targeted = wanted
    ? eligible.filter((row) => (row.target_brands ?? []).some((b) => b.toLowerCase() === wanted))
    : [];
  const pool = targeted.length > 0 ? targeted : eligible.filter((row) => (row.target_brands ?? []).length === 0);
  if (pool.length === 0) return null;

  const best = Math.min(...pool.map((row) => row.priority));
  const chosen = pickWeighted(pool.filter((row) => row.priority === best));
  return chosen ? toServed(chosen) : null;
}
