import "server-only";

import type { AdminSession } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { selectWhereIn } from "@/lib/backend/paged-read";
import { chunk } from "@/lib/import/batch";
import { createBatch, queuePlannedItems } from "@/lib/import/batches";
import { planPriceRefresh, refreshKeyFor, type RefreshOffer } from "@/lib/import/price-refresh-rules";
import { fetchLineup, modelKeyFor, officialSourceFor, ScrapeBlockedError } from "@/lib/scrape/sources";
import { SCRAPE_BRANDS, type LineupItem, type ScrapeBrand } from "@/lib/scrape/types";

/**
 * Pemeriksaan harga harian dari situs resmi (PRD §7). Dijalankan cron harian
 * (`/api/cron/daily`), bukan oleh admin.
 *
 * Alur per merek yang punya sumber harga resmi:
 *   1. Lewati bila hari ini sudah diperiksa (kunci `refreshKey` unik di DB;
 *      cron Vercel tidak mencegah pemanggilan tumpang tindih) atau bila belum
 *      ada penawaran tersimpan dari situs itu (tidak perlu menghubunginya).
 *   2. Ambil daftar harga resmi satu kali (`fetchLineup`, sopan per host).
 *   3. Cocokkan ke penawaran yang SUDAH ada (`planPriceRefresh`), lalu buat
 *      batch harga `origin = schedule` dan langsung antrekan. Worker yang sama
 *      dengan impor biasa menulisnya, jadi jejak asal dan undo tetap berlaku.
 *   4. Penawaran yang tidak tercantum lagi dicatat sebagai pemeriksaan GAGAL.
 *
 * Sumber yang tidak bisa dihubungi tidak menghasilkan catatan apa pun: harga
 * lama tetap menua dan diberi label kedaluwarsa oleh aturan harga, jujur tanpa
 * membanjiri riwayat dengan kegagalan yang bukan milik penawarannya.
 */

export const SCHEDULE_ACTOR: AdminSession = {
  userId: "",
  email: "sistem: pemeriksaan harga harian",
  role: "admin",
};

export type RefreshOutcome = {
  brand: ScrapeBrand;
  status: "already-checked" | "no-offers" | "source-error" | "blocked" | "nothing-to-update" | "queued" | "error";
  batchId?: string;
  updated?: number;
  missing?: number;
  ambiguous?: number;
  message?: string;
};

function db() {
  return getInsforgeAdminClient().database;
}

/** Penawaran tersimpan yang tautannya mengarah ke host situs resmi merek itu. */
async function officialOffers(host: string): Promise<RefreshOffer[]> {
  const offers: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("offers")
      .select("id, variant_id, url, warranty, seller_verified")
      .like("url", `https://${host}/%`)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`Penawaran ${host} gagal dibaca.`);
    const page = (data ?? []) as Record<string, unknown>[];
    offers.push(...page);
    if (page.length < 1000) break;
  }
  if (offers.length === 0) return [];

  const variants = await selectWhereIn(
    "variants",
    "id, product_id, ram_gb, storage_gb",
    "id",
    offers.map((row) => String(row.variant_id))
  );
  const products = await selectWhereIn("products", "id, slug, brand, model", "id", variants.map((row) => String(row.product_id)));
  const productOf = new Map(products.map((row) => [String(row.id), row]));
  const variantOf = new Map(variants.map((row) => [String(row.id), row]));

  return offers.flatMap((row) => {
    const variant = variantOf.get(String(row.variant_id));
    const product = variant ? productOf.get(String(variant.product_id)) : undefined;
    if (!variant || !product) return [];
    return [
      {
        offerId: String(row.id),
        url: String(row.url),
        slug: String(product.slug),
        modelName: `${product.brand} ${product.model}`,
        ramGb: Number(variant.ram_gb),
        storageGb: Number(variant.storage_gb),
        warranty: (row.warranty as string | null) ?? null,
        sellerVerified: row.seller_verified === true,
      },
    ];
  });
}

async function alreadyChecked(refreshKey: string): Promise<boolean> {
  const { data, error } = await db()
    .from("import_batches")
    .select("id")
    .eq("options->>refreshKey", refreshKey)
    .limit(1);
  if (error) throw new Error("Riwayat pemeriksaan harga gagal dibaca.");
  return (data ?? []).length > 0;
}

async function recordMissing(missing: { offerId: string; reason: string }[], attemptedAt: string, batchId: string | null) {
  for (const group of chunk(missing, 200)) {
    const { error } = await db()
      .from("price_checks")
      .upsert(
        group.map(({ offerId, reason }) => ({
          offer_id: offerId,
          attempted_at: attemptedAt,
          outcome: "failure",
          error_summary: reason,
          batch_id: batchId,
        })),
        { onConflict: "offer_id,attempted_at,outcome", ignoreDuplicates: true }
      );
    if (error) throw new Error("Pemeriksaan gagal tidak bisa dicatat.");
  }
}

type Prepared =
  | { brand: ScrapeBrand; done: RefreshOutcome }
  | { brand: ScrapeBrand; offers: RefreshOffer[]; lineup: LineupItem[]; fetchedAt: string; refreshKey: string };

async function prepare(brand: ScrapeBrand, now: Date): Promise<Prepared> {
  const source = officialSourceFor(brand);
  if (!source) return { brand, done: { brand, status: "no-offers" } };
  const refreshKey = refreshKeyFor(brand, now);
  try {
    if (await alreadyChecked(refreshKey)) return { brand, done: { brand, status: "already-checked" } };
    const offers = await officialOffers(source.host);
    if (offers.length === 0) return { brand, done: { brand, status: "no-offers" } };
    const lineup = await fetchLineup(brand);
    return { brand, offers, lineup, fetchedAt: new Date().toISOString(), refreshKey };
  } catch (error) {
    // Tantangan anti-bot tidak ditembus; dicatat dan dicoba lagi besok.
    const blocked = error instanceof ScrapeBlockedError;
    console.error(`[harga-harian] ${brand}: sumber gagal dibaca:`, error);
    return {
      brand,
      done: { brand, status: blocked ? "blocked" : "source-error", message: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Situs tiap merek berbeda host, jadi daftar harganya diambil paralel (antrean
 * sopan per host tetap berlaku). Batch dibuat berurutan supaya perhitungan
 * rencana tidak membaca katalog tujuh kali bersamaan.
 */
export async function runPriceRefresh(now = new Date(), brands: readonly ScrapeBrand[] = SCRAPE_BRANDS): Promise<RefreshOutcome[]> {
  const prepared = await Promise.all(brands.map((brand) => prepare(brand, now)));
  const outcomes: RefreshOutcome[] = [];

  for (const item of prepared) {
    if ("done" in item) {
      outcomes.push(item.done);
      continue;
    }
    const { brand, offers, lineup, fetchedAt, refreshKey } = item;
    const source = officialSourceFor(brand)!;
    try {
      const plan = planPriceRefresh({ lineup, offers, source, observedAt: fetchedAt, keyOf: modelKeyFor(brand) });
      let batchId: string | null = null;
      if (plan.rows.length > 0) {
        const created = await createBatch({
          kind: "offers",
          origin: "schedule",
          sourceLabel: `Pemeriksaan harga harian ${source.marketplace} ${refreshKey.split(":")[1]}`,
          options: { defaultObservedAt: fetchedAt, imageRights: null, refreshKey },
          rows: plan.rows,
          malformedLines: [],
          admin: SCHEDULE_ACTOR,
        });
        if (!created.ok) {
          // Termasuk tabrakan kunci unik bila pemanggilan lain lebih dulu.
          outcomes.push({ brand, status: "error", message: created.error });
          continue;
        }
        batchId = created.id;
        const queued = await queuePlannedItems(created.id, created.plan, SCHEDULE_ACTOR);
        if (!queued.ok) {
          outcomes.push({ brand, status: "error", batchId, message: queued.error });
          continue;
        }
      }
      if (plan.missing.length > 0) await recordMissing(plan.missing, fetchedAt, batchId);
      outcomes.push({
        brand,
        status: batchId ? "queued" : "nothing-to-update",
        ...(batchId ? { batchId } : {}),
        updated: plan.rows.length,
        missing: plan.missing.length,
        ambiguous: plan.ambiguous.length,
      });
    } catch (error) {
      console.error(`[harga-harian] ${brand}: gagal diproses:`, error);
      outcomes.push({ brand, status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }
  return outcomes;
}
