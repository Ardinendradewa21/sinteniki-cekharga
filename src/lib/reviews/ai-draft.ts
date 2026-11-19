import "server-only";

import { z } from "zod";

import { getAiClient } from "@/lib/assistant/ai/client";
import { normalizeDraft } from "@/lib/reviews/ai-draft-rules";
import { youtubeWatchUrl } from "@/lib/reviews/youtube-match";

/**
 * Draf ringkasan ulasan dari video YouTube dengan AI (permintaan PO, 17
 * November 2026).
 *
 * OpenRouter meneruskan tautan YouTube ke Gemini lewat penyedia Google AI
 * Studio (bagian pesan `video_url`; Vertex tidak menerima tautan video).
 * Model menonton videonya sendiri, jadi tidak perlu transkrip atau
 * pengambilan dari YouTube di server kita.
 *
 * Hasilnya hanya DRAF yang mengisi formulir admin. Admin tetap membaca,
 * mengoreksi, dan menekan "Terbitkan" (PRD FR-07: ringkasan ditulis dan
 * diputuskan admin); tidak ada yang terbit otomatis. Model diminta
 * memparafrasekan, bukan menyalin ucapan reviewer (PRD §6).
 *
 * Kegagalan (video terlalu panjang, penyedia menolak, waktu habis) tidak
 * menghalangi apa pun: admin menulis manual seperti sebelumnya
 * (aturan system design 7: timeout, percobaan ulang terbatas, cadangan).
 */

export const VIDEO_DRAFT_LIMITS = {
  /** Draf per admin per hari (dihitung di database bersama kuota AI). */
  perAdminDaily: 20,
  /** Draf per admin per menit (memori instance). */
  perMinute: 3,
  /**
   * Video bisa belasan menit; menonton butuh waktu lebih lama dari chat.
   * WAJIB di bawah `maxDuration` halaman /admin/ulasan/[id] (120 s) dengan
   * sisa untuk audit dan render: 19 Nov 2026 produksi mati di 120 s karena
   * 100 s x 2 percobaan, dan admin melihat halaman galat, bukan pesan.
   */
  timeoutMs: 95_000,
  maxOutputTokens: 1500,
} as const;

/** Bisa diganti tanpa mengubah kode; harus model Gemini yang menerima video. */
function videoModel(): string {
  return process.env.OPENROUTER_VIDEO_MODEL || "google/gemini-2.5-flash";
}

export const draftSchema = z.object({
  /** Video memang membahas produk ini (bukan sekadar menyebut). */
  relevan: z.boolean(),
  aspek: z.enum(["umum", "kamera"]),
  ringkasan: z.string().max(1200),
  kelebihan: z.array(z.string().min(2).max(220)).max(6),
  kekurangan: z.array(z.string().min(2).max(220)).max(6),
  /** Cara reviewer menguji (lama pemakaian, game yang dicoba); kosong bila tidak disebut. */
  konteks: z.string().max(300),
  /** Menit bagian yang paling relevan, "m:ss"; kosong bila tidak yakin. */
  menit: z.string().max(8),
  /** Reviewer menyebut sponsor, kerja sama, atau unit dari brand. */
  bersponsor: z.boolean(),
  /** Hal yang tidak pasti atau perlu dicek admin, plus peringatan kata penilaian. */
  catatan: z.string().max(600),
});
export type VideoDraft = z.infer<typeof draftSchema>;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["relevan", "aspek", "ringkasan", "kelebihan", "kekurangan", "konteks", "menit", "bersponsor", "catatan"],
  properties: {
    relevan: { type: "boolean" },
    aspek: { type: "string", enum: ["umum", "kamera"] },
    ringkasan: { type: "string" },
    kelebihan: { type: "array", items: { type: "string" }, maxItems: 6 },
    kekurangan: { type: "array", items: { type: "string" }, maxItems: 6 },
    konteks: { type: "string" },
    menit: { type: "string" },
    bersponsor: { type: "boolean" },
    catatan: { type: "string" },
  },
} as const;

function buildPrompt({ productName, channel, title, aspect }: DraftInput): string {
  const focus =
    aspect === "kamera"
      ? "FOKUS ASPEK KAMERA: hasil foto dan video (siang, malam, potret, zoom, stabilisasi, kamera depan) menurut reviewer."
      : "FOKUS ASPEK UMUM: pemakaian harian, performa dan game, baterai dan pengisian, layar, desain, panas.";
  return `Kamu membantu admin CekHarga, situs bantu pilih HP di Indonesia, menyiapkan DRAF ringkasan ulasan dari video YouTube di bawah. Admin akan membaca dan mengoreksi drafmu sebelum terbit.

Produk: ${productName}
Channel: ${channel}
Judul video: ${title}
${focus}

ATURAN:
- Tulis dalam bahasa Indonesia yang wajar, dengan kalimatmu sendiri. JANGAN menyalin ucapan reviewer kata per kata dan jangan membuat kutipan panjang.
- Hanya isi yang benar-benar disampaikan reviewer di video ini. Jangan menambah spesifikasi, harga, atau pendapatmu sendiri. Bila sesuatu tidak dibahas, jangan dikarang.
- "ringkasan": 2 sampai 4 kalimat, minimal 40 karakter, inti penilaian reviewer untuk fokus di atas.
- "kelebihan" dan "kekurangan": poin pendek menurut reviewer (paling panjang sekitar 25 kata per poin), masing-masing paling banyak 6. Kosongkan bila tidak disebut.
- "konteks": cara reviewer menguji (mis. "dipakai 2 minggu, main Genshin 1 jam"), kosong bila tidak disebut.
- "menit": SATU waktu bagian video yang paling relevan dengan fokus, format m:ss (bukan rentang, bukan 0:00). Kosongkan bila tidak yakin.
- "bersponsor": true bila reviewer menyebut sponsor, kerja sama berbayar, atau "dikirim oleh brand".
- "relevan": false bila video ternyata bukan ulasan produk ini (mis. produk lain, unboxing tanpa penilaian, kompilasi). Bila false, isi "catatan" dengan alasannya.
- Tanpa skor, peringkat, atau kata "terbaik", "termurah", "paling bagus", "juara", "nomor satu", juga bila reviewer sendiri mengucapkannya. Ganti dengan pengamatan konkret, mis. "zoom 10x masih tajam menurut reviewer", bukan "zoom terbaik".
- "catatan": hal yang tidak yakin atau perlu dicek admin (mis. "reviewer memakai varian 12/512 GB"). Kosong bila tidak ada.`;
}

export type DraftInput = {
  youtubeId: string;
  productName: string;
  channel: string;
  title: string;
  aspect: "umum" | "kamera";
};

export async function draftFromVideo(input: DraftInput): Promise<{ ok: true; draft: VideoDraft } | { ok: false; reason: string }> {
  try {
    const completion = await getAiClient().chat.completions.create(
      {
        model: videoModel(),
        max_tokens: VIDEO_DRAFT_LIMITS.maxOutputTokens,
        temperature: 0.3,
        // Hanya Google AI Studio yang menerima tautan YouTube (dokumentasi OpenRouter).
        ...({ provider: { only: ["google-ai-studio"] }, reasoning: { enabled: false } } as Record<string, unknown>),
        response_format: { type: "json_schema", json_schema: { name: "draf_ulasan", strict: true, schema: JSON_SCHEMA } },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt(input) },
              // Bagian `video_url` OpenRouter; tipe SDK OpenAI belum mengenalnya.
              { type: "video_url", video_url: { url: youtubeWatchUrl(input.youtubeId) } } as never,
            ],
          },
        ],
      },
      // Tanpa percobaan ulang otomatis: menonton video ditagih per percobaan,
      // dan dua percobaan tidak muat di batas 120 s fungsi Vercel. Admin bisa
      // menekan tombolnya lagi bila mau.
      { timeout: VIDEO_DRAFT_LIMITS.timeoutMs, maxRetries: 0 }
    );
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { ok: false, reason: "Model tidak mengembalikan draf." };
    // Keluaran dirapikan ke batas formulir, bukan ditolak utuh (uji coba 18 Nov
    // 2026: 2 dari 4 draf terbuang hanya karena satu kolom kepanjangan).
    let json: unknown;
    try {
      json = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      console.error("[ulasan-ai] draf bukan JSON yang utuh (mungkin terpotong batas token).");
      return { ok: false, reason: "Draf dari model terpotong. Coba sekali lagi atau tulis manual." };
    }
    const normalized = normalizeDraft(json, input.aspect);
    const parsed = normalized ? draftSchema.safeParse(normalized) : null;
    if (!parsed?.success) {
      // Jalur kolom yang gagal saja, tanpa isi draf (untuk diagnosis).
      console.error("[ulasan-ai] draf tidak bisa dipakai:", parsed ? parsed.error.issues.map((i) => i.path.join(".")).join(", ") : "tanpa isi");
      return { ok: false, reason: "Draf dari model tidak bisa dipakai. Coba sekali lagi atau tulis manual." };
    }
    return { ok: true, draft: parsed.data };
  } catch (error) {
    const status = (error as { status?: number })?.status;
    const name = (error as Error)?.name ?? "";
    console.error("[ulasan-ai] draf video gagal:", status ?? (name || "galat"));
    const timedOut = /timeout/i.test(name) || /timed out/i.test((error as Error)?.message ?? "");
    return {
      ok: false,
      reason: timedOut
        ? "Model belum selesai menonton video dalam 95 detik, biasanya karena videonya panjang. Coba sekali lagi, pilih video yang lebih pendek, atau tulis ringkasan manual."
        : status === 402
          ? "OpenRouter menolak: input video butuh sisa batas kredit kunci API minimal $1. Pemilik akun perlu menaikkan batas kunci di openrouter.ai/settings/keys. Sementara itu tulis ringkasan manual."
          : status === 413 || status === 400
          ? "Video tidak bisa diproses model (mungkin terlalu panjang atau dibatasi). Tulis ringkasan manual."
          : "Layanan AI sedang tidak bisa memproses video ini. Coba lagi nanti atau tulis manual.",
    };
  }
}
