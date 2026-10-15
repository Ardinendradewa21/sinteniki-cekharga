import {
  MAX_PRIORITIES,
  type ACTIVITIES,
  type PRIORITIES,
  type Requirement,
} from "@/lib/assistant/needs";

/**
 * Kamus sinonim kebutuhan (rancangan Tanya AI §3.3). Modul murni.
 *
 * Model bahasa kadang melewatkan kata sehari-hari ("buat ojol", "Genshin rata
 * kanan", "ortu"). Kamus ini membaca pesan TERAKHIR pengguna dan hanya
 * MENAMBAH kebutuhan yang belum tertangkap, tidak pernah menghapus atau
 * mengganti hasil model. Menambah kosakata cukup di sini, tanpa mengubah prompt.
 *
 * Kata yang didahului penyangkalan ("ga main game", "tanpa NFC") diabaikan.
 * Syarat wajib hanya dibaca bila disertai kata keharusan ("harus NFC", "wajib
 * 5G"), karena syarat wajib membuang kandidat dan tidak boleh ditebak.
 */

type Activity = (typeof ACTIVITIES)[number];
type Priority = (typeof PRIORITIES)[number];

export type Hints = {
  budgetIdr: number | null;
  budgetIsHard: boolean | null;
  activities: Activity[];
  priorities: Priority[];
  requirements: Requirement[];
};

type Rule = { pattern: RegExp; activities?: Activity[]; priorities?: Priority[] };

const RULES: readonly Rule[] = [
  {
    pattern: /\b(genshin|honkai|hsr|zenless|zzz|wuthering|pubg|codm|call of duty|game berat|rata kanan|grafik (tinggi|ultra|max))\b/,
    activities: ["game"],
    priorities: ["performa"],
  },
  { pattern: /\b(ml|mlbb|mobile legends?|free ?fire|ff|roblox|main game|nge-?game|gaming|game)\b/, activities: ["game"] },
  {
    pattern: /\b(ojol|ojek online|driver|grab|gojek|maxim|kurir|gmaps|navigasi)\b/,
    activities: ["baterai", "sosial-media"],
    priorities: ["baterai"],
  },
  { pattern: /\b(tiktok(an)?|konten|vlog|ngevlog|live ?streaming|content creator|selfie|motret|fotografi|foto|kamera)\b/, activities: ["foto"] },
  { pattern: /\bkamera(nya)? (bagus|jernih|oke|mantap|kece|terbaik)\b/, priorities: ["kamera"] },
  { pattern: /\b(orang ?tua|ortu|ibu|bapak|mama|papa|nenek|kakek|lansia|anak|sekolah|pelajar|siswa)\b/, activities: ["sosial-media"] },
  { pattern: /\b(wa|whatsapp|chatting|sosmed|media sosial|instagram|ig|facebook|fb|youtube)\b/, activities: ["sosial-media"] },
  { pattern: /\b(kerja|kantor|meeting|zoom|excel|dokumen|email|multitasking|jualan online)\b/, activities: ["kerja"] },
  {
    pattern: /\b(baterai(nya)? (awet|besar|gede|tahan lama|kuat)|awet|tahan lama|seharian|irit baterai)\b/,
    activities: ["baterai"],
    priorities: ["baterai"],
  },
  { pattern: /\b(ringan|enteng|compact|satu tangan|mungil|ga berat)\b/, priorities: ["ringan"] },
  { pattern: /\b(layar (besar|lebar|gede|mulus|amoled)|nonton|netflix|drakor|film)\b/, priorities: ["layar"] },
  { pattern: /\b(murah|hemat|terjangkau|semurah|paling murah|budget tipis)\b/, priorities: ["harga"] },
];

const MUST = String.raw`(harus|wajib|mesti|pokoknya|perlu|butuh|kudu)( ada| pakai| support| bisa)?`;

const REQUIREMENT_RULES: readonly [RegExp, Requirement][] = [
  [new RegExp(`${MUST} nfc\\b`), "nfc"],
  [new RegExp(`${MUST} (5g|sinyal 5g)\\b`), "5g"],
  [new RegExp(`${MUST} (tahan air|anti air|ip6[78])\\b`), "tahan-air"],
  [new RegExp(`${MUST} (jack|colokan (headset|earphone|audio))\\b`), "jack-audio"],
  [new RegExp(`${MUST} (telefoto|telephoto|zoom optik)\\b`), "telefoto"],
  [new RegExp(`${MUST} (fast charging|ngecas cepat|charging cepat|pengisian cepat)\\b`), "charging-cepat"],
  [/\b(garansi resmi|resmi indonesia|bukan inter|jangan inter)\b/, "garansi-resmi"],
];

const NEGATION = /\b(ga|gak|nggak|enggak|tidak|tak|bukan|tanpa|jarang|ngga|ndak)\s+(\S+\s+)?$/;

/** Cocokkan pola, abaikan kemunculan yang didahului penyangkalan. */
function affirmed(text: string, pattern: RegExp): boolean {
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (const match of text.matchAll(global)) {
    const before = text.slice(Math.max(0, (match.index ?? 0) - 24), match.index);
    if (!NEGATION.test(before)) return true;
  }
  return false;
}

const WORD_NUMBERS: Record<string, number> = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  sejuta: 1,
};

/**
 * Budget dari teks. Rentang ("2-3 juta") memakai batas atasnya sebagai budget
 * kisaran. Mengembalikan null bila tidak ada angka Rupiah yang jelas.
 */
export function readBudget(text: string): { budgetIdr: number; isRange: boolean } | null {
  const t = text.toLowerCase().replace(/rp\.?\s*/g, "");
  const range = t.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)?\s*(?:-|sampai|s\/d|hingga|ke)\s*(\d+(?:[.,]\d+)?)\s*(jt|juta|jtan|jutaan)\b/);
  if (range) return { budgetIdr: Math.round(Number(range[2]!.replace(",", ".")) * 1_000_000), isRange: true };
  const juta = t.match(/(\d+(?:[.,]\d+)?)\s*(jt|juta|jtan|jutaan)\b/);
  if (juta) return { budgetIdr: Math.round(Number(juta[1]!.replace(",", ".")) * 1_000_000), isRange: false };
  const ribu = t.match(/(\d{3,})\s*(rb|ribu|k)\b/);
  if (ribu) return { budgetIdr: Number(ribu[1]) * 1_000, isRange: false };
  const full = t.match(/\b(\d{1,3}(?:[.,]\d{3}){2,})\b/);
  if (full) return { budgetIdr: Number(full[1]!.replace(/[.,]/g, "")), isRange: false };
  const words = t.match(/\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sejuta)( setengah)?( juta)?\b/);
  if (words && (words[3] || words[1] === "sejuta")) {
    const base = WORD_NUMBERS[words[1]!]!;
    return { budgetIdr: Math.round((base + (words[2] ? 0.5 : 0)) * 1_000_000), isRange: false };
  }
  return null;
}

export function readHints(text: string): Hints {
  const t = ` ${text.toLowerCase()} `;
  const activities = new Set<Activity>();
  const priorities: Priority[] = [];
  for (const rule of RULES) {
    if (!affirmed(t, rule.pattern)) continue;
    for (const activity of rule.activities ?? []) activities.add(activity);
    for (const priority of rule.priorities ?? []) if (!priorities.includes(priority)) priorities.push(priority);
  }
  const requirements = REQUIREMENT_RULES.filter(([pattern]) => affirmed(t, pattern)).map(([, requirement]) => requirement);

  const budget = readBudget(text);
  let budgetIsHard: boolean | null = null;
  if (budget) {
    if (/\b(maks|max|maksimal|maksimum|paling mahal|ga boleh lebih|gak boleh lebih|tidak lebih|jangan lebih|di ?bawah|kurang dari|under)\b/.test(t)) {
      budgetIsHard = true;
    } else if (budget.isRange || /\b(sekitar|kisaran|kurang lebih|kurleb|an|range)\b|jtan|jutaan|-an\b/.test(t)) {
      budgetIsHard = false;
    }
  }

  return {
    budgetIdr: budget?.budgetIdr ?? null,
    budgetIsHard,
    activities: [...activities],
    priorities: priorities.slice(0, MAX_PRIORITIES),
    requirements,
  };
}

type Mergeable = {
  budgetIdr: number | null;
  budgetIsHard: boolean | null;
  activities: Activity[];
  priorities: Priority[];
  requirements: Requirement[];
};

const MUST_WORD = /(harus|wajib|mesti|pokoknya|perlu|butuh|kudu|minimal ada)/;

/**
 * Syarat wajib membuang kandidat, jadi syarat BARU dari model hanya diterima
 * bila pesan terakhir memang berisi kata keharusan atau kamus mengenalinya.
 * "Kalau ada NFC bagus sih" pernah dijadikan syarat wajib oleh model.
 */
export function guardRequirements<T extends { requirements: Requirement[] }>(
  previous: readonly Requirement[],
  collected: T,
  text: string
): T {
  const lower = text.toLowerCase();
  const hinted = new Set(readHints(text).requirements);
  const requirements = collected.requirements.filter(
    (requirement) => previous.includes(requirement) || hinted.has(requirement) || MUST_WORD.test(lower)
  );
  return { ...collected, requirements };
}

/** Menambah petunjuk ke kebutuhan hasil model tanpa menimpa yang sudah terisi. */
export function mergeHints<T extends Mergeable>(collected: T, hints: Hints): T {
  const priorities = [...collected.priorities];
  for (const priority of hints.priorities) {
    if (priorities.length < MAX_PRIORITIES && !priorities.includes(priority)) priorities.push(priority);
  }
  return {
    ...collected,
    budgetIdr: collected.budgetIdr ?? hints.budgetIdr,
    // Penanda tegas/kisaran yang tertulis di pesan terakhir lebih bisa dipercaya
    // daripada tebakan model ("2jtan aja" pernah terbaca sebagai batas keras).
    budgetIsHard: hints.budgetIsHard ?? collected.budgetIsHard,
    activities: [...new Set([...collected.activities, ...hints.activities])],
    priorities,
    requirements: [...new Set([...collected.requirements, ...hints.requirements])],
  };
}
