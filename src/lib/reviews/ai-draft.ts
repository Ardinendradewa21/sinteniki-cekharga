import "server-only";

import { z } from "zod";

import { getAiClient } from "@/lib/assistant/ai/client";
import { DRAFT_FIELD_LIMITS, normalizeDraft } from "@/lib/reviews/ai-draft-rules";
import { youtubeWatchUrl } from "@/lib/reviews/youtube-match";

/**
 * Draf ringkasan ulasan dengan AI (permintaan PO 17 Nov 2026; format kartu
 * mudah dicerna RV-02, 19 Nov 2026).
 *
 * Tiga sumber bahan:
 * - `video`: OpenRouter meneruskan tautan YouTube ke Gemini lewat Google AI
 *   Studio (bagian pesan `video_url`; penyedia lain tidak menerima tautan
 *   video). Paling lengkap, paling mahal dan paling lama.
 * - `transkrip`: admin menempel transkrip YouTube (menu "Tampilkan
 *   transkrip"). Teks saja: jauh lebih murah dan cepat, menit diambil dari
 *   penanda waktu transkrip.
 * - `rapikan`: ringkasan lama yang sudah tersimpan diubah ke format baru.
 *   Model TIDAK boleh menambah isi; menit hanya bila tertulis di bahan.
 *
 * Hasilnya hanya DRAF yang mengisi formulir admin. Admin tetap membaca,
 * mengoreksi, dan menyimpan (PRD FR-07); tidak ada yang terbit otomatis.
 * Model diminta memparafrasekan, bukan menyalin ucapan reviewer (PRD §6).
 * Kegagalan tidak menghalangi apa pun: admin menulis manual (aturan system
 * design 7: timeout, tanpa percobaan ulang otomatis, cadangan).
 */

/**
 * Draf dari video DIMATIKAN (keputusan PO 19 Nov 2026, RV-04): satu video
 * 12 menit sekitar $0,07, setara ~175 giliran Tanya AI yang memakai kunci
 * OpenRouter yang sama. Draf dibuat dari transkrip tempelan atau "Rapikan"
 * (sekitar $0,005-0,015). Kode jalur video dipertahankan; menyalakannya lagi
 * cukup mengubah nilai ini setelah PO memutuskan.
 */
export const VIDEO_DRAFT_ENABLED = false;

export const VIDEO_DRAFT_LIMITS = {
  /** Draf video per admin per hari (bila jalur video dinyalakan lagi). */
  perAdminDaily: 20,
  /**
   * Draf teks (transkrip/rapikan) per hari untuk SEMUA admin bersama (RV-04):
   * pagar supaya ringkasan tidak pernah menghabiskan kredit Tanya AI.
   * 30 draf x ~$0,015 = maks ~$0,45/hari.
   */
  allAdminsDailyText: 30,
  /** Draf per admin per menit (memori instance). */
  perMinute: 3,
  /**
   * WAJIB di bawah `maxDuration` halaman yang memanggilnya dengan sisa untuk
   * audit dan render (insiden 19 Nov 2026: produksi mati di 120 s karena
   * 100 s x 2 percobaan). Vercel Hobby + Fluid compute: maks 300 s.
   */
  timeoutMs: 270_000,
  /** Teks jauh lebih cepat dari menonton video. */
  textTimeoutMs: 120_000,
  /** Cukup untuk JSON draf + penalaran singkat model. */
  maxOutputTokens: 6000,
  /** Transkrip 20 menit sekitar 20 ribu karakter; batas ini menahan tempelan salah. */
  transcriptMaxChars: 80_000,
} as const;

/**
 * Model bisa diganti tanpa mengubah kode (env Vercel). Harus model Gemini
 * yang menerima video lewat Google AI Studio. Transkrip dan rapikan memakai
 * model yang sama supaya mutu antar mode konsisten (keputusan PO 19 Nov 2026).
 */
export function reviewDraftModel(): string {
  return process.env.OPENROUTER_VIDEO_MODEL || "google/gemini-2.5-flash";
}

/** Tingkat penalaran: "low" menjaga waktu tunggu tetap masuk batas fungsi. */
function reasoningEffort(): "low" | "medium" | "high" {
  const value = process.env.OPENROUTER_VIDEO_REASONING;
  return value === "medium" || value === "high" ? value : "low";
}

const pointSchema = z.object({
  poin: z.string().min(2).max(DRAFT_FIELD_LIMITS.poin),
  menit: z.string().max(8),
});

export const draftSchema = z.object({
  /** Bahan memang membahas produk ini (bukan sekadar menyebut). */
  relevan: z.boolean(),
  aspek: z.enum(["umum", "kamera"]),
  /** Satu kalimat kesimpulan reviewer. */
  intinya: z.string().max(DRAFT_FIELD_LIMITS.intinya),
  cocok_untuk: z.array(z.string().min(2).max(DRAFT_FIELD_LIMITS.label)).max(DRAFT_FIELD_LIMITS.labelMaks),
  kurang_cocok: z.array(z.string().min(2).max(DRAFT_FIELD_LIMITS.label)).max(DRAFT_FIELD_LIMITS.labelMaks),
  kelebihan: z.array(pointSchema).max(DRAFT_FIELD_LIMITS.poinMaks),
  kekurangan: z.array(pointSchema).max(DRAFT_FIELD_LIMITS.poinMaks),
  /** Ringkasan lengkap yang dilipat di kartu. */
  ringkasan: z.string().max(DRAFT_FIELD_LIMITS.ringkasan),
  /** Cara reviewer menguji; kosong bila tidak disebut. */
  konteks: z.string().max(DRAFT_FIELD_LIMITS.konteks),
  /** Menit awal video yang diputar di kartu, "m:ss"; kosong bila tidak yakin. */
  menit: z.string().max(8),
  bersponsor: z.boolean(),
  /** Hal yang perlu dicek admin, plus peringatan kata penilaian. */
  catatan: z.string().max(DRAFT_FIELD_LIMITS.catatan),
});
export type VideoDraft = z.infer<typeof draftSchema>;

const POINT_JSON = {
  type: "object",
  additionalProperties: false,
  required: ["poin", "menit"],
  properties: { poin: { type: "string" }, menit: { type: "string" } },
} as const;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["relevan", "aspek", "intinya", "cocok_untuk", "kurang_cocok", "kelebihan", "kekurangan", "ringkasan", "konteks", "menit", "bersponsor", "catatan"],
  properties: {
    relevan: { type: "boolean" },
    aspek: { type: "string", enum: ["umum", "kamera"] },
    intinya: { type: "string" },
    cocok_untuk: { type: "array", items: { type: "string" }, maxItems: 3 },
    kurang_cocok: { type: "array", items: { type: "string" }, maxItems: 3 },
    kelebihan: { type: "array", items: POINT_JSON, maxItems: 4 },
    kekurangan: { type: "array", items: POINT_JSON, maxItems: 4 },
    ringkasan: { type: "string" },
    konteks: { type: "string" },
    menit: { type: "string" },
    bersponsor: { type: "boolean" },
    catatan: { type: "string" },
  },
} as const;

export type DraftSource =
  | { kind: "video"; youtubeId: string }
  | { kind: "transkrip"; text: string }
  | { kind: "rapikan"; text: string };

export type DraftInput = {
  source: DraftSource;
  productName: string;
  channel: string;
  title: string;
  aspect: "umum" | "kamera";
  /** Hanya untuk skrip uji banding model; aplikasi memakai `reviewDraftModel()`. */
  model?: string;
};

const SOURCE_RULES: Record<DraftSource["kind"], string> = {
  video:
    "BAHAN: video YouTube terlampir. Tonton dan dengarkan seluruhnya. \"menit\" di tiap poin = saat reviewer membahas poin itu di video.",
  transkrip:
    "BAHAN: transkrip video yang ditempel admin (di bawah). Penanda waktu di transkrip (mis. \"4:35\") adalah menit video; pakai untuk \"menit\" tiap poin. Bila transkrip tanpa penanda waktu, kosongkan semua \"menit\". Transkrip otomatis bisa salah eja nama produk atau angka; tulis yang masuk akal dan sebut keraguanmu di \"catatan\".",
  rapikan:
    "BAHAN: ringkasan lama yang ditulis admin (di bawah). Tugasmu hanya MENATA ULANG isinya ke format baru. JANGAN menambah fakta, angka, atau pendapat yang tidak tertulis di bahan. \"menit\" hanya bila tertulis di bahan; selain itu kosong.",
};

function buildPrompt({ productName, channel, title, aspect, source }: DraftInput): string {
  const focus =
    aspect === "kamera"
      ? "FOKUS ASPEK KAMERA: hasil foto dan video (siang, malam, potret, zoom, stabilisasi, kamera depan) menurut reviewer."
      : "FOKUS ASPEK UMUM: pemakaian harian, performa dan game, baterai dan pengisian, layar, desain, panas.";
  return `Kamu membantu admin CekHarga, situs bantu pilih HP di Indonesia, menyiapkan DRAF kartu ringkasan ulasan seorang reviewer YouTube. Pembaca kartu ingin menangkap pendapat reviewer dalam 10 detik. Admin akan memeriksa drafmu sebelum terbit.

Produk: ${productName}
Channel: ${channel}
Judul video: ${title}
${focus}
${SOURCE_RULES[source.kind]}

ISI KARTU:
- "intinya": SATU kalimat (maks 25 kata) berisi kesimpulan reviewer: untuk siapa HP ini dan apa kompromi utamanya. Contoh: "Cocok untuk kerja harian berkat baterai awet dan layar besar, tetapi kurang bertenaga untuk game berat."
- "cocok_untuk" dan "kurang_cocok": masing-masing maks 3 label pendek (2-4 kata, tanpa titik), jenis pengguna atau kegiatan yang disebut atau jelas tersirat dari reviewer. Contoh: "Pekerjaan kantor", "Gaming berat", "Fotografi malam". Kosongkan bila reviewer tidak menyinggung.
- "kelebihan" dan "kekurangan": masing-masing maks 4 poin TERPENTING menurut reviewer, diurutkan dari yang paling ditekankan. Tiap "poin" maks 12 kata dengan KATA KUNCI di depan diikuti titik dua, lalu bukti konkret yang disebut reviewer (angka, hasil uji). Contoh: "Baterai: tahan 19 jam di uji PCMark". Satu gagasan per poin, jangan menggabungkan dua hal.
- "menit" pada tiap poin: format m:ss, SATU waktu (bukan rentang, bukan 0:00). Kosongkan bila tidak yakin; lebih baik kosong daripada salah.
- "ringkasan": 3 sampai 5 kalimat untuk pembaca yang ingin detail: konteks, temuan utama, dan perbedaan dengan HP sekelas bila reviewer menyebutnya. Jangan mengulang poin kata per kata.
- "konteks": cara reviewer menguji (mis. "dipakai 2 minggu, main Genshin 1 jam"), kosong bila tidak disebut.
- "menit" (utama): bagian video yang paling relevan dengan fokus, untuk titik mulai pemutar. Kosong bila tidak yakin.
- "bersponsor": true bila reviewer menyebut sponsor, kerja sama berbayar, atau unit dari brand.
- "relevan": false bila bahan bukan ulasan produk ini (produk lain, unboxing tanpa penilaian, kompilasi). Bila false, jelaskan di "catatan".
- "catatan": hal yang perlu dicek admin (mis. "reviewer memakai varian 12/512 GB", angka yang kurang jelas terdengar). Kosong bila tidak ada.

ATURAN:
- Bahasa Indonesia yang wajar dengan kalimatmu sendiri. JANGAN menyalin ucapan reviewer kata per kata dan jangan membuat kutipan panjang.
- Hanya isi yang benar-benar disampaikan reviewer. Jangan menambah spesifikasi, harga, atau pendapatmu sendiri.
- Tanpa skor, peringkat, atau kata "terbaik", "termurah", "paling bagus", "juara", "nomor satu", juga bila reviewer sendiri mengucapkannya. Ganti dengan pengamatan konkret, mis. "Zoom: 10x masih tajam", bukan "zoom terbaik".
- Tanpa tanda pisah panjang (em dash).`;
}

export type DraftMeta = { model: string; ms: number; costUsd: number | null; promptTokens: number | null; completionTokens: number | null };

export type DraftResult =
  | { ok: true; draft: VideoDraft; meta: DraftMeta }
  | { ok: false; reason: string; meta?: DraftMeta };

export async function draftReview(input: DraftInput): Promise<DraftResult> {
  const model = input.model ?? reviewDraftModel();
  const isVideo = input.source.kind === "video";
  const started = Date.now();
  const meta = (usage?: Record<string, unknown>): DraftMeta => ({
    model,
    ms: Date.now() - started,
    costUsd: typeof usage?.cost === "number" ? usage.cost : null,
    promptTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null,
    completionTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null,
  });
  const timeoutMs = isVideo ? VIDEO_DRAFT_LIMITS.timeoutMs : VIDEO_DRAFT_LIMITS.textTimeoutMs;

  const material =
    input.source.kind === "video"
      ? // Bagian `video_url` OpenRouter; tipe SDK OpenAI belum mengenalnya.
        ({ type: "video_url", video_url: { url: youtubeWatchUrl(input.source.youtubeId) } } as never)
      : { type: "text" as const, text: `--- BAHAN ---\n${input.source.text.slice(0, VIDEO_DRAFT_LIMITS.transcriptMaxChars)}\n--- AKHIR BAHAN ---` };

  try {
    const completion = await getAiClient().chat.completions.create(
      {
        model,
        max_tokens: VIDEO_DRAFT_LIMITS.maxOutputTokens,
        temperature: 0.3,
        ...({
          // Hanya Google AI Studio yang menerima tautan YouTube (dokumentasi OpenRouter).
          ...(isVideo ? { provider: { only: ["google-ai-studio"] } } : {}),
          reasoning: { effort: reasoningEffort(), exclude: true },
          usage: { include: true },
        } as Record<string, unknown>),
        response_format: { type: "json_schema", json_schema: { name: "draf_ulasan", strict: true, schema: JSON_SCHEMA } },
        messages: [{ role: "user", content: [{ type: "text", text: buildPrompt(input) }, material] }],
      },
      // Tanpa percobaan ulang otomatis: video ditagih per percobaan dan dua
      // percobaan tidak muat di batas fungsi. Admin bisa menekan tombolnya lagi.
      { timeout: timeoutMs, maxRetries: 0 }
    );
    const usage = (completion as unknown as { usage?: Record<string, unknown> }).usage;
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { ok: false, reason: "Model tidak mengembalikan draf.", meta: meta(usage) };
    // Keluaran dirapikan ke batas formulir, bukan ditolak utuh (uji coba 18 Nov 2026).
    let json: unknown;
    try {
      json = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      console.error("[ulasan-ai] draf bukan JSON yang utuh (mungkin terpotong batas token).");
      return { ok: false, reason: "Draf dari model terpotong. Coba sekali lagi atau tulis manual.", meta: meta(usage) };
    }
    const normalized = normalizeDraft(json, input.aspect);
    const parsed = normalized ? draftSchema.safeParse(normalized) : null;
    if (!parsed?.success) {
      // Jalur kolom yang gagal saja, tanpa isi draf (untuk diagnosis).
      console.error("[ulasan-ai] draf tidak bisa dipakai:", parsed ? parsed.error.issues.map((i) => i.path.join(".")).join(", ") : "tanpa isi");
      return { ok: false, reason: "Draf dari model tidak bisa dipakai. Coba sekali lagi atau tulis manual.", meta: meta(usage) };
    }
    return { ok: true, draft: parsed.data, meta: meta(usage) };
  } catch (error) {
    const status = (error as { status?: number })?.status;
    const name = (error as Error)?.name ?? "";
    console.error("[ulasan-ai] draf gagal:", input.source.kind, status ?? (name || "galat"));
    const timedOut = /timeout/i.test(name) || /timed out/i.test((error as Error)?.message ?? "");
    const seconds = Math.round(timeoutMs / 1000);
    return {
      ok: false,
      meta: meta(),
      reason: timedOut
        ? isVideo
          ? `Model belum selesai menonton video dalam ${seconds} detik, biasanya karena videonya panjang. Pakai "Tempel transkrip" (lebih cepat), coba sekali lagi, atau tulis manual.`
          : `Model belum selesai dalam ${seconds} detik. Coba sekali lagi atau tulis manual.`
        : status === 402
          ? "OpenRouter menolak: sisa batas kredit kunci API tidak cukup (input video butuh minimal $1). Pemilik akun perlu menaikkan batas kunci di openrouter.ai/settings/keys. Sementara itu tulis ringkasan manual."
          : status === 413 || status === 400
            ? isVideo
              ? "Video tidak bisa diproses model (mungkin terlalu panjang atau dibatasi). Pakai \"Tempel transkrip\" atau tulis manual."
              : "Bahan tidak bisa diproses model (mungkin terlalu panjang). Pendekkan lalu coba lagi."
            : "Layanan AI sedang tidak bisa memproses permintaan ini. Coba lagi nanti atau tulis manual.",
    };
  }
}
