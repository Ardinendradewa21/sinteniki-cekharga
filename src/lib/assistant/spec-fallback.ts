import { guideAnswer, matchSpecGuides } from "@/lib/catalog/spec-guide";

/** Penanda kalimat bertanya soal arti/fungsi, bukan meminta dicarikan. */
const QUESTION = /\?|\b(apa|apaan|bedanya|beda|itu|kerasa|penting|perlu|maksudnya|artinya|gimana|bagaimana|fungsi|buat apa|guna)\b/;
const SEARCH = /\b(cari|carikan|cariin|rekomendasi|rekomendasiin|saran|budget|juta|jt|ribu|beli|mending)\b/;

/**
 * Kalimat bertanya soal arti/fungsi spesifikasi, bukan meminta dicarikan.
 * Dipakai juga untuk memutuskan kapan potongan bank materi ikut dikirim ke
 * model: di permintaan mencari, potongan itu memancing istilah sistem
 * ("bukan syarat wajib") ke balasan (set emas 18 Nov 2026).
 */
export function looksLikeSpecQuestion(text: string): boolean {
  const normalized = text.normalize("NFKC").toLocaleLowerCase("id-ID");
  return QUESTION.test(normalized) && !SEARCH.test(normalized);
}

/**
 * Jawaban cadangan Tanya AI dari bank materi spesifikasi saat layanan AI
 * gagal (persetujuan PO 18 Nov 2026). Modul murni.
 *
 * Hanya untuk pertanyaan umum yang jelas: ada kata tanya, cocok dengan
 * atribut di bank materi, tidak menyebut produk katalog, dan bukan permintaan
 * mencari (budget, "carikan"). Selain itu `null`, dan percakapan menampilkan
 * galat + coba lagi seperti biasa (tidak menebak maksud tanpa model).
 */
export function specQuestionFallback(text: string, mentionsProduct: boolean): string | null {
  if (mentionsProduct || !looksLikeSpecQuestion(text)) return null;
  const answer = guideAnswer(matchSpecGuides(text));
  if (!answer) return null;
  return `${answer}\n\nLayanan AI sedang tidak tersedia, jadi jawaban ini diambil dari panduan spesifikasi CekHarga. Kalau mau, aku bisa carikan HP setelah layanan pulih.`;
}
