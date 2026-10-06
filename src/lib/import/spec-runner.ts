import "server-only";

import { revalidatePath } from "next/cache";

import type { AdminSession } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { invalidateCatalogCache } from "@/lib/backend/catalog-repository";
import { recordAudit } from "@/lib/admin/audit";
import type { CsvRow } from "@/lib/import/csv-parser";
import { mapRow, type ImportCandidate } from "@/lib/import/gsmarena";
import { productSpecsSchema, type ProductSpecs } from "@/lib/catalog/schema";
import {
  chunk,
  INSERT_CHUNK,
  isUniqueViolation,
  mapWithConcurrency,
  selectWhereIn,
} from "@/lib/import/batch";
import type { ImageRights } from "@/lib/import/image-rights";
import type { ProductImageCandidate } from "@/lib/import/product-images";
import { enqueuePhotoJobs } from "@/lib/import/photo-jobs";
import type { ImportReport, RowResult } from "@/lib/import/report";

/**
 * Impor dataset spesifikasi (PRD FR-07 dan §10), terpisah dari server action.
 *
 * Modul biasa, bukan "use server": fungsi di sini TIDAK boleh bisa dipanggil
 * langsung dari browser. Pemanggilnya (aksi unggah CSV, penerapan batch
 * pratinjau, tarik otomatis) wajib sudah menjalankan requireStaff([]).
 *
 * Empat jaminan yang dipegang, dan semuanya berasal dari PRD:
 *
 * 1. Hasil impor SELALU berstatus draft. "Data impor tidak langsung
 *    dipublikasikan tanpa validasi" (FR-07). Admin yang memutuskan terbit.
 *
 * 2. Impor ulang memakai `source_key` yang stabil, jadi menjalankan berkas yang
 *    sama dua kali memperbarui produk yang ada, bukan membuat kembarannya
 *    (§10).
 *
 * 3. Baris yang gagal tidak menjatuhkan baris yang berhasil. §10 meminta
 *    kegagalan job disimpan tanpa merusak data valid sebelumnya, jadi tiap
 *    baris berdiri sendiri dan alasan kegagalannya dilaporkan.
 *
 * 4. Produk yang SUDAH TERBIT tidak diturunkan diam-diam menjadi draft saat
 *    diimpor ulang. Statusnya dibiarkan apa adanya; impor memperbarui data,
 *    bukan mencabut keputusan penerbitan yang sudah diambil manusia.
 */

/** Batas aman: satu berkas sekali jalan, bukan seluruh dump GSMArena. */
export const MAX_ROWS = 500;
/** Pembaruan baris yang sudah ada berjalan paralel, dibatasi supaya sopan ke backend. */
const UPDATE_CONCURRENCY = 6;

type ImageImportJob = {
  productId: string;
  sourceKey: string;
  label: string;
  candidate: ProductImageCandidate;
};

type SaveResult =
  | { outcome: "created" | "updated"; productId: string }
  | { failed: string };

export type ValidCandidate = {
  candidate: ImportCandidate;
  specs: ProductSpecs;
  /** Posisi baris di berkas (0-based), untuk batch pratinjau. */
  rowIndex: number;
};

/** Jejak asal tulisan impor: batch dan jenis sumbernya (Fase 4). */
export type Lineage = { batchId: string | null; source: "import" | "scrape" };

function productPayload({ candidate, specs }: ValidCandidate, retrievedAt: string, lineage: Lineage) {
  return {
    updated_by_batch_id: lineage.batchId,
    last_source: lineage.source,
    brand: candidate.brand,
    model: candidate.model,
    specs,
    specs_source: "GSMArena",
    specs_source_url: candidate.specsSourceUrl,
    // Impor memang mengambil ulang data dari sumber, jadi di sinilah waktu
    // pengambilan yang benar untuk dimajukan.
    specs_retrieved_at: retrievedAt,
  };
}

function newProductRow(valid: ValidCandidate, retrievedAt: string, lineage: Lineage) {
  return {
    ...productPayload(valid, retrievedAt, lineage),
    created_by_batch_id: lineage.batchId,
    slug: valid.candidate.slug,
    source_key: valid.candidate.sourceKey,
    status: "draft",
  };
}

/** Jalur satu per satu, dipakai hanya bila insert massal gagal, untuk menemukan baris penyebabnya. */
async function insertProductSingly(
  valid: ValidCandidate,
  retrievedAt: string,
  lineage: Lineage
): Promise<SaveResult> {
  const { data, error } = await getInsforgeAdminClient()
    .database.from("products")
    .insert([newProductRow(valid, retrievedAt, lineage)])
    .select("id");
  if (error) {
    return {
      failed: isUniqueViolation(error)
        ? `Slug "${valid.candidate.slug}" sudah dipakai produk lain dengan kunci sumber berbeda.`
        : "Gagal menyimpan produk baru.",
    };
  }
  const created = (data ?? [])[0] as { id: string } | undefined;
  return created
    ? { outcome: "created", productId: created.id }
    : { failed: "Produk tersimpan tetapi tidak bisa dibaca kembali." };
}

/**
 * Menyimpan produk dan varian untuk seluruh kandidat valid sekaligus.
 * Mengembalikan hasil per `sourceKey`.
 */
async function saveCandidates(
  candidates: readonly ValidCandidate[],
  retrievedAt: string,
  lineage: Lineage
): Promise<Map<string, SaveResult>> {
  const db = getInsforgeAdminClient().database;
  const results = new Map<string, SaveResult>();

  const existingRows = await selectWhereIn(
    "products",
    "id, source_key",
    "source_key",
    candidates.map((c) => c.candidate.sourceKey)
  );
  const existingByKey = new Map(
    existingRows.map((row) => [String(row.source_key), String(row.id)])
  );

  const toUpdate = candidates.filter((c) => existingByKey.has(c.candidate.sourceKey));
  const toInsert = candidates.filter((c) => !existingByKey.has(c.candidate.sourceKey));

  // `status` dan `slug` sengaja tidak ikut diperbarui. Slug yang berubah akan
  // memutus tautan yang sudah dibagikan orang, dan status terbit adalah
  // keputusan manusia yang tidak boleh dicabut impor.
  await mapWithConcurrency(toUpdate, UPDATE_CONCURRENCY, async (valid) => {
    const productId = existingByKey.get(valid.candidate.sourceKey)!;
    const { error } = await db
      .from("products")
      .update(productPayload(valid, retrievedAt, lineage))
      .eq("id", productId);
    results.set(
      valid.candidate.sourceKey,
      error
        ? { failed: "Gagal memperbarui produk yang sudah ada." }
        : { outcome: "updated", productId }
    );
  });

  for (const group of chunk(toInsert, INSERT_CHUNK)) {
    const { data, error } = await db
      .from("products")
      .insert(group.map((valid) => newProductRow(valid, retrievedAt, lineage)))
      .select("id, source_key");

    if (error) {
      // Satu baris bermasalah (mis. slug bentrok) menggagalkan seluruh
      // kelompok. Ulangi satu per satu supaya baris yang sah tetap tersimpan
      // dan alasan kegagalannya menempel ke baris yang benar.
      const singles = await mapWithConcurrency(group, UPDATE_CONCURRENCY, (valid) =>
        insertProductSingly(valid, retrievedAt, lineage)
      );
      group.forEach((valid, i) => results.set(valid.candidate.sourceKey, singles[i]));
      continue;
    }

    const idByKey = new Map(
      ((data ?? []) as { id: string; source_key: string }[]).map((row) => [
        row.source_key,
        row.id,
      ])
    );
    for (const valid of group) {
      const productId = idByKey.get(valid.candidate.sourceKey);
      results.set(
        valid.candidate.sourceKey,
        productId
          ? { outcome: "created", productId }
          : { failed: "Produk tersimpan tetapi tidak bisa dibaca kembali." }
      );
    }
  }

  // Varian ditambahkan bila belum ada. Varian yang sudah ada TIDAK dihapus,
  // karena penawaran dan riwayat harga menggantung padanya; menghapusnya demi
  // menyamakan dengan berkas akan menghanyutkan data yang dikumpulkan manual.
  const saved = candidates.flatMap((valid) => {
    const result = results.get(valid.candidate.sourceKey);
    return result && "productId" in result ? [{ valid, productId: result.productId }] : [];
  });
  let currentVariants: Awaited<ReturnType<typeof selectWhereIn>>;
  try {
    currentVariants = await selectWhereIn(
      "variants",
      "id, product_id, ram_gb, storage_gb",
      "product_id",
      saved.map((s) => s.productId)
    );
  } catch {
    // Produk sudah tertulis di titik ini, jadi yang gagal hanya variannya.
    for (const { valid } of saved) {
      results.set(valid.candidate.sourceKey, {
        failed: "Produk tersimpan tetapi variannya gagal diperiksa. Impor ulang berkas ini.",
      });
    }
    return results;
  }
  const current = new Set(
    currentVariants.map((v) => `${v.product_id}|${v.ram_gb}|${v.storage_gb}`)
  );

  const missing = saved.flatMap(({ valid, productId }) =>
    [
      ...new Map(
        valid.candidate.variants.map((v) => [`${v.ramGb}|${v.storageGb}`, v])
      ).values(),
    ]
      .filter((v) => !current.has(`${productId}|${v.ramGb}|${v.storageGb}`))
      .map((v) => ({
        sourceKey: valid.candidate.sourceKey,
        row: { product_id: productId, ram_gb: v.ramGb, storage_gb: v.storageGb, region: null },
      }))
  );

  for (const group of chunk(missing, INSERT_CHUNK)) {
    const { error } = await db.from("variants").insert(group.map((m) => m.row));
    if (error) {
      console.error("[impor] varian gagal ditambahkan:", error);
      // Produknya tetap tersimpan; kegagalan varian dilaporkan, bukan disembunyikan.
      for (const sourceKey of new Set(group.map((m) => m.sourceKey))) {
        results.set(sourceKey, {
          failed: "Produk tersimpan tetapi variannya gagal ditambahkan. Impor ulang berkas ini.",
        });
      }
    }
  }

  return results;
}


export type SpecPreparation = {
  /** Kandidat valid per `sourceKey`; baris ganda: yang terakhir menang. */
  validByKey: Map<string, ValidCandidate>;
  skipped: { label: string; reason: string; rowIndex: number }[];
};

/** Tahap tanpa jaringan: petakan dan validasi seluruh baris. Dipakai pratinjau dan penulisan. */
export function prepareSpecRows(rows: readonly CsvRow[]): SpecPreparation {
  const skipped: SpecPreparation["skipped"] = [];
  // Tahap 1, tanpa jaringan: petakan dan validasi seluruh baris dulu.
  const validByKey = new Map<string, ValidCandidate>();
  for (const [rowIndex, row] of rows.entries()) {
    const outcome = mapRow(row);
    if (!outcome.ok) {
      skipped.push({ label: outcome.label, reason: outcome.reason, rowIndex });
      continue;
    }

    // Spesifikasi tetap melewati gerbang Zod yang sama dengan sumber lain,
    // supaya berkas CSV yang aneh tidak bisa menyelundupkan bentuk data baru.
    const specs = productSpecsSchema.safeParse(outcome.candidate.specs);
    if (!specs.success) {
      skipped.push({
        label: outcome.candidate.slug,
        reason: `Spesifikasi tidak lolos validasi: ${specs.error.issues[0]?.message}`,
        rowIndex,
      });
      continue;
    }

    const previous = validByKey.get(outcome.candidate.sourceKey);
    if (previous) {
      // Dua baris untuk produk yang sama: yang terakhir menang, sama seperti
      // hasil akhir impor berurutan dulu, tetapi kini dilaporkan terbuka.
      skipped.push({
        label: previous.candidate.slug,
        reason: "Baris ganda untuk produk yang sama; yang dipakai baris terakhir di berkas.",
        rowIndex: previous.rowIndex,
      });
    }
    validByKey.set(outcome.candidate.sourceKey, {
      candidate: outcome.candidate,
      specs: specs.data,
      rowIndex,
    });
  }

  return { validByKey, skipped };
}

export async function runSpecImport({
  rows,
  fileName,
  defaultImageRights,
  admin,
  malformedLines = [],
  quiet = false,
  batchId = null,
  source = "import",
}: {
  rows: readonly CsvRow[];
  fileName: string;
  defaultImageRights: ImageRights | null;
  /** Jenis sumber untuk jejak asal: CSV atau tarik otomatis. */
  source?: Lineage["source"];
  admin: AdminSession;
  malformedLines?: number[];
  /** Batch asal, dicatat di antrean foto supaya progres fotonya bisa dipantau. */
  batchId?: string | null;
  /**
   * true = satu potongan dari penerapan bertahap: audit dan revalidasi
   * dilakukan sekali oleh worker di akhir, bukan per potongan.
   */
  quiet?: boolean;
}): Promise<ImportReport & { rowResults: RowResult[] }> {
  const retrievedAt = new Date().toISOString();
  const prepared = prepareSpecRows(rows);
  const { validByKey } = prepared;
  const skipped: { label: string; reason: string }[] = prepared.skipped.map(({ label, reason }) => ({ label, reason }));
  const imageSkipped: { label: string; reason: string }[] = [];
  const imageSkipKeys = new Set<string>();
  const handledImageProducts = new Set<string>();
  const imageJobs: ImageImportJob[] = [];
  let created = 0;
  let updated = 0;
  const rowResults: RowResult[] = prepared.skipped.map(({ rowIndex, reason }) => ({
    rowIndex,
    outcome: "skipped",
    entityId: null,
    message: reason,
  }));

  // Tahap 2: tulis massal.
  let saveResults: Map<string, SaveResult>;
  try {
    saveResults = await saveCandidates([...validByKey.values()], retrievedAt, { batchId, source });
  } catch {
    return {
      error: "Data katalog yang ada gagal dibaca, jadi impor dibatalkan sebelum menulis apa pun.",
      summary: null,
      rowResults: [],
    };
  }

  for (const { candidate, rowIndex } of validByKey.values()) {
    const outcome = { candidate };
    const result = saveResults.get(candidate.sourceKey) ?? {
      failed: "Produk tidak diproses.",
    };
    if ("failed" in result) {
      skipped.push({ label: outcome.candidate.slug, reason: result.failed });
      rowResults.push({ rowIndex, outcome: "failed", entityId: null, message: result.failed });
      continue;
    }
    if (result.outcome === "created") created += 1;
    else updated += 1;
    rowResults.push({ rowIndex, outcome: result.outcome, entityId: result.productId, message: null });

    const imageLabel = `${outcome.candidate.brand} ${outcome.candidate.model}`;
    if (outcome.candidate.imageIssue) {
      const key = `${outcome.candidate.sourceKey}|${outcome.candidate.imageIssue}`;
      if (!imageSkipKeys.has(key)) {
        imageSkipKeys.add(key);
        imageSkipped.push({ label: imageLabel, reason: outcome.candidate.imageIssue });
      }
    }

    if (
      outcome.candidate.image &&
      !handledImageProducts.has(result.productId)
    ) {
      handledImageProducts.add(result.productId);
      imageJobs.push({
        productId: result.productId,
        sourceKey: outcome.candidate.sourceKey,
        label: imageLabel,
        candidate: outcome.candidate.image,
      });
    }
  }

  // Foto tidak diproses di sini: diantrekan ke photo_jobs dan dikerjakan
  // worker foto terpisah, supaya satu foto lambat tidak menahan penerapan.
  const photoJobs = imageJobs.flatMap((job) => {
    const rights = job.candidate.rights ?? defaultImageRights;
    if (!rights) {
      imageSkipped.push({
        label: job.label,
        reason: "Dasar hak pakai foto belum dipilih; spesifikasi tetap diimpor tetapi gambarnya dilewati.",
      });
      return [];
    }
    return [
      {
        productId: job.productId,
        kind: "primary" as const,
        imageUrl: job.candidate.imageUrl,
        source: job.candidate.source,
        sourceUrl: job.candidate.sourceUrl,
        alt: job.candidate.alt,
        rights,
        batchId,
      },
    ];
  });
  const queuedPhotos = await enqueuePhotoJobs(photoJobs);
  if (queuedPhotos.failed > 0) {
    imageSkipped.push({ label: `${queuedPhotos.failed} foto`, reason: "Gagal masuk antrean foto." });
  }

  if (!quiet) await recordAudit(admin, "impor.csv", "dataset", null, {
    berkas: fileName,
    baris: rows.length,
    baru: created,
    diperbarui: updated,
    gambar_diantrekan: queuedPhotos.queued,
    gambar_dilewati: imageSkipped.length,
    gambar_format: "webp",
    gambar_maksimum_px: 1_200,
    dilewati: skipped.length,
  });

  if (!quiet) {
    invalidateCatalogCache();
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    revalidatePath("/products");
    revalidatePath("/");
  }

  return {
    error: null,
    rowResults,
    summary: {
      totalRows: rows.length,
      created,
      updated,
      imagesCreated: 0,
      imagesUpdated: 0,
      imagesUnchanged: 0,
      imagesQueued: queuedPhotos.queued,
      imageSkipped,
      skipped,
      malformedLines: malformedLines,
    },
  };
}
