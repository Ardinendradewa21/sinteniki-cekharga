import "server-only";

import { createHmac } from "node:crypto";
import { unstable_cache } from "next/cache";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectAll } from "@/lib/backend/paged-read";

/**
 * Pencatatan event iklan (docs/ads/ADS-CONTEXT.md §8 butir 3-5, §11 butir 4).
 *
 * - Tidak menyimpan IP mentah, email, atau identitas pengunjung. Yang
 *   disimpan hanya creative, line item, slot, jenis event, perangkat, tanda
 *   bot, dan dedupe_key (HMAC, tidak bisa dibalik).
 * - dedupe_key = HMAC(sesi anonim + creative + slot + jenis + menit). Event
 *   ganda dalam menit yang sama diabaikan oleh indeks unik di database.
 * - Event bot/tidak wajar DITANDAI is_bot = true, tidak dihapus, supaya bisa
 *   diaudit. Laporan dan tagihan hanya menghitung is_bot = false.
 */

const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|axios|node-fetch|go-http|java\//i;

export function looksLikeBot(userAgent: string | null): boolean {
  return !userAgent || userAgent.length < 20 || BOT_PATTERN.test(userAgent);
}

export function deviceFrom(userAgent: string | null): "desktop" | "mobile" {
  return userAgent && /mobi|android|iphone|ipad/i.test(userAgent) ? "mobile" : "desktop";
}

function hashSecret(): string {
  // Rahasia server; tanpa ini dedupe_key bisa ditebak dari luar.
  const secret = process.env.ADS_EVENT_SECRET || process.env.INSFORGE_API_KEY;
  if (!secret) throw new Error("ADS_EVENT_SECRET belum diset.");
  return secret;
}

/**
 * Penanda sesi anonim tanpa cookie: alamat IP + user agent. Nilai ini hanya
 * menjadi masukan HMAC di `dedupeKey` dan tidak pernah disimpan.
 */
export function anonSession(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "";
  return `${ip}|${headers.get("user-agent") ?? ""}`;
}

export function dedupeKey(parts: { session: string; creativeId: string; slotCode: string; type: string }): string {
  const minute = Math.floor(Date.now() / 60_000);
  return createHmac("sha256", hashSecret())
    .update(`${parts.session}|${parts.creativeId}|${parts.slotCode}|${parts.type}|${minute}`)
    .digest("hex")
    .slice(0, 40);
}

const loadSlotIds = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const rows = await selectAll("ad_slots", "id, code");
    return Object.fromEntries(rows.map((row) => [String(row.code), String(row.id)]));
  },
  ["ads-slot-ids", "v1"],
  { tags: ["ads"], revalidate: 300 }
);

export async function recordAdEvents(
  events: {
    creativeId: string;
    lineItemId: string;
    slotCode: string;
    type: "impression" | "click";
    device: "desktop" | "mobile";
    isBot: boolean;
    dedupeKey: string;
  }[]
): Promise<void> {
  if (events.length === 0) return;
  const slotIds = await loadSlotIds();
  const rows = events.flatMap((event) => {
    const slotId = slotIds[event.slotCode];
    return slotId
      ? [
          {
            creative_id: event.creativeId,
            line_item_id: event.lineItemId,
            slot_id: slotId,
            event_type: event.type,
            device: event.device,
            is_bot: event.isBot,
            dedupe_key: event.dedupeKey,
          },
        ]
      : [];
  });
  if (rows.length === 0) return;
  const { error } = await getInsforgeAdminClient()
    .database.from("ad_events")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) console.error("[iklan] event gagal dicatat:", error);
}
