import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import type { CsvRow } from "@/lib/import/csv-parser";
import { chunk, mapWithConcurrency } from "@/lib/import/batch";

/**
 * Baris mentah impor per baris (tabel `raw_listings`, migrasi
 * import-staging-and-bulk). Menggantikan kolom `import_batches.rows` untuk
 * batch baru, supaya worker cukup membaca baris potongan yang dikerjakan.
 *
 *   upload    = baris berkas apa adanya (templat terpadu, sebelum dikoreksi)
 *   row       = baris yang dipakai rencana dan penulisan (`row_indexes` item)
 *   follow_up = penawaran yang diterapkan setelah produk batch ini tersimpan
 *   follow_up_photo = foto CSV gabungan, menjadi batch galeri setelah tahap ini
 */
type RawRole = "upload" | "row" | "follow_up" | "follow_up_photo";

/** Baris per insert; satu baris CSV sekitar 0,2-1,6 KB JSON. */
const STAGE_CHUNK = 200;
/**
 * Kelompok insert yang dikirim bersamaan. Waktu simpan didominasi latensi
 * jaringan ke database (terukur 2026-10-11: 3 kelompok berurutan = 1,75 dtk
 * untuk 500 baris), jadi beberapa kelompok paralel memangkas request unggah.
 */
const STAGE_CONCURRENCY = 4;
/** Posisi per query `.in()`; angka pendek, jauh di bawah batas panjang URL. */
const POSITION_CHUNK = 200;
const PAGE_SIZE = 1000;

function db() {
  return getInsforgeAdminClient().database;
}

export async function stageRawRows(batchId: string, role: RawRole, rows: readonly CsvRow[]): Promise<void> {
  const records = rows.map((data, position) => ({ batch_id: batchId, role, position, data }));
  const results = await mapWithConcurrency(chunk(records, STAGE_CHUNK), STAGE_CONCURRENCY, async (group) => {
    // Upsert pada (batch_id, role, position): aman diulang bila langkah mati di tengah.
    const { error } = await db().from("raw_listings").upsert(group, { onConflict: "batch_id,role,position" });
    if (error) console.error("[impor] baris mentah gagal disimpan:", error);
    return !error;
  });
  if (results.some((ok) => !ok)) throw new Error("Baris berkas gagal disimpan.");
}

/** Baris mentah satu peran; tanpa `positions` dibaca semuanya, berurutan. */
export async function loadRawRows(
  batchId: string,
  role: RawRole,
  positions?: readonly number[]
): Promise<Map<number, CsvRow>> {
  const rows = new Map<number, CsvRow>();
  const collect = (data: unknown) => {
    for (const row of (data ?? []) as { position: number; data: CsvRow }[]) rows.set(row.position, row.data);
  };

  if (positions) {
    for (const group of chunk([...new Set(positions)], POSITION_CHUNK)) {
      const { data, error } = await db()
        .from("raw_listings")
        .select("position, data")
        .eq("batch_id", batchId)
        .eq("role", role)
        .in("position", group);
      if (error) throw new Error("Baris berkas gagal dibaca.");
      collect(data);
    }
    return rows;
  }

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db()
      .from("raw_listings")
      .select("position, data")
      .eq("batch_id", batchId)
      .eq("role", role)
      .order("position", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("Baris berkas gagal dibaca.");
    collect(data);
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
}

/** Seluruh baris satu peran sebagai larik berurutan posisi. */
export async function loadRawRowList(batchId: string, role: RawRole): Promise<CsvRow[]> {
  return [...(await loadRawRows(batchId, role)).entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
}

export async function clearRawRows(batchId: string, role: RawRole): Promise<void> {
  const { error } = await db().from("raw_listings").delete().eq("batch_id", batchId).eq("role", role);
  if (error) throw new Error("Baris berkas lama gagal dibersihkan.");
}

/** Retensi (aturan system design 8): baris mentah batch selesai dihapus permanen. */
export async function purgeRawListings(keepDays = 30): Promise<number> {
  const { data, error } = await db().rpc("import_purge_raw_listings", { p_keep_days: keepDays });
  if (error) throw new Error("Baris mentah lama gagal dihapus.");
  return Number(data ?? 0);
}
