import "server-only";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";

/**
 * Pembacaan admin yang tidak pernah terpotong diam-diam.
 *
 * `.limit(n)` saja tidak cukup: PostgREST membatasi jumlah baris per respons
 * (`max-rows`) terlepas dari angka yang diminta, dan kelebihannya dibuang tanpa
 * error. Halaman admin lalu menampilkan jumlah penawaran atau varian yang salah
 * seolah-olah benar. Fungsi di sini memecah filter `.in()` per kelompok dan
 * membaca per halaman sampai habis.
 */

type Row = Record<string, unknown>;

/**
 * Anggaran panjang nilai `.in()` per permintaan, dalam karakter URL.
 *
 * Seluruh nilai `.in()` masuk ke URL, dan gateway InsForge (openresty)
 * membalas 502 Bad Gateway begitu URL terlalu panjang. Terukur 2026-09-22:
 * 80 UUID (≈3 KB) masih lolos, 100 UUID (≈3,8 KB) sudah 502. Kelompok dipecah
 * menurut PANJANG, bukan jumlah, karena nilai non-UUID (mis. `source_key`)
 * bisa jauh lebih panjang setelah di-URL-encode. 1.800 karakter menyisakan
 * ruang untuk nama kolom, filter lain, urutan, dan paginasi.
 */
const MAX_IN_URL_CHARS = 1800;
/** Batas jumlah tambahan supaya daftar nilai yang sangat pendek tetap wajar. */
const MAX_IN_VALUES = 80;
const PAGE_SIZE = 1000;

function chunkForUrl(values: readonly string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  let length = 0;

  for (const value of values) {
    // +3 untuk koma pemisah dan kemungkinan tanda kutip dari postgrest-js.
    const size = encodeURIComponent(value).length + 3;
    if (
      current.length > 0 &&
      (length + size > MAX_IN_URL_CHARS || current.length >= MAX_IN_VALUES)
    ) {
      groups.push(current);
      current = [];
      length = 0;
    }
    current.push(value);
    length += size;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Ringkasan error yang benar-benar terbaca di log. Objek error SDK tercetak
 * `{}` oleh console, sehingga penyebab seperti 502 dari gateway tersembunyi.
 */
function describeError(error: unknown): { message: string; status?: unknown; code?: unknown } {
  const record = (error ?? {}) as Record<string, unknown>;
  return {
    message: String(record.message ?? error).replace(/\s+/g, " ").slice(0, 200),
    status: record.status ?? record.statusCode,
    code: record.code,
  };
}

export type OrderBy = { column: string; ascending: boolean };

/**
 * Semua baris yang `column` bernilai salah satu `values`. Urutan selalu diakhiri
 * kolom unik (`id`, atau `uniqueKey` untuk tabel berkunci gabungan tanpa `id`)
 * supaya paginasi deterministik. Melempar error bila backend gagal.
 */
export async function selectWhereIn(
  table: string,
  columns: string,
  column: string,
  values: readonly string[],
  options: {
    /** Rentang inklusif pada kolom lain, mis. waktu pengamatan dalam berkas. */
    range?: { column: string; gte: string; lte: string };
    order?: OrderBy[];
    /**
     * Kolom yang bersama-sama unik, pengganti `id` untuk tabel berkunci
     * gabungan (mis. scrape_results, ad_stats_daily). Tanpa ini, query ke
     * tabel tanpa kolom `id` selalu gagal.
     */
    uniqueKey?: string[];
  } = {}
): Promise<Row[]> {
  const db = getInsforgeAdminClient().database;
  const order = [
    ...(options.order ?? []),
    ...(options.uniqueKey ?? ["id"]).map((column) => ({ column, ascending: true })),
  ];
  const rows: Row[] = [];

  for (const group of chunkForUrl([...new Set(values)])) {
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = db.from(table).select(columns).in(column, group);
      if (options.range) {
        query = query
          .gte(options.range.column, options.range.gte)
          .lte(options.range.column, options.range.lte);
      }
      for (const o of order) query = query.order(o.column, { ascending: o.ascending });

      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error(`[baca] gagal membaca "${table}":`, describeError(error));
        throw new Error(`Gagal membaca "${table}".`);
      }
      const page = (data ?? []) as unknown as Row[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

/** Semua baris satu tabel, tanpa batas diam-diam. */
export async function selectAll(table: string, columns: string): Promise<Row[]> {
  const db = getInsforgeAdminClient().database;
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(`[baca] gagal membaca "${table}":`, describeError(error));
      throw new Error(`Gagal membaca "${table}".`);
    }
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
