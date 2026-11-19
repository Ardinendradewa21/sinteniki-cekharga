import { JUDGEMENT } from "@/lib/reviews/digest-rules";
import { REVIEW_FORMAT_LIMITS, parsePointLine } from "@/lib/reviews/review-format";

/**
 * Normalisasi keluaran model untuk draf ulasan (modul murni, diuji).
 *
 * Uji coba 18 November 2026 (4 video): 2 draf ditolak utuh dengan "tidak
 * sesuai bentuk" karena satu kolom melewati batas. Membuang draf yang 90% benar
 * hanya karena itu merugikan admin, jadi keluaran DIRAPIKAN ke batas formulir,
 * bukan ditolak. Draf hanya ditolak bila tidak ada isi yang bisa dipakai.
 *
 * Kata penilaian ("terbaik") tidak dihapus diam-diam (bisa mengubah makna);
 * admin diberi peringatan yang menyebut poinnya di "catatan".
 *
 * RV-02 (19 Nov 2026): draf kini berbentuk kartu mudah dicerna: "intinya",
 * label cocok/kurang cocok, dan maks 4 poin pendek per sisi dengan menit video.
 */

export const DRAFT_FIELD_LIMITS = {
  intinya: REVIEW_FORMAT_LIMITS.verdict,
  label: REVIEW_FORMAT_LIMITS.label,
  labelMaks: REVIEW_FORMAT_LIMITS.labelMax,
  ringkasan: 1200,
  poin: REVIEW_FORMAT_LIMITS.point,
  poinMaks: REVIEW_FORMAT_LIMITS.pointMax,
  konteks: 300,
  catatan: 600,
} as const;

export type DraftPoint = { poin: string; menit: string };

export type NormalizedDraft = {
  relevan: boolean;
  aspek: "umum" | "kamera";
  intinya: string;
  cocok_untuk: string[];
  kurang_cocok: string[];
  kelebihan: DraftPoint[];
  kekurangan: DraftPoint[];
  ringkasan: string;
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

/** Poin model: objek {poin, menit} atau teks biasa (bisa berakhiran "[m:ss]"). */
function points(value: unknown): DraftPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): DraftPoint => {
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const parsed = parsePointLine(str(record.poin));
        return { poin: parsed.text, menit: firstTimestamp(str(record.menit)) || (parsed.seconds ? firstTimestamp(str(record.poin)) : "") };
      }
      const parsed = parsePointLine(str(item));
      return { poin: parsed.text, menit: parsed.seconds ? firstTimestamp(str(item)) : "" };
    })
    .filter((item) => item.poin.length >= 2)
    .slice(0, DRAFT_FIELD_LIMITS.poinMaks)
    .map((item) => ({ ...item, poin: clip(item.poin, DRAFT_FIELD_LIMITS.poin) }));
}

function labels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => clip(str(item).replace(/\.$/, ""), DRAFT_FIELD_LIMITS.label))
    .filter((item) => item.length >= 2)
    .slice(0, DRAFT_FIELD_LIMITS.labelMaks);
}

/** Satu kalimat: bila model menulis lebih, ambil kalimat pertama. */
function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(\s|$)/.exec(text);
  return clip(match ? match[1]! : text, DRAFT_FIELD_LIMITS.intinya);
}

/**
 * Rapikan JSON model menjadi draf yang muat di formulir. `null` bila tidak
 * ada intinya, ringkasan, maupun poin sama sekali.
 */
export function normalizeDraft(raw: unknown, fallbackAspect: "umum" | "kamera"): NormalizedDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const kelebihan = points(data.kelebihan);
  const kekurangan = points(data.kekurangan);
  const ringkasan = clip(str(data.ringkasan), DRAFT_FIELD_LIMITS.ringkasan);
  const intinya = firstSentence(str(data.intinya));
  if (!intinya && !ringkasan && kelebihan.length === 0 && kekurangan.length === 0) return null;
  const cocok = labels(data.cocok_untuk);
  const kurang = labels(data.kurang_cocok);

  const warnings: string[] = [];
  const flag = (label: string, text: string) => {
    const word = JUDGEMENT.exec(text)?.[0];
    if (word) warnings.push(`${label} memuat kata penilaian "${word}"; ubah sebelum terbit.`);
  };
  flag("Intinya", intinya);
  flag("Ringkasan", ringkasan);
  [...cocok, ...kurang].forEach((item) => flag(`Label "${item}"`, item));
  kelebihan.forEach((item, index) => flag(`Kelebihan no. ${index + 1}`, item.poin));
  kekurangan.forEach((item, index) => flag(`Kekurangan no. ${index + 1}`, item.poin));
  for (const [key, label] of [["kelebihan", "kelebihan"], ["kekurangan", "kekurangan"]] as const) {
    const list = data[key];
    if (Array.isArray(list) && list.length > DRAFT_FIELD_LIMITS.poinMaks) {
      warnings.push(`Model menulis ${list.length} ${label}; hanya ${DRAFT_FIELD_LIMITS.poinMaks} pertama yang dipakai.`);
    }
  }
  const wordy = [...kelebihan, ...kekurangan].filter((item) => item.poin.split(/\s+/).length > REVIEW_FORMAT_LIMITS.pointWords).length;
  if (wordy > 0) warnings.push(`${wordy} poin lebih dari ${REVIEW_FORMAT_LIMITS.pointWords} kata; pendekkan agar mudah dipindai.`);

  const modelNote = str(data.catatan);
  const catatan = clip([...warnings, modelNote].filter(Boolean).join(" "), DRAFT_FIELD_LIMITS.catatan);

  return {
    relevan: data.relevan !== false,
    aspek: data.aspek === "kamera" || data.aspek === "umum" ? data.aspek : fallbackAspect,
    intinya,
    cocok_untuk: cocok,
    kurang_cocok: kurang,
    kelebihan,
    kekurangan,
    ringkasan,
    konteks: clip(str(data.konteks), DRAFT_FIELD_LIMITS.konteks),
    menit: firstTimestamp(str(data.menit)),
    bersponsor: data.bersponsor === true,
    catatan,
  };
}
