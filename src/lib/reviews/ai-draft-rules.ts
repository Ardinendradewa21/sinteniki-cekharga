import { JUDGEMENT } from "@/lib/reviews/digest-rules";

/**
 * Normalisasi keluaran model untuk draf ulasan dari video (modul murni, diuji).
 *
 * Uji coba 18 November 2026 (4 video): 2 draf ditolak utuh dengan "tidak
 * sesuai bentuk" karena satu kolom melewati batas (poin > 220 karakter, lebih
 * dari 6 poin, atau "menit" berupa rentang). Membuang draf yang 90% benar
 * hanya karena itu merugikan admin, jadi keluaran kini DIRAPIKAN ke batas
 * formulir, bukan ditolak. Draf hanya ditolak bila tidak ada isi yang bisa
 * dipakai.
 *
 * Satu draf lolos memuat "Zoom AI termasuk yang terbaik" walau prompt
 * melarangnya. Kalimat seperti itu tidak dihapus diam-diam (bisa mengubah
 * makna); admin diberi peringatan yang menyebut poinnya di "catatan".
 */

export const DRAFT_FIELD_LIMITS = {
  ringkasan: 1200,
  poin: 220,
  poinMaks: 6,
  konteks: 300,
  catatan: 600,
} as const;

export type NormalizedDraft = {
  relevan: boolean;
  aspek: "umum" | "kamera";
  ringkasan: string;
  kelebihan: string[];
  kekurangan: string[];
  konteks: string;
  menit: string;
  bersponsor: boolean;
  catatan: string;
};

const str = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

/** Potong di batas kata terakhir sebelum `max`, tanpa memotong kata di tengah. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, "")}…`;
}

/** Ambil waktu "m:ss" pertama; "0:00" tidak menunjuk bagian mana pun, jadi kosong. */
export function firstTimestamp(value: string): string {
  const match = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/.exec(value);
  if (!match || /^0{1,2}:00(?::00)?$/.test(match[1]!)) return "";
  return match[1]!.length <= 8 ? match[1]! : "";
}

function points(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item).replace(/^[-•*\d.)\s]+/, ""))
    .filter((item) => item.length >= 2)
    .slice(0, DRAFT_FIELD_LIMITS.poinMaks)
    .map((item) => clip(item, DRAFT_FIELD_LIMITS.poin));
}

/**
 * Rapikan JSON model menjadi draf yang muat di formulir. `null` bila tidak
 * ada ringkasan maupun poin sama sekali (tidak ada yang bisa dipakai admin).
 */
export function normalizeDraft(raw: unknown, fallbackAspect: "umum" | "kamera"): NormalizedDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const kelebihan = points(data.kelebihan);
  const kekurangan = points(data.kekurangan);
  const ringkasan = clip(str(data.ringkasan), DRAFT_FIELD_LIMITS.ringkasan);
  if (!ringkasan && kelebihan.length === 0 && kekurangan.length === 0) return null;

  const warnings: string[] = [];
  const flag = (label: string, text: string) => {
    const word = JUDGEMENT.exec(text)?.[0];
    if (word) warnings.push(`${label} memuat kata penilaian "${word}"; ubah sebelum terbit.`);
  };
  flag("Ringkasan", ringkasan);
  kelebihan.forEach((item, index) => flag(`Kelebihan no. ${index + 1}`, item));
  kekurangan.forEach((item, index) => flag(`Kekurangan no. ${index + 1}`, item));
  if (Array.isArray(data.kelebihan) && data.kelebihan.length > DRAFT_FIELD_LIMITS.poinMaks) {
    warnings.push(`Model menulis ${data.kelebihan.length} kelebihan; hanya ${DRAFT_FIELD_LIMITS.poinMaks} pertama yang dipakai.`);
  }
  if (Array.isArray(data.kekurangan) && data.kekurangan.length > DRAFT_FIELD_LIMITS.poinMaks) {
    warnings.push(`Model menulis ${data.kekurangan.length} kekurangan; hanya ${DRAFT_FIELD_LIMITS.poinMaks} pertama yang dipakai.`);
  }

  const modelNote = str(data.catatan);
  const catatan = clip([...warnings, modelNote].filter(Boolean).join(" "), DRAFT_FIELD_LIMITS.catatan);

  return {
    relevan: data.relevan !== false,
    aspek: data.aspek === "kamera" || data.aspek === "umum" ? data.aspek : fallbackAspect,
    ringkasan,
    kelebihan,
    kekurangan,
    konteks: clip(str(data.konteks), DRAFT_FIELD_LIMITS.konteks),
    menit: firstTimestamp(str(data.menit)),
    bersponsor: data.bersponsor === true,
    catatan,
  };
}
