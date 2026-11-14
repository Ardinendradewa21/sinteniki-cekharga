import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { ScrapeCooldownError } from "@/lib/scrape/cooldown";
import { mapRow } from "@/lib/import/gsmarena";
import { implausibleVariant } from "@/lib/import/variant-rules";
import { SPEC_COLUMNS, type SpecRow } from "@/lib/scrape/parsers";
import {
  fetchGsmarenaSpec,
  findGsmarenaPage,
  parseGsmarenaSpecHtml,
  officialSourceFor,
  ScrapeBlockedError,
  ScrapeSourceError,
} from "@/lib/scrape/sources";
import { SCRAPE_BRAND_LABELS, type LineupItem, type PreviewIssue, type ResolveResult } from "@/lib/scrape/types";

/**
 * Mengambil spesifikasi GSMArena untuk satu model dari daftar resmi dan
 * menyusun pratinjaunya (pasangan harga–varian, temuan, status di katalog).
 *
 * `lineup` SELALU berasal dari sesi yang disimpan server, bukan dari browser,
 * sehingga harga resmi tidak bisa diubah sebelum disimpan.
 */

export function friendlyError(error: unknown): { error: string; blocked: boolean } {
  if (error instanceof ScrapeBlockedError) return { error: error.message, blocked: true };
  // Masa tenang bukan blokir baru: tidak dicatat sebagai `blocked`, supaya
  // menunggu tidak memperpanjang masa tenangnya sendiri.
  if (error instanceof ScrapeCooldownError) return { error: error.message, blocked: false };
  if (error instanceof ScrapeSourceError) return { error: error.message, blocked: false };
  console.error("[scrape] galat tak terduga:", error);
  return { error: "Terjadi galat saat mengambil data. Coba lagi.", blocked: false };
}

export async function resolveLineupItem(
  lineup: LineupItem,
  pathOverride?: string,
  /**
   * HTML halaman model yang disalin admin dari browsernya (Salin spesifikasi).
   * Bila ada, GSMArena tidak dihubungi sama sekali; `lineup.gsmarenaPath`
   * wajib berisi path halaman itu.
   */
  pasted?: { html: string }
): Promise<ResolveResult> {
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

    if (!target) return await officialOnlyResult(lineup, issues);

    const spec = pasted
      ? parseGsmarenaSpecHtml(lineup.brand, target.path, pasted.html)
      : await fetchGsmarenaSpec(lineup.brand, target.path);
    for (const message of spec.issues) issues.push({ level: "warning", message });

    const outcome = mapRow(spec.row);
    if (!outcome.ok) {
      issues.unshift({ level: "error", message: outcome.reason });
    }

    let candidate = outcome.ok ? outcome.candidate : null;
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

    // Varian yang dijual dengan harga di situs resmi Indonesia tetapi tidak
    // tercatat di GSMArena (mis. vivo Y500 6/128 GB) bukan karangan: situs
    // resmi adalah buktinya. Varian itu ditambahkan ke spesifikasi; kombinasi
    // yang tidak lazim tetap dilewati.
    const officialOnly = resolvedPrices.filter(
      (price) => !variantKeys.has(`${price.ramGb}+${price.storageGb}`) && !implausibleVariant(price.ramGb, price.storageGb)
    );
    if (candidate && officialOnly.length > 0) {
      const merged = [...candidate.variants, ...officialOnly.map(({ ramGb, storageGb }) => ({ ramGb, storageGb }))];
      spec.row.memory_variants_summary = merged.map((v) => `${v.storageGb}GB/${v.ramGb}GB`).join("; ");
      const remapped = mapRow(spec.row);
      if (remapped.ok) {
        candidate = remapped.candidate;
        for (const v of officialOnly) variantKeys.add(`${v.ramGb}+${v.storageGb}`);
        issues.push({
          level: "warning",
          message: `Varian ${officialOnly.map((v) => `${v.ramGb}/${v.storageGb} GB`).join(", ")} dijual dengan harga di situs resmi tetapi tidak tercatat di GSMArena; varian ini ditambahkan ke produk.`,
        });
      }
    }

    const prices = resolvedPrices.map((price) => ({
      ...price,
      variantKnown: variantKeys.has(`${price.ramGb}+${price.storageGb}`),
    }));
    for (const price of prices) {
      if (!price.variantKnown) {
        issues.push({
          level: "warning",
          message: `Varian ${price.ramGb}/${price.storageGb} GB tidak tercatat di GSMArena dan tidak bisa ditambahkan (${implausibleVariant(price.ramGb, price.storageGb) ?? "spesifikasi tidak terbaca"}); harganya dilewati.`,
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
        .is("deleted_at", null)
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

/**
 * Model yang dijual resmi tetapi belum dimuat GSMArena (mis. vivo Y31d Pro).
 * Dulu model ini ditolak diam-diam sehingga tidak pernah masuk katalog.
 * Kini dibuat baris spesifikasi minimal dari situs resmi: nama, varian yang
 * berharga, dan label 5G dari namanya. Produknya masuk sebagai draft
 * bersumber situs resmi, spesifikasi lain dilengkapi admin di halaman produk,
 * dan saat GSMArena memuat model ini, tarik berikutnya mengadopsi produk yang
 * sama (kunci placeholder, lihat placeholderSourceKey).
 */
async function officialOnlyResult(lineup: LineupItem, issues: PreviewIssue[]): Promise<ResolveResult> {
  const source = officialSourceFor(lineup.brand);
  const variants = [...new Map(
    lineup.prices
      .filter((price) => !implausibleVariant(price.ramGb, price.storageGb))
      .map((price) => [`${price.ramGb}+${price.storageGb}`, { ramGb: price.ramGb, storageGb: price.storageGb }])
  ).values()];
  const missing: ResolveResult = {
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
          message: "Tidak ditemukan di GSMArena, dan situs resmi tidak menyebut varian berharga, jadi produk ini belum bisa dibuat.",
        },
        ...issues,
      ],
    },
  };
  if (!source || !lineup.officialUrl || variants.length === 0) return missing;

  const row = Object.fromEntries(SPEC_COLUMNS.map((column) => [column, ""])) as SpecRow;
  // Nama merek katalog, mis. "vivo", "iQOO", "Apple" (bukan "Digimap").
  row.brand = SCRAPE_BRAND_LABELS[lineup.brand].split(" (")[0]!;
  row.model_name = lineup.officialName;
  row.device_type = "phone";
  row.network_technology = /\b5G\b/i.test(lineup.officialName) ? "5G" : "";
  row.memory_variants_summary = variants.map((v) => `${v.storageGb}GB/${v.ramGb}GB`).join("; ");
  row.specs_source = source.marketplace;
  row.specs_source_url = lineup.officialUrl;

  const outcome = mapRow(row);
  if (!outcome.ok) return missing;
  const candidate = outcome.candidate;
  const { data } = await getInsforgeAdminClient()
    .database.from("products")
    .select("slug, status")
    .eq("source_key", candidate.sourceKey)
    .is("deleted_at", null)
    .limit(1);
  const existing = (data ?? [])[0] as { slug: string; status: "draft" | "published" } | undefined;
  const variantKeys = new Set(variants.map((v) => `${v.ramGb}+${v.storageGb}`));

  return {
    ok: true,
    item: {
      lineup,
      gsmarena: null,
      alternatives: [],
      specRow: row,
      summary: {
        brand: candidate.brand,
        model: candidate.model,
        slug: existing?.slug ?? candidate.slug,
        releaseYear: null,
        network: row.network_technology,
        chipset: null,
        displayInches: null,
        batteryMah: null,
        variants: candidate.variants,
      },
      prices: lineup.prices.map((price) => ({ ...price, variantKnown: variantKeys.has(`${price.ramGb}+${price.storageGb}`) })),
      catalog: existing ? { status: existing.status, slug: existing.slug } : { status: "new", slug: null },
      issues: [
        {
          level: "warning",
          message: `Belum ada di GSMArena. Produk dibuat dari data ${source.marketplace} saja (nama dan varian berharga); chipset, layar, baterai, dan kamera dilengkapi di halaman produk sebelum diterbitkan.`,
        },
        ...issues,
      ],
    },
  };
}
