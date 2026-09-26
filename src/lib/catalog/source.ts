import "server-only";

import { cache } from "react";

import { getDataSourceMode, type DataSourceMode } from "@/lib/config";
import { loadCatalogFromBackend } from "@/lib/backend/catalog-repository";
import { buildDemoDataset } from "@/lib/catalog/demo-fixtures";
import { catalogDatasetSchema, type CatalogDataset } from "@/lib/catalog/schema";

/**
 * Kontrak adapter sumber katalog (PRD §9).
 *
 * Adapter dipisahkan dari model domain: halaman tidak pernah tahu datanya
 * datang dari fixture atau API. Yang berubah saat backend siap hanyalah
 * implementasi di bawah, bukan komponen UI.
 *
 * `import "server-only"` memastikan modul ini (termasuk seluruh dataset)
 * tidak pernah ikut ke bundle browser.
 */
export type CatalogSource = {
  readonly mode: DataSourceMode;
  loadDataset(now: Date): Promise<CatalogDataset>;
};

const demoSource: CatalogSource = {
  mode: "demo",
  async loadDataset(now) {
    // Fixture melewati gerbang validasi yang sama dengan sumber nyata, supaya
    // bentuk data yang salah ketahuan di sini, bukan di tengah render.
    return catalogDatasetSchema.parse(buildDemoDataset(now));
  },
};

/**
 * Satu request (mis. halaman detail: `generateMetadata` + halaman) cukup
 * memvalidasi dataset sekali. `cache()` React berlaku per request; cache
 * lintas request ada di `loadCatalogFromBackend`.
 */
const loadLiveDataset = cache(async (): Promise<CatalogDataset> => {
  const dataset = await loadCatalogFromBackend();
  return catalogDatasetSchema.parse(dataset);
});

const liveSource: CatalogSource = {
  mode: "live",
  loadDataset() {
    /*
     * Data nyata dari InsForge (PRD §11 Irisan B).
     *
     * Perhatikan bahwa hasilnya melewati gerbang validasi yang PERSIS SAMA
     * dengan fixture demo. Itu disengaja: kalau bentuk data dari database
     * menyimpang dari model domain, kesalahannya muncul di sini, bukan di
     * tengah render halaman sebagai nilai undefined yang membingungkan.
     *
     * Tidak ada blok try/catch yang mengembalikan fixture bila gagal. PRD §9:
     * "Produksi tidak boleh diam-diam fallback ke fixture saat API gagal."
     */
    return loadLiveDataset();
  },
};

export function getCatalogSource(): CatalogSource {
  return getDataSourceMode() === "live" ? liveSource : demoSource;
}

/** Apakah surface yang sedang dirender memakai data demo (untuk penanda UI). */
export function isDemoData(): boolean {
  return getCatalogSource().mode === "demo";
}
