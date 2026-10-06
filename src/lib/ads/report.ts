import "server-only";

import {
  listAdvertisers,
  listContracts,
  listIos,
  listLineItems,
  listSlots,
  readDailyReport,
  type DailyRow,
} from "@/lib/ads/admin-queries";
import { isDay, jakartaDay, shiftDay } from "@/lib/ads/dates";

/**
 * Data laporan iklan untuk halaman Laporan dan ekspor CSV. Satu sumber
 * supaya angka di layar dan di berkas yang dikirim ke advertiser selalu sama.
 */

export type ReportFilter = { from: string; to: string; ioId: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseReportFilter(params: Record<string, string | string[] | undefined>): ReportFilter {
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : null);
  const today = jakartaDay();
  let from = isDay(pick("dari")) ? (pick("dari") as string) : shiftDay(today, -29);
  let to = isDay(pick("sampai")) ? (pick("sampai") as string) : today;
  if (from > to) [from, to] = [to, from];
  // Rentang dibatasi 366 hari supaya laporan tetap ringan.
  if (shiftDay(from, 366) < to) from = shiftDay(to, -366);
  const io = pick("io");
  return { from, to, ioId: io && UUID.test(io) ? io : null };
}

export type ReportRow = DailyRow & {
  advertiser: string;
  ioNumber: string;
  campaign: string;
  lineItem: string;
  slotCode: string;
};

export async function loadReport(filter: ReportFilter) {
  const [items, ios, contracts, advertisers, slots] = await Promise.all([
    listLineItems(filter.ioId ? { ioId: filter.ioId } : {}),
    listIos(),
    listContracts(),
    listAdvertisers(),
    listSlots(),
  ]);
  const rows = filter.ioId
    ? await readDailyReport({ from: filter.from, to: filter.to, lineItemIds: items.map((item) => item.id) })
    : await readDailyReport({ from: filter.from, to: filter.to });

  const itemById = new Map(items.map((row) => [row.id, row]));
  const ioById = new Map(ios.map((row) => [row.id, row]));
  const contractById = new Map(contracts.map((row) => [row.id, row]));
  const advertiserById = new Map(advertisers.map((row) => [row.id, row]));
  const slotById = new Map(slots.map((row) => [row.id, row]));

  const enriched: ReportRow[] = rows.map((row) => {
    const item = itemById.get(row.line_item_id);
    const io = item ? ioById.get(item.io_id) : undefined;
    const contract = io ? contractById.get(io.contract_id) : undefined;
    const advertiser = contract ? advertiserById.get(contract.advertiser_id) : undefined;
    return {
      ...row,
      advertiser: advertiser?.company_name ?? "–",
      ioNumber: io?.io_number ?? "–",
      campaign: io?.campaign_name ?? "–",
      lineItem: item?.name || slotById.get(row.slot_id)?.label || "–",
      slotCode: slotById.get(row.slot_id)?.code ?? "–",
    };
  });

  return { rows: enriched, items, ios, io: filter.ioId ? (ioById.get(filter.ioId) ?? null) : null };
}

/** Sel CSV aman: dikutip, dan diawali ' bila bisa dibaca sebagai formula spreadsheet. */
function cell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: ReportRow[]): string {
  const header = [
    "tanggal_wib",
    "advertiser",
    "nomor_io",
    "kampanye",
    "line_item",
    "slot",
    "creative_id",
    "tayangan",
    "klik",
    "ctr_persen",
    "tayangan_bot",
    "klik_bot",
  ];
  const lines = rows.map((row) =>
    [
      row.day,
      row.advertiser,
      row.ioNumber,
      row.campaign,
      row.lineItem,
      row.slotCode,
      row.creative_id,
      row.impressions,
      row.clicks,
      row.impressions ? ((row.clicks / row.impressions) * 100).toFixed(2) : "",
      row.bot_impressions,
      row.bot_clicks,
    ]
      .map(cell)
      .join(",")
  );
  // BOM supaya Excel membaca UTF-8 dengan benar.
  return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
