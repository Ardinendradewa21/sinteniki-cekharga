import type { Collected } from "@/lib/assistant/ai/chat-state";
import { formatIdr } from "@/lib/catalog/pricing";

/**
 * Kebijakan dialog Tanya AI (rancangan §3.2). Modul murni, diputuskan KODE,
 * bukan model, supaya konsisten dan bisa diuji.
 *
 * Prinsipnya "tampilkan dulu, sempurnakan kemudian":
 * - Hasil keluar begitu budget diketahui bersama kegunaan atau prioritas, atau
 *   paling lambat di pesan ketiga pengguna bila sudah ada informasi apa pun.
 *   Dengan begitu paling banyak dua pertanyaan sebelum hasil pertama.
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

export type Focus = "budget" | "kegunaan" | "prioritas" | "penyempurnaan";

/** Hal yang paling perlu ditanyakan berikutnya; satu saja. */
export function nextFocus(collected: Collected, hasResult: boolean): Focus {
  if (hasResult) return "penyempurnaan";
  if (collected.budgetIdr === null) return "budget";
  if (collected.activities.length === 0 && collected.priorities.length === 0) return "kegunaan";
  if (collected.priorities.length === 0) return "prioritas";
  return "penyempurnaan";
}

export function shouldSearch(
  collected: Collected,
  { userTurns, modelEnough, hasResult }: { userTurns: number; modelEnough: boolean; hasResult: boolean }
): boolean {
  if (hasResult) return true;
  const hasUse = collected.activities.length > 0 || collected.priorities.length > 0;
  if (collected.budgetIdr !== null && hasUse) return true;
  const anything =
    collected.budgetIdr !== null || hasUse || collected.brands.length > 0 || collected.requirements.length > 0;
  if (modelEnough && anything) return true;
  return userTurns >= 3 && anything;
}

/**
 * Pilihan cepat setelah hasil tampil: penyempurnaan yang paling sering
 * dibutuhkan dan belum dipakai. Ditulis sebagai ucapan pengguna karena chip
 * terkirim sebagai pesannya.
 */
export function refinementSuggestions(collected: Collected): string[] {
  const out: string[] = [];
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
