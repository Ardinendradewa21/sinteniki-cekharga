import { createHash } from "node:crypto";

/**
 * Aturan rangkuman AI ulasan reviewer di halaman perbandingan (PB-40).
 * Murni, supaya bisa diuji tanpa model.
 *
 * - Sumbernya hanya ringkasan yang ditulis dan diterbitkan admin. Model tidak
 *   pernah melihat video atau transkrip.
 * - Kunci cache adalah hash isi ringkasan. Bila admin mengubah atau menambah
 *   ringkasan, kuncinya berubah dan rangkuman lama otomatis tidak terpakai.
 * - Keluaran yang memuat penilaian (terbaik, pemenang, skor) ditolak (PRD §3,
 *   FR-04), bukan disunting diam-diam.
 */

export type DigestNote = {
  channelName: string;
  aspect: "umum" | "kamera";
  summary: string;
  strengths: string[];
  limitations: string[];
  isSponsored: boolean;
};

export type DigestProduct = { slug: string; name: string; notes: DigestNote[] };

export type ReviewDigest = {
  /** Rangkuman ulasan keseluruhan, 2-5 kalimat. */
  overall: string;
  /** Rangkuman ulasan kamera; kosong bila tidak ada ulasan kamera. */
  camera: string;
};

/** Ringkasan minimal agar rangkuman layak dibuat: perbandingan butuh bahan. */
export const MIN_NOTES_FOR_DIGEST = 2;

export function digestCacheKey(products: readonly DigestProduct[]): string {
  const canonical = products.map((product) => ({
    slug: product.slug,
    notes: product.notes
      .map((note) => [note.channelName, note.aspect, note.summary, note.strengths, note.limitations, note.isSponsored])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function countNotes(products: readonly DigestProduct[]): number {
  return products.reduce((sum, product) => sum + product.notes.length, 0);
}

/** Fakta untuk model: satu blok per produk, setiap poin membawa channel-nya. */
export function digestFacts(products: readonly DigestProduct[]): string {
  return products
    .map((product) => {
      if (product.notes.length === 0) return `## ${product.name}\n(belum ada ringkasan reviewer)`;
      const lines = product.notes.map((note) => {
        const parts = [
          `- [${note.aspect === "kamera" ? "kamera" : "umum"}] ${note.channelName}${note.isSponsored ? " (video bersponsor)" : ""}: ${note.summary}`,
        ];
        if (note.strengths.length) parts.push(`  kelebihan: ${note.strengths.join("; ")}`);
        if (note.limitations.length) parts.push(`  kekurangan: ${note.limitations.join("; ")}`);
        return parts.join("\n");
      });
      return `## ${product.name}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

const JUDGEMENT = /\b(terbaik|termurah|terbagus|pemenang|menang telak|juara|paling (bagus|worth|layak|unggul)|nomor satu|skor|rating)\b|\d+(?:[.,]\d+)?\s*\/\s*10\b/i;
const MAX_CHARS = 900;

/** Keluaran model yang lolos, atau null bila harus ditolak. */
export function validateDigest(raw: unknown, products: readonly DigestProduct[]): ReviewDigest | null {
  if (!raw || typeof raw !== "object") return null;
  const { overall, camera } = raw as Record<string, unknown>;
  if (typeof overall !== "string" || typeof camera !== "string") return null;
  const cleanOverall = overall.trim();
  const cleanCamera = camera.trim();
  if (cleanOverall.length < 40 || cleanOverall.length > MAX_CHARS || cleanCamera.length > MAX_CHARS) return null;
  if (JUDGEMENT.test(cleanOverall) || JUDGEMENT.test(cleanCamera)) return null;
  // Rangkuman kamera tanpa satu pun ulasan kamera berarti karangan.
  const hasCameraNotes = products.some((product) => product.notes.some((note) => note.aspect === "kamera"));
  if (!hasCameraNotes && cleanCamera.length > 0) return null;
  // Setiap produk yang punya ulasan wajib disebut namanya; klaim tanpa nama
  // produk tidak bisa dibandingkan pembaca.
  for (const product of products) {
    if (product.notes.some((note) => note.aspect === "umum") && !mentions(cleanOverall, product.name)) return null;
    if (product.notes.some((note) => note.aspect === "kamera") && !mentions(cleanCamera, product.name)) return null;
  }
  return { overall: cleanOverall, camera: cleanCamera };
}

/** Nama lengkap atau tanpa merek ("Galaxy A07" untuk "Samsung Galaxy A07"). */
function mentions(text: string, name: string): boolean {
  const lower = text.toLowerCase();
  const full = name.toLowerCase();
  const withoutBrand = full.split(" ").slice(1).join(" ");
  return lower.includes(full) || (withoutBrand.length >= 2 && lower.includes(withoutBrand));
}
