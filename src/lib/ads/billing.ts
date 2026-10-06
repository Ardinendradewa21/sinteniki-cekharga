/**
 * Perhitungan tagihan iklan dari statistik yang tercatat.
 *
 * Model harga (umum dipakai media digital di Indonesia):
 * - CPM  (cost per mille): tarif per 1.000 tayangan terlihat.
 * - CPC  (cost per click): tarif per klik.
 * - Flat (sewa slot/sponsorship): satu harga untuk periode yang disepakati.
 *
 * Yang ditagih tidak pernah melebihi kuota yang dipesan di IO (booked
 * quantity). Kelebihan tayangan adalah bonus, bukan tagihan tambahan.
 *
 * Modul murni: dipakai halaman admin dan laporan CSV.
 */

export type PricingModel = "cpm" | "cpc" | "flat";

export const PRICING_LABEL: Record<PricingModel, string> = {
  cpm: "CPM (per 1.000 tayangan)",
  cpc: "CPC (per klik)",
  flat: "Flat (sewa slot)",
};

export type DeliveryTotals = { impressions: number; clicks: number };

export type Billing = {
  /** Jumlah unit yang ditagihkan (tayangan untuk CPM, klik untuk CPC). */
  billableUnits: number | null;
  amountIdr: number;
  /** Progres pengiriman terhadap kuota (0-1+), null bila tanpa kuota. */
  delivery: number | null;
  ctr: number | null;
};

export function computeBilling(
  deal: { pricingModel: PricingModel; rateIdr: number; bookedQuantity: number | null },
  totals: DeliveryTotals
): Billing {
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : null;
  const cap = (value: number) =>
    deal.bookedQuantity ? Math.min(value, deal.bookedQuantity) : value;

  if (deal.pricingModel === "cpm") {
    const billable = cap(totals.impressions);
    return {
      billableUnits: billable,
      amountIdr: Math.round((billable / 1000) * deal.rateIdr),
      delivery: deal.bookedQuantity ? totals.impressions / deal.bookedQuantity : null,
      ctr,
    };
  }
  if (deal.pricingModel === "cpc") {
    const billable = cap(totals.clicks);
    return {
      billableUnits: billable,
      amountIdr: billable * deal.rateIdr,
      delivery: deal.bookedQuantity ? totals.clicks / deal.bookedQuantity : null,
      ctr,
    };
  }
  return { billableUnits: null, amountIdr: deal.rateIdr, delivery: null, ctr };
}

export function formatPercent(value: number | null, digits = 2): string {
  return value === null ? "–" : `${(value * 100).toLocaleString("id-ID", { maximumFractionDigits: digits })}%`;
}
