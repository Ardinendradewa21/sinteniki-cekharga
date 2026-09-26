import "server-only";

import { parseCsv, type CsvParseResult } from "@/lib/import/csv-parser";
import { MAX_ROWS } from "@/lib/import/spec-runner";

/** Membaca berkas CSV dari form unggah dan menegakkan batas baris. */
export async function readCsvFile(
  formData: FormData
): Promise<{ ok: true; file: File; parsed: CsvParseResult } | { ok: false; error: string }> {
  const file = formData.get("berkas");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pilih berkas CSV lebih dulu." };
  }
  const parsed = parseCsv(await file.text());
  if (parsed.rows.length === 0) {
    return {
      ok: false,
      error:
        parsed.malformed.length > 0
          ? "Tidak ada baris yang bisa dibaca; jumlah kolomnya tidak cocok dengan header."
          : "Berkas tidak memuat baris data.",
    };
  }
  if (parsed.rows.length > MAX_ROWS) {
    return {
      ok: false,
      error: `Berkas memuat ${parsed.rows.length} baris, melebihi batas ${MAX_ROWS} sekali impor. Pecah berkasnya.`,
    };
  }
  return { ok: true, file, parsed };
}

/**
 * Waktu pengamatan default untuk baris tanpa kolom waktu: waktu terakhir
 * berkas diubah, asalkan tidak di masa depan; selain itu waktu unggah.
 */
export function defaultObservedAtFrom(formData: FormData, uploadedAt: Date): string {
  const submitted = String(formData.get("file_last_modified") ?? "").trim();
  const modified = new Date(submitted);
  return submitted.length > 0 &&
    Number.isFinite(modified.getTime()) &&
    modified.getTime() <= uploadedAt.getTime() + 5 * 60_000
    ? modified.toISOString()
    : uploadedAt.toISOString();
}
