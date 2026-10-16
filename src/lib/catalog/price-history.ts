import "server-only";

import { unstable_cache } from "next/cache";

import { getInsforgePublicClient } from "@/lib/backend/insforge";
import { buildPriceHistory, HISTORY_WINDOW_DAYS, type PriceHistory } from "@/lib/catalog/price-history-rules";

/**
 * Riwayat harga satu varian (PB-36), dibaca terpisah dari dataset katalog
 * supaya cache katalog global tidak membengkak (PB-32). Dibaca memakai anon
 * key: RLS hanya meloloskan riwayat milik produk terbit.
 *
 * Cache per varian ikut tag `catalog`, jadi setiap harga baru yang tersimpan
 * (yang selalu memanggil invalidasi katalog) ikut menyegarkannya (aturan
 * system design 2).
 */

type Raw = {
  offers: { id: string; label: string }[];
  observations: { offerId: string; priceIdr: number; observedAt: string }[];
  checks: { offerId: string; attemptedAt: string; outcome: string }[];
};

async function fetchRaw(variantId: string): Promise<Raw> {
  const db = getInsforgePublicClient().database;
  const offerRows = await db
    .from("offers")
    .select("id, marketplace, seller_name")
    .eq("variant_id", variantId)
    .is("deleted_at", null)
    .limit(50);
  if (offerRows.error) throw new Error("Riwayat harga gagal dibaca.");
  const offers = ((offerRows.data ?? []) as { id: string; marketplace: string; seller_name: string }[]).map((row) => ({
    id: row.id,
    label:
      row.seller_name && row.seller_name.trim().toLowerCase() !== row.marketplace.trim().toLowerCase()
        ? `${row.marketplace} · ${row.seller_name}`
        : row.marketplace,
  }));
  if (offers.length === 0) return { offers, observations: [], checks: [] };

  const ids = offers.map((offer) => offer.id);
  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86_400_000).toISOString();
  // Satu query per tabel untuk semua penawaran varian (tanpa N+1).
  const [observationRows, checkRows] = await Promise.all([
    db
      .from("price_observations")
      .select("offer_id, price_idr, observed_at")
      .in("offer_id", ids)
      .is("voided_at", null)
      .gte("observed_at", since)
      .order("observed_at", { ascending: true })
      .limit(2000),
    db
      .from("price_checks")
      .select("offer_id, attempted_at, outcome")
      .in("offer_id", ids)
      .is("voided_at", null)
      .eq("outcome", "success")
      .gte("attempted_at", since)
      .order("attempted_at", { ascending: true })
      .limit(2000),
  ]);
  if (observationRows.error || checkRows.error) throw new Error("Riwayat harga gagal dibaca.");

  // Observasi sebelum jendela dibutuhkan untuk harga pemeriksaan pertama di dalam jendela.
  const earlier = await db
    .from("price_observations")
    .select("offer_id, price_idr, observed_at")
    .in("offer_id", ids)
    .is("voided_at", null)
    .lt("observed_at", since)
    .order("observed_at", { ascending: false })
    .limit(ids.length * 2);

  const toObservation = (row: { offer_id: string; price_idr: number; observed_at: string }) => ({
    offerId: row.offer_id,
    priceIdr: Number(row.price_idr),
    observedAt: new Date(row.observed_at).toISOString(),
  });
  return {
    offers,
    observations: [
      ...((earlier.data ?? []) as { offer_id: string; price_idr: number; observed_at: string }[]).map(toObservation),
      ...((observationRows.data ?? []) as { offer_id: string; price_idr: number; observed_at: string }[]).map(toObservation),
    ],
    checks: ((checkRows.data ?? []) as { offer_id: string; attempted_at: string; outcome: string }[]).map((row) => ({
      offerId: row.offer_id,
      attemptedAt: new Date(row.attempted_at).toISOString(),
      outcome: row.outcome,
    })),
  };
}

const loadRaw = unstable_cache(fetchRaw, ["price-history", "v1"], { tags: ["catalog"], revalidate: 3600 });

export async function loadPriceHistory(variantId: string, now: Date): Promise<PriceHistory> {
  return buildPriceHistory({ ...(await loadRaw(variantId)), now });
}
