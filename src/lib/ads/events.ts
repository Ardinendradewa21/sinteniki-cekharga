import "server-only";

import { createHmac } from "node:crypto";
import { unstable_cache } from "next/cache";

import { jakartaDay } from "@/lib/ads/dates";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectAll } from "@/lib/backend/paged-read";

/**
 * Pencatatan event iklan (docs/ads/ADS-CONTEXT.md §8 butir 3-5, §11 butir 4).
 *
 * - Tidak menyimpan IP mentah, email, atau identitas pengunjung. Yang
 *   disimpan hanya creative, line item, slot, jenis event, perangkat, tanda
 *   bot, dedupe_key, serta tag sesi/jaringan harian (semuanya HMAC, tidak bisa
 *   dibalik).
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
  return `${clientIp(headers)}|${headers.get("user-agent") ?? ""}`;
}

function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "";
}

/**
 * Batas harian per creative (temuan F5 audit iklan, ADS-CONTEXT §8 butir 5).
 * Event di atas batas tetap disimpan tetapi ditandai is_bot, jadi tidak
 * masuk laporan dan tagihan. Batas jaringan (IP saja) lebih longgar karena
 * operator seluler Indonesia membagi satu IP ke banyak pelanggan (CGNAT);
 * gunanya menangkap skrip yang berganti-ganti user agent.
 */
export const AD_EVENT_CAPS = {
  sessionImpressions: 40,
  sessionClicks: 5,
  networkImpressions: 300,
  networkClicks: 30,
} as const;

/**
 * Tag sesi (IP + user agent) dan jaringan (IP) untuk batas harian. HMAC
 * dengan tanggal WIB: berganti setiap hari, tidak bisa dibalik menjadi IP,
 * dan tidak bisa menghubungkan kunjungan antarhari.
 */
export function sourceTags(headers: Headers): { sessionTag: string | null; networkTag: string | null } {
  const ip = clientIp(headers);
  const secret = process.env.ADS_EVENT_SECRET || process.env.INSFORGE_API_KEY;
  // Tanpa IP atau rahasia: event tetap dicatat, hanya tanpa batas harian.
  if (!ip || !secret) return { sessionTag: null, networkTag: null };
  const day = jakartaDay();
  const tag = (value: string) => createHmac("sha256", secret).update(`tag|${value}|${day}`).digest("hex").slice(0, 24);
  return { sessionTag: tag(`s|${anonSession(headers)}`), networkTag: tag(`n|${ip}`) };
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
    sessionTag: string | null;
    networkTag: string | null;
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
            session_tag: event.sessionTag,
            network_tag: event.networkTag,
          },
        ]
      : [];
  });
  if (rows.length === 0) return;
  const client = getInsforgeAdminClient();
  // Batas harian dicek dan event disimpan dalam satu panggilan database
  // (migrasi 20261121090000), supaya hitungannya sama di semua instance.
  const { error } = await client.database.rpc("ad_record_events", {
    p_events: rows,
    p_session_impr_cap: AD_EVENT_CAPS.sessionImpressions,
    p_session_click_cap: AD_EVENT_CAPS.sessionClicks,
    p_network_impr_cap: AD_EVENT_CAPS.networkImpressions,
    p_network_click_cap: AD_EVENT_CAPS.networkClicks,
  });
  if (!error) return;
  // Cadangan (aturan system design 7): simpan tanpa cek batas daripada
  // kehilangan event. Dedupe per menit tetap berlaku lewat indeks unik.
  console.error("[iklan] ad_record_events gagal, memakai simpan langsung:", error);
  const fallback = await client.database
    .from("ad_events")
    .upsert(
      // Tanpa kolom tag: bila RPC gagal karena migrasi belum ada, kolomnya juga belum ada.
      rows.map((row) => ({
        creative_id: row.creative_id,
        line_item_id: row.line_item_id,
        slot_id: row.slot_id,
        event_type: row.event_type,
        device: row.device,
        is_bot: row.is_bot,
        dedupe_key: row.dedupe_key,
      })),
      { onConflict: "dedupe_key", ignoreDuplicates: true }
    );
  if (fallback.error) console.error("[iklan] event gagal dicatat:", fallback.error);
}
