import { after, NextResponse, type NextRequest } from "next/server";

import { findLiveCreative } from "@/lib/ads/decision";
import { anonSession, dedupeKey, deviceFrom, looksLikeBot, recordAdEvents } from "@/lib/ads/events";

/**
 * Klik iklan: catat lalu alihkan (302) ke tujuan creative.
 *
 * Tujuan diambil dari database, bukan dari query string, sehingga endpoint ini
 * tidak bisa dipakai sebagai open redirect. Creative yang sudah tidak tayang
 * diarahkan ke beranda tanpa dicatat.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/ads/click/[creativeId]">) {
  const { creativeId } = await ctx.params;
  const slotCode = request.nextUrl.searchParams.get("slot") ?? "";
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

  let live = null;
  try {
    live = await findLiveCreative(creativeId);
  } catch (error) {
    console.error("[iklan] klik: creative gagal dibaca:", error);
  }
  if (!live || !/^https:\/\//i.test(live.destination_url)) {
    return NextResponse.redirect(new URL("/", request.url), { status: 302, headers });
  }

  const userAgent = request.headers.get("user-agent");
  const session = anonSession(request.headers);
  const lineItemId = live.line_item_id;
  const slot = slotCode === live.slot_code ? slotCode : live.slot_code;
  after(() =>
    recordAdEvents([
      {
        creativeId,
        lineItemId,
        slotCode: slot,
        type: "click",
        device: deviceFrom(userAgent),
        isBot: looksLikeBot(userAgent),
        dedupeKey: dedupeKey({ session, creativeId, slotCode: slot, type: "click" }),
      },
    ])
  );

  return NextResponse.redirect(live.destination_url, { status: 302, headers });
}
