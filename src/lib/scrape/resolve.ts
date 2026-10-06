import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { mapRow } from "@/lib/import/gsmarena";
import {
  fetchGsmarenaSpec,
  findGsmarenaPage,
  ScrapeBlockedError,
  ScrapeSourceError,
} from "@/lib/scrape/sources";
import type { LineupItem, PreviewIssue, ResolveResult } from "@/lib/scrape/types";

/**
 * Mengambil spesifikasi GSMArena untuk satu model dari daftar resmi dan
 * menyusun pratinjaunya (pasangan harga–varian, temuan, status di katalog).
 *
 * `lineup` SELALU berasal dari sesi yang disimpan server, bukan dari browser,
 * sehingga harga resmi tidak bisa diubah sebelum disimpan.
 */

export function friendlyError(error: unknown): { error: string; blocked: boolean } {
  if (error instanceof ScrapeBlockedError) return { error: error.message, blocked: true };
  if (error instanceof ScrapeSourceError) return { error: error.message, blocked: false };
  console.error("[scrape] galat tak terduga:", error);
  return { error: "Terjadi galat saat mengambil data. Coba lagi.", blocked: false };
}

export async function resolveLineupItem(lineup: LineupItem, pathOverride?: string): Promise<ResolveResult> {
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
