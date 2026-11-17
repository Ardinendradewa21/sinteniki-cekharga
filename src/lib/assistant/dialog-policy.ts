import type { Collected } from "@/lib/assistant/ai/chat-state";
import { formatIdr } from "@/lib/catalog/pricing";

/**
 * Kebijakan dialog Tanya AI (rancangan §3.2, dirombak VD-08). Modul murni,
 * diputuskan KODE, bukan model, supaya konsisten dan bisa diuji.
 *
 * VD-08 (17 November 2026): uji langsung menunjukkan setiap pertanyaan
 * terbuka ("hp buat gaming yang bagus apa?", "AMOLED vs IPS?", "Redmi Note 17
 * vs A6 Pro?") dijawab dengan "budget berapa?". Penyebabnya: semua pesan
 * dipaksa masuk alur pengumpulan kebutuhan dan budget selalu ditanya dulu.
 * Sekarang setiap pesan dikenali maksudnya (router, pola "routing" dari
 * Anthropic "Building effective agents"), dan:
 *
 * - Pertanyaan tentang produk yang disebut dijawab dari data katalog.
 * - Pertanyaan umum dijawab langsung, tanpa ditutup pertanyaan budget.
 * - Pencarian langsung menampilkan hasil begitu ada SATU sinyal kebutuhan
 *   apa pun (kegunaan, prioritas, merek, syarat, atau budget). Budget tidak
 *   wajib: tanpa budget, mesin mengurutkan dari kecocokan, lalu budget
 *   ditawarkan sebagai pilihan cepat untuk mempersempit. Bertanya hanya bila
 *   pesannya benar-benar kosong sinyal, paling banyak sekali.
 * - Budget yang tidak dinyatakan tegas dianggap kisaran (±15%). Pertanyaan
 *   "batas keras atau tidak" dan "ada syarat wajib?" tidak lagi diajukan;
 *   syarat wajib ditawarkan sebagai pilihan cepat setelah hasil tampil.
 * - Setelah hasil tampil, setiap pesan menyempurnakan pencarian.
 */

/**
 * Permintaan membandingkan dua kandidat bernomor ("bandingkan 1 dan 3",
 * "#2 vs #4", "nomor 1 sama 2"). Dibaca kode supaya tautan perbandingan
 * tidak bergantung pada model. Mengembalikan null bila bukan permintaan itu.
 */
export function compareRequest(text: string, available: number): [number, number] | null {
  const t = text.toLowerCase();
  if (!/\b(bandingk\w*|compare|vs|versus|beda(nya)?|bedain)\b/.test(t)) return null;
  const numbers = [...t.matchAll(/(?:#|nomor |no\.? ?)?\b(\d{1,2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((n) => n >= 1 && n <= available);
  const unique = [...new Set(numbers)];
  return unique.length >= 2 ? [unique[0]!, unique[1]!] : null;
}

/**
 * Fokus untuk model pemahaman: "terbuka" = belum ada hasil, model boleh
 * bertanya SATU hal yang paling membantu (bukan otomatis budget);
 * "penyempurnaan" = hasil sudah tampil, pesan berikutnya mengubah pencarian.
 */
export type Focus = "terbuka" | "penyempurnaan";

export function nextFocus(_collected: Collected, hasResult: boolean): Focus {
  return hasResult ? "penyempurnaan" : "terbuka";
}

/** Maksud pesan, dikenali model pemahaman. */
export const INTENTS = ["cari", "produk", "bandingkan", "umum", "lainnya"] as const;
export type Intent = (typeof INTENTS)[number];

/**
 * Tindakan giliran ini:
 * - `ask`: bertanya satu hal (pesan tanpa sinyal kebutuhan sama sekali).
 * - `search`: jalankan mesin rekomendasi dan tampilkan kandidat.
 * - `product`: jawab dari data produk yang disebut (satu produk atau perbandingan).
 * - `missing-product`: produk yang ditanyakan tidak ada di katalog.
 * - `general`: jawab pertanyaan umum seputar HP, tanpa mencari.
 * - `chat`: sapaan atau di luar topik; jawab singkat dan sebutkan kemampuan.
 */
export type TurnAction = "ask" | "search" | "product" | "missing-product" | "general" | "chat";

export function hasNeedSignal(collected: Collected): boolean {
  return (
    collected.budgetIdr !== null ||
    collected.activities.length > 0 ||
    collected.priorities.length > 0 ||
    collected.brands.length > 0 ||
    collected.requirements.length > 0
  );
}

export function decideTurn({
  intent,
  mentions,
  namedProducts,
  collected,
  hasResult,
  userTurns,
  modelEnough,
}: {
  intent: Intent;
  /** Produk katalog yang dikenali kode dari pesan ini. */
  mentions: number;
  /** Nama produk yang menurut model disebut pengguna (bisa di luar katalog). */
  namedProducts: number;
  collected: Collected;
  hasResult: boolean;
  /** Jumlah pesan pengguna, termasuk pesan ini. */
  userTurns: number;
  modelEnough: boolean;
}): TurnAction {
  // Dua produk atau lebih yang disebut = pertanyaan perbandingan, kecuali
  // pengguna jelas minta dicarikan ("yang mirip X dan Y tapi lebih murah").
  if (mentions >= 2 && intent !== "cari") return "product";
  if (mentions === 1 && (intent === "produk" || intent === "bandingkan")) return "product";
  if ((intent === "produk" || intent === "bandingkan") && mentions === 0 && namedProducts > 0) return "missing-product";
  if (intent === "umum") return "general";
  if (intent === "lainnya") return "chat";
  if (hasResult || modelEnough) return "search";
  if (hasNeedSignal(collected) || mentions > 0) return "search";
  // Sudah sekali bertanya dan masih kosong sinyal: tampilkan saja, jangan menginterogasi.
  return userTurns >= 2 ? "search" : "ask";
}

/**
 * Pilihan cepat setelah hasil tampil: penyempurnaan yang paling sering
 * dibutuhkan dan belum dipakai. Ditulis sebagai ucapan pengguna karena chip
 * terkirim sebagai pesannya.
 */
export function refinementSuggestions(collected: Collected): string[] {
  const out: string[] = [];
  // Tanpa budget, hasil diurutkan dari kecocokan saja; budget ditawarkan,
  // bukan ditanyakan.
  if (collected.budgetIdr === null) {
    out.push("Budget sekitar 2 juta", "Budget sekitar 3,5 juta", "Budget sekitar 6 juta");
  }
  if (collected.budgetIdr !== null) out.push("Yang lebih murah");
  if (collected.budgetIdr !== null && collected.budgetIsHard !== true) {
    out.push(`Maksimal ${formatIdr(collected.budgetIdr)}, jangan lewat`);
  }
  if (!collected.requirements.includes("garansi-resmi")) out.push("Wajib garansi resmi");
  if (!collected.requirements.includes("nfc")) out.push("Harus ada NFC");
  if (!collected.priorities.includes("baterai")) out.push("Utamakan baterai awet");
  if (!collected.priorities.includes("kamera")) out.push("Utamakan kamera");
  return out.slice(0, 4);
}
