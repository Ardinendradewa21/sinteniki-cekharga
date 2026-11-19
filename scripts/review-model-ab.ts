/**
 * Uji banding model draf ulasan dari video (RV-02, keputusan PO 19 Nov 2026).
 *
 *   node --env-file=.env.local --import ./scripts/tests/register.mjs \
 *     --experimental-strip-types scripts/review-model-ab.ts <youtubeId> "<produk>" "<channel>" "<judul>" [model...]
 *
 * BERBIAYA: satu panggilan video per model (perkiraan $0,07 sampai $0,45 untuk
 * video 12 menit). Jalankan hanya atas persetujuan PO. Model dipanggil berurutan,
 * bukan paralel, supaya sisa batas kunci terbaca jujur di tiap langkah. Hasil
 * ditulis ke qa-shots/ (tidak masuk Git), tidak ke database.
 */
import fs from "node:fs";

import { draftReview } from "@/lib/reviews/ai-draft";

const [youtubeId, productName, channel, title, ...models] = process.argv.slice(2);
if (!youtubeId || !productName || !channel || !title) {
  console.error("Pemakaian: <youtubeId> <produk> <channel> <judul> [model...]");
  process.exit(1);
}
const candidates = models.length ? models : ["google/gemini-3.8-flash", "google/gemini-4-carbon", "google/gemini-4-argon"];

async function keyRemaining(): Promise<number | null> {
  const response = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } });
  const json = (await response.json()) as { data?: { limit_remaining?: number } };
  return json.data?.limit_remaining ?? null;
}

const report: string[] = [`# Uji banding model draf ulasan`, ``, `Video: https://www.youtube.com/watch?v=${youtubeId}`, `Produk: ${productName} · Channel: ${channel}`, ``];
for (const model of candidates) {
  const before = await keyRemaining();
  if (before !== null && before < 1) {
    console.log(`${model}: dilewati, sisa batas kunci $${before.toFixed(2)} (< $1 untuk input video)`);
    report.push(`## ${model}`, ``, `Dilewati: sisa batas kunci $${before.toFixed(2)}.`, ``);
    continue;
  }
  const result = await draftReview({ source: { kind: "video", youtubeId }, productName, channel, title, aspect: "umum", model });
  const meta = result.meta;
  const line = `${model}: ${result.ok ? "OK" : `GAGAL (${result.reason})`} · ${meta ? `${(meta.ms / 1000).toFixed(0)} dtk · $${meta.costUsd?.toFixed(3) ?? "?"} · token ${meta.promptTokens ?? "?"}/${meta.completionTokens ?? "?"}` : ""}`;
  console.log(line);
  report.push(`## ${model}`, ``, line, ``);
  if (result.ok) {
    const d = result.draft;
    const pts = (list: typeof d.kelebihan) => list.map((p) => `- ${p.poin}${p.menit ? ` [${p.menit}]` : ""}`).join("\n");
    report.push(
      `**Intinya:** ${d.intinya}`,
      ``,
      `**Cocok untuk:** ${d.cocok_untuk.join(", ") || "-"} · **Kurang cocok:** ${d.kurang_cocok.join(", ") || "-"}`,
      ``,
      `**Kelebihan**`,
      pts(d.kelebihan) || "-",
      ``,
      `**Kekurangan**`,
      pts(d.kekurangan) || "-",
      ``,
      `**Ringkasan:** ${d.ringkasan}`,
      ``,
      `**Konteks:** ${d.konteks || "-"} · **Menit utama:** ${d.menit || "-"} · **Bersponsor:** ${d.bersponsor ? "ya" : "tidak"}`,
      ``,
      `**Catatan:** ${d.catatan || "-"}`,
      ``
    );
  }
}
fs.mkdirSync("qa-shots/calda/RV-02", { recursive: true });
fs.writeFileSync("qa-shots/calda/RV-02/uji-banding-model.md", report.join("\n"));
console.log("Hasil: qa-shots/calda/RV-02/uji-banding-model.md");
