"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/dal";
import { applyBatch, createBatch, discardBatch } from "@/lib/import/batches";
import { readImageRights } from "@/lib/import/image-rights";
import { defaultObservedAtFrom, readCsvFile } from "@/lib/import/upload";

/**
 * Aksi Pusat Impor: unggah → pratinjau → terapkan / batalkan.
 *
 * Setiap aksi memanggil requireAdmin() lebih dulu; aksi server adalah endpoint
 * POST yang bisa dipanggil tanpa melewati antarmuka.
 */

export type PreviewState = { error: string | null };

async function preview(kind: "specs" | "offers", formData: FormData): Promise<PreviewState> {
  const admin = await requireAdmin();
  const read = await readCsvFile(formData);
  if (!read.ok) return { error: read.error };

  const rights = readImageRights(formData.get("image_usage_basis"), formData.get("image_usage_rights"));
  if (!rights.ok) return { error: rights.error };

  const created = await createBatch({
    kind,
    origin: "csv",
    sourceLabel: read.file.name,
    options:
      kind === "specs"
        ? { imageRights: rights.rights }
        : {
            imageRights: rights.rights,
            defaultObservedAt: defaultObservedAtFrom(formData, new Date()),
            defaultSellerName: String(formData.get("seller_name") ?? "").trim().slice(0, 160),
          },
    rows: read.parsed.rows,
    malformedLines: read.parsed.malformed.map((m) => m.line),
    admin,
  });
  if (!created.ok) return { error: created.error };

  revalidatePath("/admin/import");
  redirect(`/admin/import/batch/${created.id}`);
}

export async function previewSpecsAction(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  return preview("specs", formData);
}

export async function previewOffersAction(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  return preview("offers", formData);
}

export async function applyBatchAction(
  batchId: string,
  _prev: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const admin = await requireAdmin();
  const itemIds = formData.getAll("item").map(String).filter(Boolean);
  if (itemIds.length === 0) return { error: "Pilih minimal satu baris untuk diterapkan." };

  const result = await applyBatch(batchId, itemIds, admin);
  revalidatePath("/admin/import");
  revalidatePath(`/admin/import/batch/${batchId}`);
  if (!result.ok) return { error: result.error };

  // Harga resmi tarik otomatis lanjut ke pratinjau batch harganya.
  redirect(
    result.followUpBatchId
      ? `/admin/import/batch/${result.followUpBatchId}`
      : `/admin/import/batch/${batchId}`
  );
}

export async function discardBatchAction(batchId: string): Promise<void> {
  const admin = await requireAdmin();
  await discardBatch(batchId, admin);
  revalidatePath("/admin/import");
  redirect("/admin/import");
}
