/**
 * Evaluasi Tanya AI terhadap set emas (rancangan §3.7).
 *
 * Memanggil model sungguhan, jadi butuh OPENROUTER_API_KEY dan memakai kuota
 * berbayar (satu panggilan per kasus). Jalankan setiap kali prompt, model,
 * atau kamus sinonim berubah:
 *
 *   pnpm test:assistant-eval
 *
 * Yang diukur: akurasi ekstraksi per field yang diharapkan, dan pelanggaran
 * gaya pada balasan (menyebut harga, "terbaik/termurah", istilah sistem).
 */
import fs from "node:fs";

import { runChatTurn } from "@/lib/assistant/ai/chat";
import { EMPTY_COLLECTED, type Collected } from "@/lib/assistant/ai/chat-state";
import { nextFocus } from "@/lib/assistant/dialog-policy";
import { guardRequirements, mergeHints, readHints } from "@/lib/assistant/hints";

type Expect = Partial<Collected> & { priorities_awal?: string; requirements_tidak?: string[] };
const { kasus } = JSON.parse(fs.readFileSync("scripts/tests/fixtures/assistant-eval.json", "utf8")) as {
  kasus: { id: string; pesan: string; harap: Expect }[];
};

// Harga produk di balasan berbentuk "Rp…"; menyebut budget pengguna ("2,5 juta") bukan pelanggaran.
const FORBIDDEN = [/\bterbaik\b/i, /\btermurah\b/i, /batas keras/i, /syarat wajib/i, /Rp\s?\d/i, /\bseharga\b/i];
const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value) => b.map((x) => x.toLowerCase()).includes(value.toLowerCase()));
const includesAll = (actual: readonly string[], expected: readonly string[]) =>
  expected.every((value) => actual.map((x) => x.toLowerCase()).includes(value.toLowerCase()));

let checks = 0;
let passed = 0;
let styleIssues = 0;
let failures = 0;
let openers = 0;
const latencies: number[] = [];

for (const item of kasus) {
  const hints = readHints(item.pesan);
  const started = Date.now();
  const turn = await runChatTurn([], item.pesan, {
    collected: EMPTY_COLLECTED,
    focus: nextFocus(mergeHints(EMPTY_COLLECTED, hints), false),
    hasResult: false,
  });
  latencies.push(Date.now() - started);
  if (!turn.ok) {
    failures += 1;
    console.log(`✗ ${item.id}: gagal (${turn.reason})`);
    continue;
  }
  const got = mergeHints(guardRequirements([], turn.collected, item.pesan), hints);
  const wrong: string[] = [];
  const check = (label: string, ok: boolean) => {
    checks += 1;
    if (ok) passed += 1;
    else wrong.push(label);
  };
  const h = item.harap;
  if (h.budgetIdr !== undefined) check(`budget ${got.budgetIdr}`, got.budgetIdr === h.budgetIdr);
  if (h.budgetIsHard !== undefined) check(`budgetIsHard ${got.budgetIsHard}`, got.budgetIsHard === h.budgetIsHard);
  if (h.activities) check(`activities ${got.activities.join("+")}`, includesAll(got.activities, h.activities));
  if (h.priorities_awal) check(`prioritas awal ${got.priorities[0]}`, got.priorities[0] === h.priorities_awal);
  if (h.priorities) check(`priorities ${got.priorities.join(">")}`, includesAll(got.priorities, h.priorities));
  if (h.requirements) check(`requirements ${got.requirements.join("+")}`, includesAll(got.requirements, h.requirements));
  if (h.requirements_tidak) check(`requirements ${got.requirements.join("+")}`, !h.requirements_tidak.some((r) => got.requirements.includes(r as never)));
  if (h.brands) check(`brands ${got.brands.join("+")}`, sameSet(got.brands, h.brands));
  if (h.brandsOnly !== undefined) check(`brandsOnly ${got.brandsOnly}`, got.brandsOnly === h.brandsOnly);
  if (h.avoidBrands) check(`avoidBrands ${got.avoidBrands.join("+")}`, sameSet(got.avoidBrands, h.avoidBrands));

  // Mengulang budget yang ditulis pengguna sendiri ("Rp4.500.000") bukan menyebut harga produk.
  const replyWithoutUserBudget = turn.reply.replace(/Rp\s?[\d.,]+/gi, (amount) =>
    item.pesan.replace(/\s/g, "").toLowerCase().includes(amount.replace(/\s/g, "").toLowerCase()) ? "" : amount
  );
  const style = FORBIDDEN.filter((pattern) => pattern.test(replyWithoutUserBudget)).map(String);
  if (/^(oke|ok|siap|sip)\b/i.test(turn.reply.trim())) openers += 1;
  if (/\b(gue|gw|lo|lu)\b/i.test(turn.reply) && !/\b(gue|gw|lo|lu)\b/i.test(item.pesan)) style.push("memakai gue/lo padahal pengguna tidak");
  if (style.length > 0) styleIssues += 1;
  console.log(
    `${wrong.length === 0 && style.length === 0 ? "✓" : "✗"} ${item.id.padEnd(18)} ${wrong.join("; ")}${style.length ? ` | gaya: ${style.join(", ")}` : ""}\n    "${turn.reply}"`
  );
}

const accuracy = checks === 0 ? 0 : Math.round((passed / checks) * 1000) / 10;
const openerShare = Math.round((openers / kasus.length) * 100);
const sorted = [...latencies].sort((a, b) => a - b);
const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
console.log(`Model: ${process.env.OPENROUTER_CHAT_MODEL || "bawaan"}. Latensi median ${pct(0.5)} ms, p90 ${pct(0.9)} ms, maks ${sorted.at(-1) ?? 0} ms.`);
console.log(`\nAkurasi ekstraksi: ${passed}/${checks} (${accuracy}%). Pelanggaran gaya: ${styleIssues}. Pembuka "Oke/Siap": ${openerShare}%. Gagal panggil: ${failures}.`);
// Pembuka yang sama di lebih dari sepertiga balasan terasa seperti templat.
if (accuracy < 90 || styleIssues > 0 || failures > 0 || openerShare > 33) process.exitCode = 1;
