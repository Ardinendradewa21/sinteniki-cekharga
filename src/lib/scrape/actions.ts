"use server";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { createBatch } from "@/lib/import/batches";
import { readImageRights } from "@/lib/import/image-rights";
import { mapRow } from "@/lib/import/gsmarena";
import { SPEC_COLUMNS, type SpecRow } from "@/lib/scrape/parsers";
import {
  fetchGsmarenaSpec,
  fetchLineup,
  findGsmarenaPage,
  GSMARENA_PATH,
  officialSourceFor,
  ScrapeBlockedError,
  ScrapeSourceError,
} from "@/lib/scrape/sources";
import {
  SCRAPE_BRANDS,
  type CommitSummary,
  type LineupResult,
  type PreviewIssue,
  type ResolveResult,
} from "@/lib/scrape/types";

/**
 * Aksi admin untuk tarik data otomatis (spesifikasi GSMArena + harga situs
 * resmi vivo/iQOO).
 *
 * Tiga tahap, masing-masing aksi terpisah supaya tidak ada satu permintaan
 * panjang yang bisa kena timeout:
 *
 *   1. `loadLineupAction`   daftar model + harga dari situs resmi.
 *   2. `resolveModelAction` satu model: cocokkan ke GSMArena, baca spesifikasi,
 *                           dan susun pratinjau beserta temuannya. UI
 *                           memanggilnya satu per satu dengan progres.
 *   3. `commitScrapeAction` simpan pilihan admin lewat jalur impor yang SAMA
 *                           dengan unggahan CSV manual, sehingga aturan draft,
 *                           validasi Zod, audit, dan revalidasi cache tidak
 *                           punya jalur kedua yang bisa berbeda.
 *
 * Seluruh data yang dikirim balik oleh browser (baris daftar, baris
 * spesifikasi) divalidasi ulang di sini; statusnya sama dengan berkas CSV
 * yang diunggah admin.
 */

// URL per varian juga dicek host-nya terhadap konfigurasi merek saat menyimpan.
const priceExtras = {
  inStock: z.boolean().optional(),
  url: z.string().url().startsWith("https://").max(400).optional(),
};

const priceSchema = z.object({
  ramGb: z.number().int().positive().max(64),
  storageGb: z.number().int().positive().max(4096),
  priceIdr: z.number().int().min(100_000).max(100_000_000),
  isPromotion: z.boolean(),
  ...priceExtras,
});

const lineupSchema = z.object({
  officialId: z.string().min(1).max(80),
  brand: z.enum(SCRAPE_BRANDS),
  officialName: z.string().trim().min(1).max(120),
  // Host-nya dicek terhadap konfigurasi merek saat menyimpan harga.
  officialUrl: z.string().url().startsWith("https://").max(400).nullable(),
  prices: z.array(priceSchema).max(20),
  storageOnlyPrices: z
    .array(
      z.object({
        storageGb: z.number().int().positive().max(4096),
        priceIdr: z.number().int().min(100_000).max(100_000_000),
        isPromotion: z.boolean(),
        ...priceExtras,
      })
    )
    .max(20),
  unassignedPrices: z
    .array(
      z.object({
        priceIdr: z.number().int().min(100_000).max(100_000_000),
        isPromotion: z.boolean(),
        url: z.string().url().startsWith("https://").max(400).optional(),
      })
    )
    .max(10),
  gsmarenaPath: z.string().regex(GSMARENA_PATH).nullable(),
  priceIssues: z.array(z.string().max(400)).max(30),
  siblingHas5g: z.boolean(),
});

const specRowSchema = z
  .object(
    Object.fromEntries(SPEC_COLUMNS.map((column) => [column, z.string().max(3000)])) as Record<
      (typeof SPEC_COLUMNS)[number],
      z.ZodString
    >
  )
  .strict()
  .refine((row) => GSMARENA_PATH.test(row.url), "Alamat sumber GSMArena tidak valid.");

function friendlyError(error: unknown): { error: string; blocked: boolean } {
  if (error instanceof ScrapeBlockedError) return { error: error.message, blocked: true };
  if (error instanceof ScrapeSourceError) return { error: error.message, blocked: false };
  console.error("[scrape] galat tak terduga:", error);
  return { error: "Terjadi galat saat mengambil data. Coba lagi.", blocked: false };
}

/* ------------------------------------------------------------ tahap 1 */

export async function loadLineupAction(brand: string): Promise<LineupResult> {
  await requireAdmin();
  const parsed = z.enum(SCRAPE_BRANDS).safeParse(brand);
  if (!parsed.success) return { ok: false, error: "Merek belum didukung." };

  try {
    const items = await fetchLineup(parsed.data);
    return { ok: true, items, fetchedAt: new Date().toISOString() };
  } catch (error) {
    return { ok: false, error: friendlyError(error).error };
  }
}

/* ------------------------------------------------------------ tahap 2 */

export async function resolveModelAction(input: unknown): Promise<ResolveResult> {
  await requireAdmin();
  const parsed = z
    .object({ lineup: lineupSchema, pathOverride: z.string().regex(GSMARENA_PATH).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data model tidak valid.", blocked: false };
  const { lineup, pathOverride } = parsed.data;

  try {
    // Daftar dari GSMArena sudah membawa halamannya; tidak perlu dicocokkan.
    const found = lineup.gsmarenaPath
      ? { chosen: { name: lineup.officialName, path: lineup.gsmarenaPath }, alternatives: [] }
      : await findGsmarenaPage(lineup.brand, lineup.officialName, lineup.siblingHas5g);
    const target = pathOverride
      ? { name: found.chosen?.path === pathOverride ? found.chosen.name : pathOverride, path: pathOverride }
      : found.chosen;
    const alternatives = [found.chosen, ...found.alternatives].filter(
      (candidate): candidate is NonNullable<typeof candidate> =>
        candidate !== null && candidate.path !== target?.path
    );

    const issues: PreviewIssue[] = lineup.priceIssues.map((message) => ({
      level: "warning",
      message: `Harga resmi: ${message}`,
    }));

    if (!target) {
      return {
        ok: true,
        item: {
          lineup,
          gsmarena: null,
          alternatives: [],
          specRow: null,
          summary: null,
          prices: lineup.prices.map((price) => ({ ...price, variantKnown: false })),
          catalog: { status: "new", slug: null },
          issues: [
            {
              level: "error",
              message: "Tidak ditemukan di daftar model merek ini di GSMArena, jadi spesifikasinya tidak bisa diambil.",
            },
            ...issues,
          ],
        },
      };
    }

    const spec = await fetchGsmarenaSpec(lineup.brand, target.path);
    for (const message of spec.issues) issues.push({ level: "warning", message });

    const outcome = mapRow(spec.row);
    if (!outcome.ok) {
      issues.unshift({ level: "error", message: outcome.reason });
    }

    const candidate = outcome.ok ? outcome.candidate : null;
    const variantKeys = new Set(candidate?.variants.map((v) => `${v.ramGb}+${v.storageGb}`) ?? []);

    // Harga yang RAM-nya tidak disebut situs resmi (Samsung) dipasangkan ke
    // varian GSMArena dengan penyimpanan sama, HANYA bila pasangannya tunggal.
    const resolvedPrices = [...lineup.prices];
    for (const price of lineup.storageOnlyPrices) {
      const matches = candidate?.variants.filter((v) => v.storageGb === price.storageGb) ?? [];
      const exists = resolvedPrices.some((p) => p.storageGb === price.storageGb);
      if (exists) continue;
      if (matches.length === 1) {
        resolvedPrices.push({ ...price, ramGb: matches[0].ramGb });
      } else {
        issues.push({
          level: "warning",
          message: `Harga resmi untuk penyimpanan ${price.storageGb} GB tidak menyebut RAM dan tidak bisa dipasangkan ke satu varian; harganya dilewati.`,
        });
      }
    }
    // "Harga mulai" tanpa keterangan varian tidak pernah dipasangkan otomatis:
    // admin memilih variannya di pratinjau, atau harganya tidak disimpan.
    for (const price of lineup.unassignedPrices) {
      issues.push({
        level: "warning",
        message: `Situs resmi hanya menyebut harga mulai ${new Intl.NumberFormat("id-ID").format(price.priceIdr)} tanpa varian. Pilih variannya di pratinjau, atau harga ini tidak disimpan.`,
      });
    }

    const resolvedLineup = { ...lineup, prices: resolvedPrices, storageOnlyPrices: [] };

    const prices = resolvedPrices.map((price) => ({
      ...price,
      variantKnown: variantKeys.has(`${price.ramGb}+${price.storageGb}`),
    }));
    for (const price of prices) {
      if (!price.variantKnown) {
        issues.push({
          level: "warning",
          message: `Varian ${price.ramGb}/${price.storageGb} GB punya harga resmi tetapi tidak tercatat di GSMArena; harganya akan dilewati.`,
        });
      }
    }

    // Label jaringan di nama resmi harus cocok dengan data GSMArena.
    const has5g = /5G/i.test(spec.row.network_technology);
    if (/\b5G\b/i.test(lineup.officialName) && !has5g) {
      issues.push({ level: "warning", message: "Nama resmi menyebut 5G, tetapi halaman GSMArena yang dipasangkan tidak mendukung 5G." });
    }
    if (lineup.siblingHas5g && has5g) {
      issues.push({ level: "warning", message: "Situs resmi punya versi 5G terpisah, tetapi halaman GSMArena ini 5G. Periksa apakah pasangannya tertukar." });
    }

    const year = candidate?.specs.releaseYear ?? null;
    if (year !== null && year < new Date().getFullYear() - 2 && prices.length > 0) {
      issues.push({ level: "warning", message: `Rilis ${year}. Harga di situs resmi bisa jadi harga peluncuran lama, bukan harga jual saat ini.` });
    }
    if (/coming soon|rumored|cancelled/i.test(spec.row.status_raw)) {
      issues.push({ level: "warning", message: `Status GSMArena: ${spec.row.status_raw}.` });
    }

    let catalog: { status: "new" | "draft" | "published"; slug: string | null } = { status: "new", slug: null };
    if (candidate) {
      const { data } = await getInsforgeAdminClient()
        .database.from("products")
        .select("slug, status")
        .eq("source_key", candidate.sourceKey)
        .limit(1);
      const existing = (data ?? [])[0] as { slug: string; status: "draft" | "published" } | undefined;
      if (existing) catalog = { status: existing.status, slug: existing.slug };
    }

    return {
      ok: true,
      item: {
        lineup: resolvedLineup,
        gsmarena: target,
        alternatives,
        specRow: spec.row,
        summary: candidate
          ? {
              brand: candidate.brand,
              model: candidate.model,
              slug: catalog.slug ?? candidate.slug,
              releaseYear: year,
              network: spec.row.network_technology,
              chipset: candidate.specs.chipset,
              displayInches: candidate.specs.displayInches,
              batteryMah: candidate.specs.batteryMah,
              variants: candidate.variants,
            }
          : null,
        prices,
        catalog,
        issues,
      },
    };
  } catch (error) {
    return { ok: false, ...friendlyError(error) };
  }
}

/* ------------------------------------------------------------ tahap 3 */

const MAX_COMMIT_ITEMS = 150;

export async function commitScrapeAction(input: unknown): Promise<CommitSummary> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      items: z
        .array(z.object({ lineup: lineupSchema, specRow: specRowSchema }))
        .min(1)
        .max(MAX_COMMIT_ITEMS),
      imageUsageRights: z.string().trim().max(500),
      imageUsageBasis: z.string().trim().max(40).default(""),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { error: "Data yang akan disimpan tidak valid. Muat ulang pratinjau.", specs: null, prices: null };
  }
  const { items, imageUsageRights, imageUsageBasis } = parsed.data;
  const brand = items[0].lineup.brand;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  const rights = readImageRights(imageUsageBasis, imageUsageRights);
  if (!rights.ok) return { error: rights.error, specs: null, prices: null };

  // Semua hasil tarik otomatis masuk Pusat Impor sebagai batch pratinjau,
  // melewati penyeragaman dan tabel tinjauan yang sama dengan unggah CSV.
  // Harga resmi disimpan sebagai lampiran batch; pratinjaunya dibuat setelah
  // spesifikasi diterapkan, karena produk baru belum punya slug sebelum itu.
  const observedAt = new Date().toISOString();
  const offerRows = items.flatMap(({ lineup, specRow }) => {
    const outcome = mapRow(specRow as SpecRow);
    if (!outcome.ok) return [];
    const source = officialSourceFor(lineup.brand);
    const officialUrl = lineup.officialUrl;
    if (!source || !officialUrl || new URL(officialUrl).hostname !== source.host) return [];
    return lineup.prices.map((price) => {
      // Halaman khusus varian (Digimap) dipakai bila host-nya sah; selain itu
      // halaman model.
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

  const created = await createBatch({
    kind: "specs",
    origin: "scrape",
    sourceLabel: `Tarik otomatis ${brand} ${stamp}`,
    options: {
      imageRights: rights.rights,
      ...(offerRows.length > 0
        ? {
            followUpOffers: {
              sourceLabel: `Harga resmi ${brand} ${stamp}`,
              defaultObservedAt: observedAt,
              rows: offerRows,
            },
          }
        : {}),
    },
    rows: items.map((item) => stringRow(item.specRow as SpecRow)),
    malformedLines: [],
    admin,
  });
  if (!created.ok) return { error: created.error, specs: null, prices: null };
  return { error: null, specs: null, prices: null, batchId: created.id };
}

/** Baris CSV selalu berisi teks; nilai spesifikasi disamakan bentuknya. */
function stringRow(row: SpecRow): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)])
  );
}
