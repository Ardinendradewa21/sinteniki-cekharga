import { z } from "zod";

import type { StaffRole } from "@/lib/auth/dal";

/**
 * Validasi dan aturan alur modul iklan (docs/ads/ADS-CONTEXT.md §5-6).
 * Modul murni: dipakai server action dan unit test.
 */

/** Hasil server action admin iklan: pesan galat atau pesan sukses. */
export type AdActionState = { error: string | null; message?: string };

/* ------------------------------------------------------------ util form */

/** Teks dari FormData: dipangkas, string kosong menjadi null. */
export function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Nilai datetime-local yang diisi dalam WIB → ISO UTC. */
export function jakartaLocalToIso(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "Rp 12.500.000" / "12500000" → 12500000. Selain digit diabaikan. */
export function parseRupiah(value: string | null): number | null {
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : null;
}

/** "Samsung, iQOO" → ["Samsung", "iQOO"] tanpa duplikat (tanpa membedakan huruf). */
export function parseBrandList(value: string | null): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(",")) {
    const brand = raw.trim();
    if (brand && !seen.has(brand.toLowerCase())) {
      seen.add(brand.toLowerCase());
      out.push(brand);
    }
  }
  return out.slice(0, 20);
}

const optionalText = (max: number) => z.string().max(max).nullable();
const httpsUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Tautan harus diawali https://");

/* ------------------------------------------------------------ advertiser */

export const PROSPECT_STATUS = ["lead", "proposal", "active", "inactive"] as const;
export const PROSPECT_LABEL: Record<(typeof PROSPECT_STATUS)[number], string> = {
  lead: "Prospek",
  proposal: "Proposal",
  active: "Aktif",
  inactive: "Tidak aktif",
};

export const advertiserInput = z.object({
  company_name: z.string().min(2, "Nama perusahaan wajib diisi.").max(200),
  display_name: z.string().min(1, "Nama merek wajib diisi.").max(80),
  npwp: z
    .string()
    .regex(/^[\d.\-]{15,22}$/, "NPWP berisi 15 atau 16 digit.")
    .nullable(),
  contact_name: optionalText(120),
  contact_email: z.email("Email kontak tidak valid.").max(200).nullable(),
  contact_phone: z
    .string()
    .regex(/^[+\d\s-]{8,20}$/, "Nomor telepon tidak valid.")
    .nullable(),
  prospect_status: z.enum(PROSPECT_STATUS),
  notes: optionalText(2000),
});

export function advertiserFromForm(formData: FormData) {
  return advertiserInput.safeParse({
    company_name: text(formData, "company_name") ?? "",
    display_name: text(formData, "display_name") ?? text(formData, "company_name") ?? "",
    npwp: text(formData, "npwp"),
    contact_name: text(formData, "contact_name"),
    contact_email: text(formData, "contact_email"),
    contact_phone: text(formData, "contact_phone"),
    prospect_status: text(formData, "prospect_status") ?? "lead",
    notes: text(formData, "notes"),
  });
}

/* ------------------------------------------------------------ PKS */

export const CONTRACT_STATUS = ["draft", "signed", "ended", "terminated"] as const;
export const CONTRACT_LABEL: Record<(typeof CONTRACT_STATUS)[number], string> = {
  draft: "Draft",
  signed: "Ditandatangani",
  ended: "Berakhir",
  terminated: "Diputus",
};

export const contractInput = z
  .object({
    contract_number: z.string().min(3, "Nomor PKS wajib diisi.").max(80),
    start_date: z.iso.date("Tanggal mulai tidak valid."),
    end_date: z.iso.date("Tanggal selesai tidak valid."),
    notes: optionalText(2000),
  })
  .refine((value) => value.end_date >= value.start_date, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
    path: ["end_date"],
  });

export const CONTRACT_FILE_MAX_BYTES = 10 * 1024 * 1024;

/* ------------------------------------------------------------ IO */

export const IO_STATUS = [
  "draft",
  "negotiation",
  "approved",
  "awaiting_payment",
  "ready",
  "live",
  "completed",
  "cancelled",
] as const;
export type IoStatus = (typeof IO_STATUS)[number];

export const IO_LABEL: Record<IoStatus, string> = {
  draft: "Draft",
  negotiation: "Negosiasi",
  approved: "Disetujui",
  awaiting_payment: "Menunggu pembayaran",
  ready: "Siap tayang",
  live: "Tayang",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

/**
 * Transisi status IO yang sah dan peran yang boleh melakukannya
 * (ADS-CONTEXT §5 langkah 3-12). Peran `admin` selalu boleh.
 */
export const IO_TRANSITIONS: Record<IoStatus, Partial<Record<IoStatus, readonly StaffRole[]>>> = {
  draft: { negotiation: ["sales"], cancelled: ["sales"] },
  negotiation: { draft: ["sales"], approved: ["legal"], cancelled: ["sales"] },
  approved: { awaiting_payment: ["finance"], negotiation: ["legal", "sales"], cancelled: ["sales"] },
  awaiting_payment: { ready: ["finance"], cancelled: ["sales", "finance"] },
  ready: { live: ["adops"], cancelled: ["sales"] },
  live: { completed: ["adops"], cancelled: ["sales"] },
  completed: {},
  cancelled: {},
};

export function canTransitionIo(role: StaffRole, from: IoStatus, to: IoStatus): boolean {
  const allowed = IO_TRANSITIONS[from]?.[to];
  if (!allowed) return false;
  return role === "admin" || allowed.includes(role);
}

export const ioInput = z.object({
  io_number: z.string().min(3, "Nomor IO wajib diisi.").max(80),
  campaign_name: z.string().min(2, "Nama kampanye wajib diisi.").max(200),
  total_amount: z.number().int().min(0),
  tax_included: z.boolean(),
  notes: optionalText(2000),
});

/* ------------------------------------------------------------ line item */

export const PRICING_MODELS = ["flat", "cpm", "cpc"] as const;
export const LINE_ITEM_STATUS = ["pending", "active", "paused", "ended"] as const;
export const LINE_ITEM_LABEL: Record<(typeof LINE_ITEM_STATUS)[number], string> = {
  pending: "Menunggu",
  active: "Aktif",
  paused: "Dijeda",
  ended: "Berakhir",
};

export const lineItemInput = z
  .object({
    slot_id: z.uuid("Pilih slot."),
    name: z.string().max(200),
    pricing_model: z.enum(PRICING_MODELS),
    rate: z.number().int().min(0, "Tarif tidak valid."),
    target_quantity: z.number().int().positive().nullable(),
    start_at: z.iso.datetime("Waktu mulai tidak valid."),
    end_at: z.iso.datetime("Waktu selesai tidak valid."),
    priority: z.number().int().min(1).max(100),
    weight: z.number().int().min(1).max(100),
    target_brands: z.array(z.string().max(60)).max(20),
  })
  .refine((value) => value.end_at > value.start_at, {
    message: "Waktu selesai harus setelah waktu mulai.",
    path: ["end_at"],
  })
  .refine((value) => value.pricing_model === "flat" || value.target_quantity !== null, {
    message: "CPM dan CPC wajib punya target tayangan/klik.",
    path: ["target_quantity"],
  });

function intOr(value: string | null, fallback: number | null): number | null {
  if (value === null) return fallback;
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isSafeInteger(parsed) && value.replace(/[^\d]/g, "") !== "" ? parsed : fallback;
}

export function lineItemFromForm(formData: FormData) {
  const pricing = text(formData, "pricing_model") ?? "";
  return lineItemInput.safeParse({
    slot_id: text(formData, "slot_id") ?? "",
    name: text(formData, "name") ?? "",
    pricing_model: pricing,
    rate: parseRupiah(text(formData, "rate")) ?? -1,
    target_quantity: pricing === "flat" ? null : intOr(text(formData, "target_quantity"), null),
    start_at: jakartaLocalToIso(text(formData, "start_at")) ?? "",
    end_at: jakartaLocalToIso(text(formData, "end_at")) ?? "",
    priority: intOr(text(formData, "priority"), 10),
    weight: intOr(text(formData, "weight"), 1),
    target_brands: parseBrandList(text(formData, "target_brands")),
  });
}

/* ------------------------------------------------------------ creative */

export const CREATIVE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
/** Batas berat materi (IAB LEAN menyarankan ≤150 KB; diberi ruang untuk retina). */
export const CREATIVE_IMAGE_MAX_BYTES = 500 * 1024;

export const creativeInput = z
  .object({
    format: z.enum(["display", "native"]),
    alt_text: z.string().min(3, "Teks alternatif wajib diisi.").max(200),
    destination_url: httpsUrl,
    headline: optionalText(90),
    body: optionalText(200),
    cta_label: optionalText(30),
  })
  .refine((value) => value.format === "display" || Boolean(value.headline), {
    message: "Iklan native wajib punya judul.",
    path: ["headline"],
  });

/**
 * Rasio gambar harus sama dengan rasio slot (toleransi 2%), supaya materi
 * tidak terpotong atau gepeng. Ukuran 2× (retina) diperbolehkan.
 */
export function matchesSlotRatio(
  image: { width: number; height: number },
  slotSize: string | null
): boolean {
  const match = slotSize?.match(/^(\d+)x(\d+)$/);
  if (!match) return false;
  const want = Number(match[1]) / Number(match[2]);
  const got = image.width / image.height;
  return Math.abs(got - want) / want <= 0.02 && image.width >= Number(match[1]);
}

/** Checklist review creative (ADS-CONTEXT §1 butir 7, §12.1 butir 3). */
export const REVIEW_CHECKLIST = [
  { key: "no_prohibited", label: "Bukan kategori terlarang (judi, pinjol ilegal, obat terlarang, konten dewasa)" },
  { key: "claims_ok", label: "Tidak ada klaim menyesatkan; klaim harga/promo bisa dibuktikan" },
  { key: "no_ranking", label: "Tidak memakai kata \"terbaik\", peringkat, atau mengatasnamakan CekHarga" },
  { key: "format_ok", label: "Ukuran, berat, dan keterbacaan materi sesuai slot" },
  { key: "link_ok", label: "Tautan tujuan aktif, https, dan sesuai isi iklan" },
] as const;

export type ReviewChecklist = Record<(typeof REVIEW_CHECKLIST)[number]["key"], boolean> & {
  sensitive: boolean;
};

export function checklistFromForm(formData: FormData): ReviewChecklist {
  const result = { sensitive: formData.get("sensitive") === "on" } as ReviewChecklist;
  for (const item of REVIEW_CHECKLIST) result[item.key] = formData.get(item.key) === "on";
  return result;
}

export function checklistComplete(checklist: ReviewChecklist): boolean {
  return REVIEW_CHECKLIST.every((item) => checklist[item.key]);
}

/**
 * Kategori sensitif (keuangan, kesehatan) dan advertiser baru wajib disetujui
 * peran `admin` (ADS-CONTEXT §12.1 butir 3).
 */
export function needsEscalation(checklist: ReviewChecklist, isNewAdvertiser: boolean): boolean {
  return checklist.sensitive || isNewAdvertiser;
}

/* ------------------------------------------------------------ invoice */

export const invoiceInput = z.object({
  invoice_number: z.string().min(3, "Nomor invoice wajib diisi.").max(80),
  kind: z.enum(["down_payment", "final"]),
  amount: z.number().int().min(0),
  ppn_amount: z.number().int().min(0),
  due_date: z.iso.date("Jatuh tempo tidak valid."),
  notes: optionalText(2000),
});

/** PPN dihitung hanya bila tarif dikonfigurasi (status PKP pasti) dan IO belum termasuk pajak. */
export function computePpn(amount: number, ratePercent: number | null, taxIncluded: boolean): number {
  if (!ratePercent || taxIncluded) return 0;
  return Math.round((amount * ratePercent) / 100);
}

/* ------------------------------------------------------------ ads.txt */

export const adsTxtInput = z.object({
  ad_system_domain: z
    .string()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Domain sistem iklan tidak valid."),
  publisher_id: z.string().regex(/^[A-Za-z0-9._-]+$/, "ID penerbit tidak valid."),
  relationship: z.enum(["DIRECT", "RESELLER"]),
  cert_authority_id: z
    .string()
    .toLowerCase()
    .regex(/^[a-z0-9]+$/, "ID otoritas sertifikasi tidak valid.")
    .nullable(),
});

/* ------------------------------------------------------------ lead publik */

export const leadInput = z.object({
  company_name: z.string().min(2, "Nama perusahaan wajib diisi.").max(200),
  contact_name: z.string().min(2, "Nama kontak wajib diisi.").max(120),
  contact_email: z.email("Email tidak valid.").max(200),
  contact_phone: z
    .string()
    .regex(/^[+\d\s-]{8,20}$/, "Nomor telepon tidak valid.")
    .nullable(),
  message: z.string().max(1500).nullable(),
});
