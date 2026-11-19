/**
 * Format kartu ulasan "mudah dicerna" (RV-02, keputusan PO 19 Nov 2026).
 * Modul murni: dipakai formulir admin (klien), aksi server, dan kartu publik.
 *
 * Bentuknya mengikuti temuan riset keterbacaan layar (pembaca memindai pola F,
 * membaca awal baris dan jarang sampai akhir paragraf panjang):
 *
 * - "Intinya": satu kalimat kesimpulan reviewer di paling atas (piramida terbalik).
 * - "Cocok untuk" / "Kurang cocok untuk": maks 3 label pendek, untuk memindai cepat.
 * - Kelebihan dan kekurangan: maks 4 poin pendek, kata kunci di depan
 *   ("Baterai: tahan 19 jam di PCMark"), masing-masing bisa membawa menit video.
 * - Ringkasan lengkap tetap ada tetapi dilipat (progressive disclosure).
 *
 * Di formulir admin, menit per poin ditulis di akhir baris dalam kurung siku:
 * "Baterai: tahan 19 jam di PCMark [4:12]". Satu kotak teks, tanpa kolom tambahan.
 */

export const REVIEW_FORMAT_LIMITS = {
  verdict: 200,
  label: 40,
  labelMax: 3,
  point: 140,
  pointMax: 4,
  /** Panduan panjang poin; lebih dari ini hanya diperingatkan, bukan ditolak. */
  pointWords: 14,
} as const;

/** "4:35" = menit:detik, "1:04:35" = jam:menit:detik, angka saja = detik. null bila tidak terbaca. */
export function parseClock(value: string): number | null {
  const match = value.trim().match(/^(?:(\d{1,2}):)?(\d{1,3})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, first, second, third] = match;
  if (first !== undefined && third !== undefined) return Number(first) * 3600 + Number(second) * 60 + Number(third);
  if (first !== undefined) return Number(first) * 60 + Number(second);
  return Number(second);
}

export function formatClock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

const TRAILING_CLOCK = /\s*[[(]\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[\])]\s*$/;

export type ReviewPoint = { text: string; seconds: number | null };

/** Satu baris formulir: penanda daftar di depan dibuang, "[m:ss]" di akhir menjadi detik. */
export function parsePointLine(line: string): ReviewPoint {
  const cleaned = line.replace(/^\s*(?:[-•*▶]|\d+[.)])\s*/, "").trim();
  const clock = TRAILING_CLOCK.exec(cleaned);
  if (!clock) return { text: cleaned, seconds: null };
  const seconds = parseClock(clock[1]!);
  return { text: cleaned.slice(0, clock.index).trim(), seconds: seconds && seconds > 0 ? seconds : null };
}

export function parsePointLines(value: string, max: number = REVIEW_FORMAT_LIMITS.pointMax): ReviewPoint[] {
  return value
    .split(/\r?\n/)
    .map(parsePointLine)
    .filter((point) => point.text.length > 0)
    .slice(0, max);
}

export function pointToLine(point: ReviewPoint): string {
  return point.seconds ? `${point.text} [${formatClock(point.seconds)}]` : point.text;
}

/** Label "Cocok untuk": satu per baris atau dipisah koma, maks 3. */
export function parseLabels(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((label) => label.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, REVIEW_FORMAT_LIMITS.labelMax);
}

/**
 * "Baterai: tahan 19 jam" -> kata kunci "Baterai" ditebalkan di kartu. Hanya
 * bila bagian sebelum titik dua pendek (maks 4 kata), supaya kalimat biasa
 * yang kebetulan memuat titik dua tidak ikut terbelah.
 */
export function splitKeyword(text: string): { keyword: string | null; rest: string } {
  const index = text.indexOf(":");
  if (index <= 0 || index > 40) return { keyword: null, rest: text };
  const keyword = text.slice(0, index).trim();
  const rest = text.slice(index + 1).trim();
  if (!rest || keyword.split(/\s+/).length > 4 || /\d:\d/.test(text.slice(index - 1, index + 2))) {
    return { keyword: null, rest: text };
  }
  return { keyword, rest };
}

/** Detik per poin sejajar dengan teks poin; kosong bila tidak ada satu pun menit. */
export function pointSeconds(points: readonly ReviewPoint[]): (number | null)[] {
  return points.some((point) => point.seconds !== null) ? points.map((point) => point.seconds) : [];
}

/** Gabungkan kolom database (teks + detik sejajar) menjadi poin. */
export function zipPoints(texts: readonly string[], seconds: readonly (number | null)[] | null | undefined): ReviewPoint[] {
  return texts.map((text, index) => ({ text, seconds: seconds?.[index] ?? null }));
}
