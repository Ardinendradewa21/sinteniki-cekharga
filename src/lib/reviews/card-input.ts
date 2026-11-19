import { z } from "zod";

import { REVIEW_FORMAT_LIMITS, parseClock, parseLabels, parsePointLines, pointSeconds } from "@/lib/reviews/review-format";

/**
 * Isian kartu ulasan dari formulir admin (RV-02), dipakai tiga jalur: terbitkan
 * dari kandidat video, ubah ringkasan, dan tambah manual di halaman produk.
 * Modul murni (tanpa server-only) supaya bisa diuji.
 *
 * Poin lebih dari 4 DITOLAK dengan pesan, bukan dipotong diam-diam: ulasan
 * format lama bisa punya 6 poin, dan membuang 2 poin saat admin menyimpan
 * perubahan kecil berarti kehilangan data tanpa sadar.
 */

/** Poin ulasan lama bisa sampai 220 karakter; batas 140 hanya untuk draf AI. */
const POINT_MAX_CHARS = 220;

const text = (max: number, label: string) => z.string().max(max, `${label} maksimal ${max} karakter`).default("");

function pointsField(label: string) {
  return text(2000, label)
    .refine((value) => value.split(/\r?\n/).filter((line) => line.trim()).length <= REVIEW_FORMAT_LIMITS.pointMax, {
      message: `${label} maksimal ${REVIEW_FORMAT_LIMITS.pointMax} poin. Pilih yang paling penting.`,
    })
    .transform((value) => parsePointLines(value))
    .refine((points) => points.every((point) => point.text.length <= POINT_MAX_CHARS), {
      message: `Satu poin ${label.toLowerCase()} terlalu panjang. Pendekkan menjadi satu gagasan.`,
    });
}

function labelsField(label: string) {
  return text(300, label)
    .refine((value) => value.split(/\r?\n|,/).filter((item) => item.trim()).length <= REVIEW_FORMAT_LIMITS.labelMax, {
      message: `${label} maksimal ${REVIEW_FORMAT_LIMITS.labelMax} label.`,
    })
    .transform(parseLabels)
    .refine((labels) => labels.every((item) => item.length <= REVIEW_FORMAT_LIMITS.label), {
      message: `Label ${label.toLowerCase()} maksimal ${REVIEW_FORMAT_LIMITS.label} karakter.`,
    });
}

export function cardFieldsSchema({ requireVerdict }: { requireVerdict: boolean }) {
  return z.object({
    verdict: text(REVIEW_FORMAT_LIMITS.verdict, "Intinya")
      .transform((value) => value.replace(/\s+/g, " ").trim() || null)
      .refine((value) => (value === null ? !requireVerdict : value.length >= 10), {
        message: "Isi \"Intinya\": satu kalimat kesimpulan reviewer (minimal 10 karakter).",
      }),
    goodFor: labelsField("Cocok untuk"),
    notFor: labelsField("Kurang cocok untuk"),
    summary: z.string().trim().min(40, "Ringkasan minimal 40 karakter").max(1200, "Ringkasan maksimal 1.200 karakter"),
    strengths: pointsField("Kelebihan"),
    limitations: pointsField("Kekurangan"),
    testContext: text(300, "Konteks pengujian").transform((value) => value.trim() || null),
    timestamp: text(8, "Menit")
      .transform((value) => value.trim())
      .refine((value) => !value || parseClock(value) !== null, { message: "Menit ditulis seperti 4:35" })
      .transform((value) => (value ? parseClock(value) : null)),
  });
}

export type CardFields = z.infer<ReturnType<typeof cardFieldsSchema>>;

/** Kolom `review_summaries` dari isian kartu. */
export function cardColumns(input: CardFields) {
  return {
    verdict: input.verdict,
    good_for: input.goodFor,
    not_for: input.notFor,
    summary: input.summary,
    strengths: input.strengths.map((point) => point.text),
    strength_seconds: pointSeconds(input.strengths),
    limitations: input.limitations.map((point) => point.text),
    limitation_seconds: pointSeconds(input.limitations),
    test_context: input.testContext,
    timestamp_seconds: input.timestamp,
  };
}
