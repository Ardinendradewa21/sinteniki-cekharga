import { after, type NextRequest } from "next/server";

import { findLiveCreative } from "@/lib/ads/decision";
import { anonSession, dedupeKey, deviceFrom, looksLikeBot, recordAdEvents } from "@/lib/ads/events";

/**
 * Tayangan terlihat (viewable impression). Dikirim oleh AdViewTracker setelah
 * ≥50% iklan terlihat ≥1 detik. Payload: { events: [{ c: creativeId, s: slotCode }] }.
 *
 * Setiap event divalidasi terhadap daftar iklan yang benar-benar tayang, jadi
 * ID karangan atau slot yang tidak cocok diabaikan. Respons selalu 204 supaya
 * klien tidak bisa memetakan isi database lewat endpoint ini.
 */

const MAX_EVENTS = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  const raw = (body as { events?: unknown })?.events;
  const list = Array.isArray(raw) ? raw.slice(0, MAX_EVENTS) : [];
  const requested = list.flatMap((item) => {
    const c = (item as { c?: unknown })?.c;
    const s = (item as { s?: unknown })?.s;
    return typeof c === "string" && UUID.test(c) && typeof s === "string" && s.length <= 40 ? [{ c, s }] : [];
  });
  if (requested.length === 0) return new Response(null, { status: 204 });

  const userAgent = request.headers.get("user-agent");
  const session = anonSession(request.headers);
  const isBot = looksLikeBot(userAgent);
  const device = deviceFrom(userAgent);

  after(async () => {
    const events = [];
    for (const { c, s } of requested) {
      const live = await findLiveCreative(c);
      if (!live || live.slot_code !== s) continue;
      events.push({
        creativeId: c,
        lineItemId: live.line_item_id,
        slotCode: s,
        type: "impression" as const,
        device,
        isBot,
        dedupeKey: dedupeKey({ session, creativeId: c, slotCode: s, type: "impression" }),
      });
    }
    await recordAdEvents(events);
  });

  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
