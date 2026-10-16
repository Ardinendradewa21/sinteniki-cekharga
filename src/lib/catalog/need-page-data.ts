import "server-only";

import { needPageQualifies, NEED_PAGES, type NeedPage } from "@/lib/catalog/need-pages";
import { searchCatalog, type CatalogSearchResult } from "@/lib/catalog/queries";
import { parseCatalogQuery, PARAM } from "@/lib/catalog/search-params";

/**
 * Data halaman kebutuhan (PB-29): pencarian katalog biasa, diurutkan dari
 * harga terendah. Dipakai halaman, indeks /hp, dan sitemap, supaya ketiganya
 * selalu sepakat halaman mana yang layak terbit.
 */

export function needPageQuery(page: NeedPage) {
  return parseCatalogQuery({ [PARAM.query]: page.query, [PARAM.sort]: "price-asc" });
}

export async function loadNeedPage(
  page: NeedPage,
  now: Date
): Promise<{ result: CatalogSearchResult; qualifies: boolean }> {
  const result = await searchCatalog(now, needPageQuery(page));
  return { result, qualifies: needPageQualifies(result.matched) };
}

/** Halaman kebutuhan yang saat ini layak terbit, beserta jumlah produknya. */
export async function qualifyingNeedPages(now: Date): Promise<{ page: NeedPage; matched: number }[]> {
  const loaded = await Promise.all(NEED_PAGES.map(async (page) => ({ page, ...(await loadNeedPage(page, now)) })));
  return loaded.filter((entry) => entry.qualifies).map((entry) => ({ page: entry.page, matched: entry.result.matched }));
}
