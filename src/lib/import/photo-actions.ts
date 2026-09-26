"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/dal";
import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { reprocessOutdatedPhotos } from "@/lib/import/product-images";
import type { PhotoReprocessReport } from "@/lib/import/report";

/** Satu klik memproses paling banyak sejumlah ini, agar request tidak timeout. */
const PHOTOS_PER_RUN = 40;
const PHOTO_CONCURRENCY = 3;

/**
 * Memproses ulang foto produk yang dibuat pipeline lama (mis. masih berlatar
 * putih) dari URL aslinya. Tidak mengubah foto yang sudah versi terbaru, jadi
 * aman diklik berulang sampai sisanya nol.
 */
export async function reprocessPhotosAction(): Promise<PhotoReprocessReport> {
  const admin = await requireAdmin();
  const result = await reprocessOutdatedPhotos(PHOTOS_PER_RUN, PHOTO_CONCURRENCY);
  if ("error" in result) return { error: result.error, summary: null };

  await recordAudit(admin, "foto.proses-ulang", "dataset", null, {
    diproses: result.processed,
    gagal: result.failed.length,
    sisa: result.remaining,
  });

  if (result.processed > 0) {
    invalidateCatalogCache();
    revalidatePath("/products");
    revalidatePath("/");
  }
  return { error: null, summary: result };
}
