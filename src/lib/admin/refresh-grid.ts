import type { RefreshRun, RefreshRunStatus } from "@/lib/import/price-refresh-rules";

/**
 * Data grid "Pemeriksaan harga harian per merek" di dasbor admin (CD-03, pola
 * tile harian Veyla). Modul murni.
 *
 * Pertanyaan yang dijawab: merek mana yang pemeriksaan harganya gagal atau
 * tidak berjalan, di hari apa (WIB). Satu sel = satu merek di satu tanggal.
 */
export type RefreshCell = "berhasil" | "tanpa-penawaran" | "gagal" | null;

export type RefreshGrid = {
  /** Tanggal WIB "YYYY-MM-DD", lama ke baru. */
  dates: string[];
  rows: { brand: string; cells: RefreshCell[] }[];
  /** Jumlah merek gagal per tanggal (urutan sama dengan `dates`). */
  failuresPerDay: number[];
};

const CATEGORY: Record<RefreshRunStatus, Exclude<RefreshCell, null>> = {
  queued: "berhasil",
  "nothing-to-update": "berhasil",
  "no-offers": "tanpa-penawaran",
  "source-error": "gagal",
  blocked: "gagal",
  error: "gagal",
};

/** Tanggal WIB (UTC+7) untuk `now`. */
export function wibDate(now: Date): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export function buildRefreshGrid(runs: readonly RefreshRun[], now: Date, days = 14): RefreshGrid {
  const today = wibDate(now);
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (days - 1 - index));
    return date.toISOString().slice(0, 10);
  });
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const brands = [...new Set(runs.map((run) => run.brand))].sort((a, b) => a.localeCompare(b, "id"));
  const rows = brands.map((brand) => ({ brand, cells: dates.map((): RefreshCell => null) }));
  const rowIndex = new Map(brands.map((brand, index) => [brand, index]));

  for (const run of runs) {
    const column = dateIndex.get(run.runDate);
    const row = rowIndex.get(run.brand);
    if (column === undefined || row === undefined) continue;
    const next = CATEGORY[run.status];
    const current = rows[row]!.cells[column];
    // Bila satu hari punya beberapa catatan, kegagalan tidak boleh tertutup
    // oleh catatan berhasil (yang buruk diutamakan agar terlihat).
    if (current === "gagal" || (current === "tanpa-penawaran" && next === "berhasil")) continue;
    rows[row]!.cells[column] = next;
  }

  const failuresPerDay = dates.map((_, column) => rows.filter((row) => row.cells[column] === "gagal").length);
  return { dates, rows, failuresPerDay };
}
