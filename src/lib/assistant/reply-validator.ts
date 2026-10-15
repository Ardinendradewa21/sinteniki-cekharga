/**
 * Validator balasan penulis Tanya AI (rancangan §3.1, PB-39). Modul murni.
 *
 * Penulis balasan boleh menyebut produk dan harga, tetapi HANYA yang ada di
 * hasil mesin rekomendasi giliran ini. Validator memeriksa:
 *
 * 1. Nama produk katalog yang disebut harus termasuk kandidat yang tampil.
 *    Menyebut produk katalog lain berarti model mengarang rekomendasi.
 * 2. Setiap angka Rupiah ("Rp2.899.000", "2,9 juta", "2.899.000") harus cocok
 *    dengan harga kandidat, selisih budget kandidat, atau budget pengguna.
 *    Toleransi 50 ribu untuk pembulatan "2,9 juta".
 * 3. Tanpa klaim "terbaik", "termurah", atau "paling bagus" (PRD §3).
 *
 * Balasan yang gagal tidak dikirim; pemanggil memakai balasan cadangan yang
 * tidak menyebut produk.
 */

type ReplyCheckInput = {
  reply: string;
  /** Nama kandidat yang tampil, mis. "Xiaomi Redmi 17" dan "Redmi 17". */
  allowedNames: readonly string[];
  /** Semua nama produk terbit di katalog (merek + model, dan model saja). */
  catalogNames: readonly string[];
  /** Angka Rupiah yang boleh disebut. */
  allowedAmounts: readonly number[];
};

type ReplyCheck = { ok: true } | { ok: false; problems: string[] };

const AMOUNT_TOLERANCE = 50_000;
const FORBIDDEN = /\b(terbaik|termurah|paling bagus|paling worth|juara|nomor satu di kelasnya)\b/i;

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/** Kemunculan nama sebagai kata utuh, bukan potongan nama lain. */
function mentions(text: string, name: string): boolean {
  const escaped = normalize(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}+])`, "u").test(text);
}

/** Angka Rupiah dalam teks, dalam satuan rupiah. */
export function readAmounts(text: string): number[] {
  const out: number[] = [];
  const t = text.toLowerCase();
  // Angka bertitik hanya dihitung Rupiah bila diawali "Rp" atau diikuti
  // "rupiah"; "5.000 mAh" bukan harga.
  for (const match of t.matchAll(/rp\s?(\d{1,3}(?:\.\d{3})+)(?!\d)|(\d{1,3}(?:\.\d{3})+)\s?rupiah/g)) {
    out.push(Number((match[1] ?? match[2])!.replace(/\./g, "")));
  }
  for (const match of t.matchAll(/(?:rp\s?)?(\d+(?:[.,]\d+)?)\s?(jt|juta)\b/g)) {
    out.push(Math.round(Number(match[1]!.replace(",", ".")) * 1_000_000));
  }
  for (const match of t.matchAll(/(?:rp\s?)?(\d+(?:[.,]\d+)?)\s?(rb|ribu)\b/g)) {
    out.push(Math.round(Number(match[1]!.replace(",", ".")) * 1_000));
  }
  return out;
}

export function checkReply({ reply, allowedNames, catalogNames, allowedAmounts }: ReplyCheckInput): ReplyCheck {
  const text = normalize(reply);
  const problems: string[] = [];

  const allowed = allowedNames.map(normalize);
  // Nama yang lebih panjang diperiksa dulu, supaya "Redmi Note 17 Pro" tidak
  // dianggap sekadar "Redmi Note 17".
  const names = [...new Set(catalogNames.map(normalize))].sort((a, b) => b.length - a.length);
  let remaining = text;
  for (const name of names) {
    if (!mentions(remaining, name)) continue;
    if (!allowed.includes(name)) problems.push(`menyebut produk di luar hasil: ${name}`);
    remaining = remaining.split(name).join(" ");
  }

  for (const amount of readAmounts(reply)) {
    if (!allowedAmounts.some((value) => Math.abs(value - amount) <= AMOUNT_TOLERANCE)) {
      problems.push(`angka rupiah tidak dikenal: ${amount}`);
    }
  }

  if (FORBIDDEN.test(reply)) problems.push("klaim superlatif");

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
