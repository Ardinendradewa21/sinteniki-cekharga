"use server";

import { z } from "zod";

import { requireStaff } from "@/lib/auth/dal";
import { createBatch } from "@/lib/import/batches";
import { readImageRights } from "@/lib/import/image-rights";
import { mapRow } from "@/lib/import/gsmarena";
import { planCommit, sessionAgeDays, SESSION_PRICE_MAX_AGE_DAYS } from "@/lib/scrape/commit-rules";
import type { SpecRow } from "@/lib/scrape/parsers";
import { friendlyError, resolveLineupItem } from "@/lib/scrape/resolve";
import { claimCommit, createSession, getSession, linkBatch, saveResult } from "@/lib/scrape/sessions";
import { GSMARENA_PATH, fetchLineup, officialSourceFor } from "@/lib/scrape/sources";
import { SCRAPE_BRANDS, type CommitSummary, type LineupItem, type ResolveResult } from "@/lib/scrape/types";

/**
 * Aksi tarik otomatis (admin). Semua langkah bekerja di atas SESI yang
 * disimpan server (lihat sessions.ts):
 *
 *   1. loadLineupAction   — ambil daftar + harga resmi, simpan sebagai sesi.
 *   2. resolveModelAction — ambil spesifikasi satu model dari sesi, simpan hasilnya.
 *   3. commitScrapeAction — kirim model terpilih ke Pusat Impor sebagai batch.
 *
 * Browser hanya mengirim ID sesi, ID model, dan pilihan admin. Daftar model,
 * harga resmi, dan spesifikasi tidak pernah dipercaya dari browser.
 */

const MAX_COMMIT_ITEMS = 150;

/* ------------------------------------------------------------ tahap 1 */

export type LoadLineupResult =
  | { ok: true; sessionId: string; items: LineupItem[]; fetchedAt: string }
  | { ok: false; error: string };

export async function loadLineupAction(brand: string): Promise<LoadLineupResult> {
  const admin = await requireStaff([]);
  const parsed = z.enum(SCRAPE_BRANDS).safeParse(brand);
  if (!parsed.success) return { ok: false, error: "Merek belum didukung." };

  try {
    const items = await fetchLineup(parsed.data);
    const fetchedAt = new Date().toISOString();
    const sessionId = await createSession(parsed.data, items, fetchedAt, admin);
    if (!sessionId) return { ok: false, error: "Daftar model terambil tetapi sesi gagal disimpan. Coba lagi." };
    return { ok: true, sessionId, items, fetchedAt };
  } catch (error) {
    return { ok: false, error: friendlyError(error).error };
  }
}

/* ------------------------------------------------------------ tahap 2 */

export async function resolveModelAction(input: unknown): Promise<ResolveResult> {
  await requireStaff([]);
  const parsed = z
    .object({
      sessionId: z.uuid(),
      officialId: z.string().min(1).max(80),
      pathOverride: z.string().regex(GSMARENA_PATH).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data model tidak valid.", blocked: false };
  const { sessionId, officialId, pathOverride } = parsed.data;

  const session = await getSession(sessionId);
  if (!session) return { ok: false, error: "Sesi tarik tidak ditemukan. Muat ulang daftar model.", blocked: false };
  if (session.status !== "open") {
    return { ok: false, error: "Sesi ini sudah dikirim ke Pusat Impor. Muat daftar baru untuk menarik lagi.", blocked: false };
  }
  const lineup = session.lineup.find((item) => item.officialId === officialId);
  if (!lineup) return { ok: false, error: "Model tidak ada di daftar sesi ini.", blocked: false };

  const result = await resolveLineupItem(lineup, pathOverride);
  await saveResult(
    sessionId,
    officialId,
    result.ok ? { status: "ok", item: result.item } : { status: "error", error: result.error, blocked: result.blocked }
  );
  return result;
}

/* ------------------------------------------------------------ tahap 3 */

export async function commitScrapeAction(input: unknown): Promise<CommitSummary> {
  const admin = await requireStaff([]);
  const parsed = z
    .object({
      sessionId: z.uuid(),
      items: z
        .array(
          z.object({
            officialId: z.string().min(1).max(80),
            assignments: z.record(z.string().regex(/^\d{1,2}$/), z.string().regex(/^\d{1,3}\+\d{1,5}$/)).optional(),
          })
        )
        .min(1)
        .max(MAX_COMMIT_ITEMS),
      imageUsageRights: z.string().trim().max(500),
      imageUsageBasis: z.string().trim().max(40).default(""),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { error: "Data yang akan disimpan tidak valid. Muat ulang pratinjau.", specs: null, prices: null };
  }
  const { sessionId, items, imageUsageRights, imageUsageBasis } = parsed.data;

  const rights = readImageRights(imageUsageBasis, imageUsageRights);
  if (!rights.ok) return { error: rights.error, specs: null, prices: null };

  const session = await getSession(sessionId);
  if (!session) return { error: "Sesi tarik tidak ditemukan. Muat ulang daftar model.", specs: null, prices: null };
  if (session.status === "committed" && session.batchId) {
    // Klik ganda / kiriman ulang: arahkan ke batch yang sudah dibuat, jangan buat lagi.
    return { error: null, specs: null, prices: null, batchId: session.batchId };
  }
  const ageDays = sessionAgeDays(session.fetchedAt, new Date());
  if (ageDays > SESSION_PRICE_MAX_AGE_DAYS) {
    return {
      error: `Daftar harga sesi ini diambil ${ageDays} hari lalu. Muat daftar baru supaya harga yang disimpan masih berlaku.`,
      specs: null,
      prices: null,
    };
  }

  const plan = planCommit(session.results, items);
  if (plan.accepted.length === 0) {
    return { error: plan.rejected[0]?.reason ?? "Tidak ada model yang bisa dikirim.", specs: null, prices: null };
  }
  if (!(await claimCommit(sessionId))) {
    return { error: "Sesi ini sedang dikirim. Tunggu sebentar lalu muat ulang.", specs: null, prices: null };
  }

  // Waktu pengamatan harga = saat daftar harga diambil dari situs resmi,
  // bukan saat tombol Kirim diklik.
  const observedAt = session.fetchedAt;
  const offerRows = plan.accepted.flatMap(({ item, prices }) => {
    const outcome = mapRow(item.specRow as SpecRow);
    if (!outcome.ok) return [];
    const source = officialSourceFor(item.lineup.brand);
    const officialUrl = item.lineup.officialUrl;
    if (!source || !officialUrl || new URL(officialUrl).hostname !== source.host) return [];
    return prices.map((price) => {
      // Halaman khusus varian (Digimap) dipakai bila host-nya sah; selain itu halaman model.
      const url = price.url && new URL(price.url).hostname === source.host ? price.url : officialUrl;
      return {
        // Diganti slug produk yang tersimpan saat batch harga dibuat.
        source_key: outcome.candidate.sourceKey,
        ram_gb: String(price.ramGb),
        storage_gb: String(price.storageGb),
        marketplace: source.marketplace,
        seller_name: source.sellerName,
        url,
        // Garansi tidak dinyatakan eksplisit di data situs; dibiarkan kosong
        // (tidak diketahui) daripada ditebak.
        warranty: "",
        // Varian yang semua warnanya habis dicatat apa adanya, sehingga tidak
        // menjadi harga aktif (PRD §7 butir 2).
        listing_status: price.inStock === false ? "out-of-stock" : "active",
        seller_verified: "tidak",
        price_idr: String(price.priceIdr),
        observed_at: observedAt,
      };
    });
  });

  const stamp = new Date(session.fetchedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const created = await createBatch({
    kind: "specs",
    origin: "scrape",
    sourceLabel: `Tarik otomatis ${session.brand} ${stamp}`,
    options: {
      imageRights: rights.rights,
      scrapeSessionId: sessionId,
      ...(offerRows.length > 0
        ? {
            followUpOffers: {
              sourceLabel: `Harga resmi ${session.brand} ${stamp}`,
              defaultObservedAt: observedAt,
              rows: offerRows,
            },
          }
        : {}),
    },
    rows: plan.accepted.map(({ item }) => stringRow(item.specRow as SpecRow)),
    malformedLines: [],
    admin,
  });
  await linkBatch(sessionId, created.ok ? created.id : null);
  if (!created.ok) return { error: created.error, specs: null, prices: null };
  return { error: null, specs: null, prices: null, batchId: created.id };
}

/** Baris CSV selalu berisi teks; nilai spesifikasi disamakan bentuknya. */
function stringRow(row: SpecRow): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)])
  );
}
