"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { recordAudit } from "@/lib/admin/audit";
import { parseCsv } from "@/lib/import/csv-parser";
import { mapRow, type ImportCandidate } from "@/lib/import/gsmarena";
import { productSpecsSchema } from "@/lib/catalog/schema";
import type { ImportReport } from "@/lib/import/report";

/**
 * Impor dataset spesifikasi (PRD FR-07 dan §10).
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
const MAX_ROWS = 500;

async function upsertCandidate(
  candidate: ImportCandidate,
  retrievedAt: string
): Promise<"created" | "updated" | { failed: string }> {
  const db = getInsforgeAdminClient().database;

  // Spesifikasi tetap melewati gerbang Zod yang sama dengan sumber lain,
  // supaya berkas CSV yang aneh tidak bisa menyelundupkan bentuk data baru.
  const specs = productSpecsSchema.safeParse(candidate.specs);
  if (!specs.success) {
    return { failed: `Spesifikasi tidak lolos validasi: ${specs.error.issues[0]?.message}` };
  }

  const existingRes = await db
    .from("products")
    .select("id, status")
    .eq("source_key", candidate.sourceKey)
    .limit(1);
  const existing = (existingRes.data ?? [])[0] as { id: string } | undefined;

  const payload = {
    brand: candidate.brand,
    model: candidate.model,
    specs: specs.data,
    specs_source: "GSMArena",
    specs_source_url: candidate.specsSourceUrl,
    // Impor memang mengambil ulang data dari sumber, jadi di sinilah waktu
    // pengambilan yang benar untuk dimajukan.
    specs_retrieved_at: retrievedAt,
  };

  let productId: string;

  if (existing) {
    // `status` dan `slug` sengaja tidak ikut diperbarui. Slug yang berubah akan
    // memutus tautan yang sudah dibagikan orang.
    const { error } = await db.from("products").update(payload).eq("id", existing.id);
    if (error) return { failed: "Gagal memperbarui produk yang sudah ada." };
    productId = existing.id;
  } else {
    const { data, error } = await db
      .from("products")
      .insert([{ ...payload, slug: candidate.slug, source_key: candidate.sourceKey, status: "draft" }])
      .select();
    if (error) {
      const duplicateSlug = JSON.stringify(error).includes("23505");
      return {
        failed: duplicateSlug
          ? `Slug "${candidate.slug}" sudah dipakai produk lain dengan kunci sumber berbeda.`
          : "Gagal menyimpan produk baru.",
      };
    }
    const created = (data ?? [])[0] as { id: string } | undefined;
    if (!created) return { failed: "Produk tersimpan tetapi tidak bisa dibaca kembali." };
    productId = created.id;
  }

  // Varian ditambahkan bila belum ada. Varian yang sudah ada TIDAK dihapus,
  // karena penawaran dan riwayat harga menggantung padanya; menghapusnya demi
  // menyamakan dengan berkas akan menghanyutkan data yang dikumpulkan manual.
  const currentRes = await db
    .from("variants")
    .select("ram_gb, storage_gb")
    .eq("product_id", productId)
    .limit(200);
  const current = new Set(
    ((currentRes.data ?? []) as { ram_gb: number; storage_gb: number }[]).map(
      (v) => `${v.ram_gb}-${v.storage_gb}`
    )
  );

  const missing = candidate.variants.filter((v) => !current.has(`${v.ramGb}-${v.storageGb}`));
  if (missing.length > 0) {
    await db.from("variants").insert(
      missing.map((v) => ({
        product_id: productId,
        ram_gb: v.ramGb,
        storage_gb: v.storageGb,
        region: null,
      }))
    );
  }

  return existing ? "updated" : "created";
}

export async function importCsvAction(
  _prev: ImportReport,
  formData: FormData
): Promise<ImportReport> {
  const admin = await requireAdmin();

  const file = formData.get("berkas");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih berkas CSV lebih dulu.", summary: null };
  }

  const text = await file.text();
  const parsed = parseCsv(text);

  if (parsed.rows.length === 0) {
    return {
      error:
        parsed.malformed.length > 0
          ? "Tidak ada baris yang bisa dibaca; jumlah kolomnya tidak cocok dengan header."
          : "Berkas tidak memuat baris data.",
      summary: null,
    };
  }

  if (parsed.rows.length > MAX_ROWS) {
    return {
      error: `Berkas memuat ${parsed.rows.length} baris, melebihi batas ${MAX_ROWS} sekali impor. Pecah berkasnya.`,
      summary: null,
    };
  }

  const retrievedAt = new Date().toISOString();
  const skipped: { label: string; reason: string }[] = [];
  let created = 0;
  let updated = 0;

  for (const row of parsed.rows) {
    const outcome = mapRow(row);
    if (!outcome.ok) {
      skipped.push({ label: outcome.label, reason: outcome.reason });
      continue;
    }

    const result = await upsertCandidate(outcome.candidate, retrievedAt);
    if (typeof result === "object") {
      skipped.push({ label: outcome.candidate.slug, reason: result.failed });
      continue;
    }
    if (result === "created") created += 1;
    else updated += 1;
  }

  await recordAudit(admin, "impor.csv", "dataset", null, {
    berkas: file.name,
    baris: parsed.rows.length,
    baru: created,
    diperbarui: updated,
    dilewati: skipped.length,
  });

  revalidatePath("/admin/products");
  revalidatePath("/products");

  return {
    error: null,
    summary: {
      totalRows: parsed.rows.length,
      created,
      updated,
      skipped,
      malformedLines: parsed.malformed.map((m) => m.line),
    },
  };
}
