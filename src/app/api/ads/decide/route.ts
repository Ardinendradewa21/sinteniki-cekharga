import type { NextRequest } from "next/server";

import { decide, getSlot } from "@/lib/ads/decision";

/**
 * Keputusan iklan untuk pemuatan sisi klien (mis. muat ulang slot tanpa
 * render ulang halaman). Halaman publik biasanya memakai keputusan SSR lewat
 * <AdSlot>; endpoint ini memberi hasil yang sama dalam bentuk JSON.
 */
export async function GET(request: NextRequest) {
  const slotCode = request.nextUrl.searchParams.get("slot") ?? "";
  const brand = request.nextUrl.searchParams.get("brand");
  const headers = { "Cache-Control": "private, no-store" };

  const slot = await getSlot(slotCode);
  if (!slot) return Response.json({ slot: null, creative: null }, { status: 404, headers });
  const creative = await decide(slotCode, { brand });
  return Response.json({ slot, creative }, { headers });
}
