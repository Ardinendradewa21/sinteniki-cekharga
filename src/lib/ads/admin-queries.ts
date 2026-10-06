import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectAll, selectWhereIn } from "@/lib/backend/paged-read";
import { computeBilling, type Billing, type PricingModel } from "@/lib/ads/billing";
import type { IoStatus } from "@/lib/ads/admin-schema";

/**
 * Pembacaan admin modul iklan. Semua lewat kunci admin; halaman pemanggil
 * wajib sudah melewati requireStaff().
 */

function db() {
  return getInsforgeAdminClient().database;
}

function must<T>(result: { data: T | null; error: unknown }, what: string): T {
  if (result.error) {
    console.error(`[iklan-admin] gagal membaca ${what}:`, result.error);
    throw new Error(`Gagal membaca ${what}.`);
  }
  return (result.data ?? ([] as unknown)) as T;
}

/* ------------------------------------------------------------ tipe */

export type Advertiser = {
  id: string;
  company_name: string;
  display_name: string;
  npwp: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  prospect_status: "lead" | "proposal" | "active" | "inactive";
  source: "form" | "manual";
  notes: string | null;
  created_at: string;
};

export type Contract = {
  id: string;
  advertiser_id: string;
  contract_number: string;
  start_date: string;
  end_date: string;
  signed_file_key: string | null;
  status: "draft" | "signed" | "ended" | "terminated";
  notes: string | null;
};

export type InsertionOrder = {
  id: string;
  contract_id: string;
  io_number: string;
  campaign_name: string;
  status: IoStatus;
  total_amount: number;
  tax_included: boolean;
  notes: string | null;
  created_at: string;
};

export type AdSlotRow = {
  id: string;
  code: string;
  label: string;
  page: string;
  kind: "banner" | "sponsored_listing";
  desktop_size: string | null;
  mobile_size: string | null;
  allows_native: boolean;
  is_active: boolean;
  fallback: "adsense" | "gam" | "house" | "none";
  sort_order: number;
  notes: string | null;
};

export type LineItem = {
  id: string;
  io_id: string;
  slot_id: string;
  name: string;
  pricing_model: PricingModel;
  rate: number;
  target_quantity: number | null;
  start_at: string;
  end_at: string;
  priority: number;
  weight: number;
  target_brands: string[];
  status: "pending" | "active" | "paused" | "ended";
};

export type Creative = {
  id: string;
  line_item_id: string;
  format: "display" | "native";
  image_url: string | null;
  image_url_mobile: string | null;
  image_key: string | null;
  alt_text: string;
  destination_url: string;
  headline: string | null;
  body: string | null;
  cta_label: string | null;
  logo_url: string | null;
  review_status: "pending" | "approved" | "rejected";
  review_note: string | null;
  review_checklist: Record<string, boolean>;
  reviewed_at: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  io_id: string;
  invoice_number: string;
  kind: "down_payment" | "final";
  amount: number;
  ppn_amount: number;
  due_date: string;
  status: "unpaid" | "paid" | "overdue";
  pph23_proof_url: string | null;
  paid_at: string | null;
  notes: string | null;
};

export type RateCardRow = {
  slot_id: string;
  pricing_model: PricingModel;
  rate: number;
  min_order: string | null;
  notes: string | null;
};

export type AdsTxtEntry = {
  id: string;
  ad_system_domain: string;
  publisher_id: string;
  relationship: "DIRECT" | "RESELLER";
  cert_authority_id: string | null;
  is_active: boolean;
};

export type DailyRow = {
  day: string;
  creative_id: string;
  line_item_id: string;
  slot_id: string;
  impressions: number;
  clicks: number;
  bot_impressions: number;
  bot_clicks: number;
};

/* ------------------------------------------------------------ baca */

const newestFirst = <T extends { created_at: string }>(rows: T[]) =>
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

export async function listAdvertisers(): Promise<Advertiser[]> {
  return newestFirst((await selectAll("advertisers", "*")) as Advertiser[]);
}

export async function getAdvertiser(id: string): Promise<Advertiser | null> {
  const rows = must<Advertiser[]>(await db().from("advertisers").select("*").eq("id", id).limit(1), "advertiser");
  return rows[0] ?? null;
}

export async function listContracts(advertiserId?: string): Promise<Contract[]> {
  const rows = (
    advertiserId
      ? await selectWhereIn("contracts", "*", "advertiser_id", [advertiserId])
      : await selectAll("contracts", "*")
  ) as Contract[];
  return rows.sort((a, b) => b.start_date.localeCompare(a.start_date));
}

export async function getContract(id: string): Promise<Contract | null> {
  const rows = must<Contract[]>(await db().from("contracts").select("*").eq("id", id).limit(1), "PKS");
  return rows[0] ?? null;
}

export async function listIos(contractIds?: string[]): Promise<InsertionOrder[]> {
  if (contractIds && contractIds.length === 0) return [];
  const rows = (
    contractIds
      ? await selectWhereIn("insertion_orders", "*", "contract_id", contractIds)
      : await selectAll("insertion_orders", "*")
  ) as InsertionOrder[];
  return newestFirst(rows);
}

export async function getIo(id: string): Promise<InsertionOrder | null> {
  const rows = must<InsertionOrder[]>(await db().from("insertion_orders").select("*").eq("id", id).limit(1), "IO");
  return rows[0] ?? null;
}

export async function listSlots(): Promise<AdSlotRow[]> {
  return must(await db().from("ad_slots").select("*").order("sort_order", { ascending: true }), "slot");
}

export async function listLineItems(filter: { ioId?: string; ioIds?: string[] } = {}): Promise<LineItem[]> {
  if (filter.ioIds && filter.ioIds.length === 0) return [];
  const ioIds = filter.ioId ? [filter.ioId] : filter.ioIds;
  const rows = (
    ioIds ? await selectWhereIn("line_items", "*", "io_id", ioIds) : await selectAll("line_items", "*")
  ) as LineItem[];
  return rows.sort((a, b) => b.start_at.localeCompare(a.start_at));
}

export async function getLineItem(id: string): Promise<LineItem | null> {
  const rows = must<LineItem[]>(await db().from("line_items").select("*").eq("id", id).limit(1), "line item");
  return rows[0] ?? null;
}

export async function listCreatives(
  filter: { lineItemIds?: string[]; reviewStatus?: Creative["review_status"] } = {}
): Promise<Creative[]> {
  if (filter.lineItemIds && filter.lineItemIds.length === 0) return [];
  const rows = (
    filter.lineItemIds
      ? await selectWhereIn("creatives", "*", "line_item_id", filter.lineItemIds)
      : filter.reviewStatus
        ? await selectWhereIn("creatives", "*", "review_status", [filter.reviewStatus])
        : await selectAll("creatives", "*")
  ) as Creative[];
  return newestFirst(filter.reviewStatus ? rows.filter((row) => row.review_status === filter.reviewStatus) : rows);
}

export async function getCreative(id: string): Promise<Creative | null> {
  const rows = must<Creative[]>(await db().from("creatives").select("*").eq("id", id).limit(1), "materi iklan");
  return rows[0] ?? null;
}

export async function listInvoices(ioId: string): Promise<Invoice[]> {
  return must(
    await db().from("invoices").select("*").eq("io_id", ioId).order("created_at", { ascending: true }),
    "invoice"
  );
}

export async function listRateCard(): Promise<RateCardRow[]> {
  return must(await db().from("ad_rate_card").select("slot_id, pricing_model, rate, min_order, notes"), "rate card");
}

export async function listAdsTxt(): Promise<AdsTxtEntry[]> {
  return must(await db().from("ads_txt_entries").select("*").order("ad_system_domain"), "ads.txt");
}

export async function listSettings(): Promise<Record<string, string | null>> {
  const rows = must<{ key: string; value: string | null }[]>(
    await db().from("ad_settings").select("key, value"),
    "pengaturan iklan"
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/** Laporan harian (WIB) dari view ad_daily_report, dibaca per halaman sampai habis. */
export async function readDailyReport(filter: {
  from?: string;
  to?: string;
  lineItemIds?: string[];
}): Promise<DailyRow[]> {
  if (filter.lineItemIds && filter.lineItemIds.length === 0) return [];
  // Filter .in() dipecah per 80 ID supaya URL tidak melewati batas gateway.
  if (filter.lineItemIds && filter.lineItemIds.length > 80) {
    const out: DailyRow[] = [];
    for (let i = 0; i < filter.lineItemIds.length; i += 80) {
      out.push(...(await readDailyReport({ ...filter, lineItemIds: filter.lineItemIds.slice(i, i + 80) })));
    }
    return out;
  }
  const rows: DailyRow[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    let query = db()
      .from("ad_daily_report")
      .select("day, creative_id, line_item_id, slot_id, impressions, clicks, bot_impressions, bot_clicks")
      .order("day", { ascending: true })
      .order("creative_id", { ascending: true })
      .order("slot_id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (filter.from) query = query.gte("day", filter.from);
    if (filter.to) query = query.lte("day", filter.to);
    if (filter.lineItemIds) query = query.in("line_item_id", filter.lineItemIds);
    const page = must<Record<string, unknown>[]>(await query, "laporan iklan");
    for (const row of page) {
      rows.push({
        day: String(row.day),
        creative_id: String(row.creative_id),
        line_item_id: String(row.line_item_id),
        slot_id: String(row.slot_id),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        bot_impressions: Number(row.bot_impressions ?? 0),
        bot_clicks: Number(row.bot_clicks ?? 0),
      });
    }
    if (page.length < PAGE) return rows;
  }
}

export type DeliverySummary = {
  impressions: number;
  clicks: number;
  botImpressions: number;
  botClicks: number;
};

export function sumDelivery(rows: DailyRow[]): Map<string, DeliverySummary> {
  const map = new Map<string, DeliverySummary>();
  for (const row of rows) {
    const current = map.get(row.line_item_id) ?? { impressions: 0, clicks: 0, botImpressions: 0, botClicks: 0 };
    current.impressions += row.impressions;
    current.clicks += row.clicks;
    current.botImpressions += row.bot_impressions;
    current.botClicks += row.bot_clicks;
    map.set(row.line_item_id, current);
  }
  return map;
}

export function billingFor(item: LineItem, delivery: DeliverySummary | undefined): Billing {
  return computeBilling(
    { pricingModel: item.pricing_model, rateIdr: item.rate, bookedQuantity: item.target_quantity },
    { impressions: delivery?.impressions ?? 0, clicks: delivery?.clicks ?? 0 }
  );
}

/** Jumlah materi yang menunggu review (lencana di navigasi iklan). */
export async function countPendingCreatives(): Promise<number> {
  const { count, error } = await db()
    .from("creatives")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "pending");
  if (error) {
    console.error("[iklan-admin] gagal menghitung antrean review:", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Konteks lengkap satu line item: IO, PKS, advertiser, slot. Dipakai server
 * action untuk memeriksa status rantai sebelum menulis.
 */
export async function lineItemContext(lineItemId: string) {
  const item = await getLineItem(lineItemId);
  if (!item) return null;
  const io = await getIo(item.io_id);
  const contract = io ? await getContract(io.contract_id) : null;
  const advertiser = contract ? await getAdvertiser(contract.advertiser_id) : null;
  const slot = (await listSlots()).find((row) => row.id === item.slot_id) ?? null;
  return { item, io, contract, advertiser, slot };
}

/** Advertiser dianggap baru bila belum pernah punya materi yang disetujui. */
export async function advertiserHasApprovedCreative(advertiserId: string): Promise<boolean> {
  const contracts = await listContracts(advertiserId);
  const ios = await listIos(contracts.map((row) => row.id));
  const items = await listLineItems({ ioIds: ios.map((row) => row.id) });
  if (items.length === 0) return false;
  const approved = await listCreatives({ lineItemIds: items.map((row) => row.id), reviewStatus: "approved" });
  return approved.length > 0;
}
