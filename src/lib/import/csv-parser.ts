/**
 * Parser CSV sesuai RFC 4180.
 *
 * Kenapa ditulis sendiri, bukan memasang pustaka?
 *
 * Karena yang dibutuhkan cuma satu hal: membaca berkas CSV yang dihasilkan
 * pipeline milik proyek ini. Aturannya sudah baku dan pendek, dan menulisnya
 * sendiri berarti perilakunya bisa diuji langsung terhadap baris-baris sulit
 * yang benar-benar muncul di data (koma di dalam tanda kutip, tanda kutip
 * ganda yang di-escape, baris baru di dalam sel). PRD §9 meminta tidak
 * menambah abstraksi tanpa kebutuhan nyata.
 *
 * Yang ditangani:
 * - Sel berkutip yang memuat koma, baris baru, dan kutip ganda ("" jadi ").
 * - Akhir baris CRLF maupun LF.
 * - Baris terakhir tanpa newline penutup.
 *
 * Yang TIDAK ditangani, dan itu disengaja: pemisah selain koma, komentar, dan
 * baris dengan jumlah kolom berbeda dari header. Ketiganya bukan CSV valid
 * untuk keperluan ini, jadi lebih baik gagal terang-terangan daripada menebak.
 */

export type CsvRow = Record<string, string>;

export type CsvParseResult = {
  headers: string[];
  rows: CsvRow[];
  /** Baris yang jumlah kolomnya tidak cocok header, beserta nomor barisnya. */
  malformed: { line: number; columns: number }[];
};

/** Memecah teks CSV menjadi larik sel per baris, menghormati tanda kutip. */
function splitCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  // Buang BOM kalau ada; kalau dibiarkan, nama kolom pertama akan tercemar.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  while (i < text.length) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        // Dua kutip berturut-turut berarti satu kutip literal.
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }

    if (char === "\r" || char === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      // CRLF dilewati sebagai satu pemisah, bukan dua baris kosong.
      i += char === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }

    cell += char;
    i += 1;
  }

  // Baris terakhir tanpa newline penutup tetap ikut.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

export function parseCsv(text: string): CsvParseResult {
  const cells = splitCells(text).filter(
    (row) => row.length > 1 || (row[0] ?? "").trim().length > 0
  );

  const headers = (cells[0] ?? []).map((h) => h.trim());
  const rows: CsvRow[] = [];
  const malformed: { line: number; columns: number }[] = [];

  for (let index = 1; index < cells.length; index += 1) {
    const values = cells[index]!;
    if (values.length !== headers.length) {
      // Dicatat, bukan ditebak. Baris yang kolomnya meleset hampir pasti
      // menandakan berkasnya rusak, dan menebak pemetaannya akan menghasilkan
      // data yang salah tanpa ada yang menyadari.
      malformed.push({ line: index + 1, columns: values.length });
      continue;
    }

    const row: CsvRow = {};
    headers.forEach((header, column) => {
      row[header] = values[column] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows, malformed };
}
