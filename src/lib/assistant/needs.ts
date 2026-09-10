import { z } from "zod";

/**
 * Kebutuhan pengguna untuk konsultasi (PRD FR-06).
 *
 * Pembedaan paling penting di file ini adalah antara SYARAT WAJIB dan
 * PREFERENSI, karena PRD memperlakukan keduanya berbeda:
 *
 * - Syarat wajib "tidak boleh dilanggar". Kandidat yang melanggarnya dibuang,
 *   bukan diturunkan peringkatnya.
 * - Preferensi "dapat dikompromikan", jadi hanya memengaruhi urutan dan
 *   penjelasan, tidak pernah membuang kandidat.
 * - "Jika tidak jelas apakah wajib, tanyakan." Karena itu budget punya field
 *   terpisah `budgetIsHard`, bukan ditebak dari nada kalimat.
 *
 * Semua state hidup di URL seperti halaman lain, jadi hasil konsultasi bisa
 * dibagikan dan dibuka ulang. Setiap field memakai `.catch()` supaya URL yang
 * dirusak tidak pernah menggagalkan halaman.
 */

export const ACTIVITIES = [
  "sosial-media",
  "foto",
  "game",
  "kerja",
  "baterai",
] as const;

export const ACTIVITY_LABELS: Record<(typeof ACTIVITIES)[number], string> = {
  "sosial-media": "Media sosial dan pesan",
  foto: "Foto dan video",
  game: "Main game",
  kerja: "Kerja dan multitasking",
  baterai: "Tahan lama tanpa mengisi",
};

export const REQUIREMENTS = ["garansi-resmi", "ram-8", "storage-256"] as const;

export const REQUIREMENT_LABELS: Record<
  (typeof REQUIREMENTS)[number],
  string
> = {
  "garansi-resmi": "Harus bergaransi resmi Indonesia",
  "ram-8": "RAM minimal 8 GB",
  "storage-256": "Penyimpanan minimal 256 GB",
};

export const PRIORITIES = ["harga", "baterai", "kamera", "performa"] as const;

export const PRIORITY_LABELS: Record<(typeof PRIORITIES)[number], string> = {
  harga: "Harga semurah mungkin",
  baterai: "Daya tahan baterai",
  kamera: "Kemampuan kamera",
  performa: "Performa dan kelancaran",
};

export const NEEDS_PARAM = {
  budget: "budget",
  budgetIsHard: "budget_wajib",
  activities: "kegiatan",
  requirements: "wajib",
  requirementsAnswered: "wajib_jawab",
  priority: "prioritas",
} as const;

const toList = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const needsSchema = z.object({
  /** `null` = belum ditanyakan atau sengaja dilewati. */
  budgetIdr: z.coerce.number().int().positive().nullable().catch(null),
  /**
   * Apakah budget adalah batas keras. `null` berarti belum dijawab, dan itu
   * BUKAN sama dengan "tidak wajib": selama masih null, pertanyaannya belum
   * selesai dan asisten belum boleh menyaring berdasarkan budget.
   */
  budgetIsHard: z
    .enum(["ya", "tidak"])
    .nullable()
    .catch(null)
    .transform((value) => (value === null ? null : value === "ya")),
  activities: z
    .array(z.enum(ACTIVITIES).catch("sosial-media"))
    .transform((values) => [...new Set(values)])
    .catch([]),
  requirements: z
    .array(z.enum(REQUIREMENTS).catch("garansi-resmi"))
    .transform((values) => [...new Set(values)])
    .catch([]),
  /**
   * Dibutuhkan karena daftar syarat khusus yang KOSONG punya dua arti berbeda:
   * belum ditanyakan, atau sudah ditanyakan dan jawabannya memang tidak ada.
   * Tanpa penanda ini, asisten akan menanyakan hal yang sama berulang kali,
   * yang justru dilarang PRD FR-06.
   */
  requirementsAnswered: z
    .enum(["ya"])
    .nullable()
    .catch(null)
    .transform((value) => value === "ya"),
  priority: z.enum(PRIORITIES).nullable().catch(null),
});

export type UserNeeds = z.infer<typeof needsSchema>;

export function parseNeeds(
  raw: Record<string, string | string[] | undefined>
): UserNeeds {
  return needsSchema.parse({
    budgetIdr: toList(raw[NEEDS_PARAM.budget])[0],
    budgetIsHard: toList(raw[NEEDS_PARAM.budgetIsHard])[0],
    activities: toList(raw[NEEDS_PARAM.activities]),
    requirements: toList(raw[NEEDS_PARAM.requirements]),
    requirementsAnswered: toList(raw[NEEDS_PARAM.requirementsAnswered])[0],
    priority: toList(raw[NEEDS_PARAM.priority])[0],
  });
}

/**
 * Langkah konsultasi. PRD FR-06 melarang "kuesioner panjang sekaligus", jadi
 * halaman hanya menanyakan SATU hal yang belum terjawab pada satu waktu, dan
 * tidak pernah menanyakan ulang yang sudah dijawab.
 */
export type NeedsStep =
  | "budget"
  | "budget-hard"
  | "activities"
  | "requirements"
  | "priority"
  | "done";

export function nextStep(needs: UserNeeds): NeedsStep {
  if (needs.budgetIdr === null) return "budget";
  if (needs.budgetIsHard === null) return "budget-hard";
  if (needs.activities.length === 0) return "activities";
  if (needs.priority === null) return "priority";
  // Kebutuhan khusus ditanyakan terakhir karena jawabannya boleh "tidak ada",
  // dan penanda terpisah membedakannya dari "belum ditanya".
  if (!needs.requirementsAnswered) return "requirements";
  return "done";
}

/**
 * Menyusun URL konsultasi. Nilai kosong tidak ditulis supaya alamatnya tetap
 * pendek dan mudah dibagikan.
 */
export function buildNeedsHref(
  needs: UserNeeds,
  overrides: Partial<UserNeeds> = {}
): string {
  const next = { ...needs, ...overrides };
  const parts: string[] = [];

  if (next.budgetIdr !== null) {
    parts.push(`${NEEDS_PARAM.budget}=${next.budgetIdr}`);
  }
  if (next.budgetIsHard !== null) {
    parts.push(
      `${NEEDS_PARAM.budgetIsHard}=${next.budgetIsHard ? "ya" : "tidak"}`
    );
  }
  for (const activity of next.activities) {
    parts.push(`${NEEDS_PARAM.activities}=${activity}`);
  }
  for (const requirement of next.requirements) {
    parts.push(`${NEEDS_PARAM.requirements}=${requirement}`);
  }
  if (next.requirementsAnswered) {
    parts.push(`${NEEDS_PARAM.requirementsAnswered}=ya`);
  }
  if (next.priority !== null) {
    parts.push(`${NEEDS_PARAM.priority}=${next.priority}`);
  }

  return parts.length > 0 ? `/assistant?${parts.join("&")}` : "/assistant";
}
