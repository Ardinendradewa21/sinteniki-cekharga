import type { ReviewSummary } from "@/lib/catalog/schema";

export type ReviewTopic = "foto-malam" | "game" | "daya-tahan-baterai";
export type RequiredFeature = "nfc" | "5g";

export type SemanticNeeds = {
  maxPriceIdr: number | null;
  maxPriceExclusive: boolean;
  minRamGb: number | null;
  minStorageGb: number | null;
  requiredFeatures: RequiredFeature[];
  reviewTopics: ReviewTopic[];
  appliedLabels: string[];
  cautions: string[];
  /**
   * Sisa kalimat setelah frasa syarat yang dikenali di atas dibuang. Inilah
   * yang dicocokkan sebagai kata kunci (nama, merek, tag spesifikasi), supaya
   * "Samsung 5G di bawah 5 juta" tidak mencari kata "juta" di nama produk.
   */
  keywordText: string;
};

const NEGATION = String.raw`(?:tanpa|tidak (?:ada|perlu|butuh)|bukan|nggak (?:ada|perlu|butuh))\s+`;

/** Kata topik yang sudah ditangani sebagai topik ulasan atau peringatan. */
const TOPIC_WORDS =
  /\b(?:foto|kamera|fotografi|malam|low.light|game|gaming|bermain|baterai|awet|tahan lama|seharian)\b/g;

function priceFromPhrase(value: string, unit?: string): number | null {
  const multiplier = /^(juta|jt)$/.test(unit ?? "")
    ? 1_000_000
    : /^(ribu|rb)$/.test(unit ?? "")
      ? 1_000
      : 1;
  const amount = multiplier === 1
    ? Number(value.replace(/[.,]/g, ""))
    : Number(value.replace(",", "."));
  const price = Math.round(amount * multiplier);
  // Tanpa satuan, angka kecil seperti "3" tidak boleh dianggap Rp3.
  return Number.isFinite(price) && price >= 100_000 && price <= 1_000_000_000
    ? price
    : null;
}

function minimumCapacity(text: string, nouns: string): number | null {
  const afterNoun = new RegExp(
    `(?:${nouns})\\s*(?:minimal|min|setidaknya|paling sedikit)\\s*(\\d{1,4})\\s*(?:gb|giga)?\\b`
  );
  const beforeNoun = new RegExp(
    `(?:minimal|min|setidaknya|paling sedikit)\\s*(\\d{1,4})\\s*(?:gb|giga)\\s*(?:${nouns})\\b`
  );
  const value = Number((afterNoun.exec(text) ?? beforeNoun.exec(text))?.[1]);
  return Number.isInteger(value) && value > 0 && value <= 2048 ? value : null;
}

/**
 * Memahami hanya syarat yang punya padanan data. Ini BUKAN model AI dan tidak
 * menebak kualitas kamera/performa dari megapiksel, mAh, atau nama chipset.
 */
export function interpretCatalogNeeds(input: string): SemanticNeeds {
  const text = input.normalize("NFKC").toLocaleLowerCase("id-ID").replace(/\s+/g, " ").trim();
  const appliedLabels: string[] = [];
  const cautions: string[] = [];
  const requiredFeatures: RequiredFeature[] = [];
  const reviewTopics: ReviewTopic[] = [];

  const pricePhrase = /(maksimal|di bawah|kurang dari|tidak lebih dari|paling tinggi)\s*(?:(?:harga|budget|anggaran)\s*)?(?:rp\.?\s*)?(\d[\d.,]*)\s*(juta|jt|ribu|rb)?\b/.exec(text);
  const maxPriceIdr = pricePhrase ? priceFromPhrase(pricePhrase[2], pricePhrase[3]) : null;
  const maxPriceExclusive = maxPriceIdr !== null &&
    (pricePhrase?.[1] === "di bawah" || pricePhrase?.[1] === "kurang dari");
  if (maxPriceIdr !== null) {
    appliedLabels.push(
      `${maxPriceExclusive ? "Harga di bawah" : "Harga maksimal"} Rp${maxPriceIdr.toLocaleString("id-ID")}`
    );
  } else if (/\b(?:budget|anggaran|harga)\b/.test(text) && /\d/.test(text)) {
    cautions.push("Anggaran belum disebut sebagai batas maksimal, jadi tidak dipakai untuk menyaring harga.");
  }

  const minRamGb = minimumCapacity(text, "ram");
  if (minRamGb !== null) appliedLabels.push(`RAM minimal ${minRamGb} GB`);

  const minStorageGb = minimumCapacity(text, "penyimpanan|storage|memori internal");
  if (minStorageGb !== null) appliedLabels.push(`Penyimpanan minimal ${minStorageGb} GB`);

  if (/\bnfc\b/.test(text) && !/(?:tanpa|tidak (?:ada|perlu|butuh)|bukan|nggak (?:ada|perlu|butuh))\s+nfc\b/.test(text)) {
    requiredFeatures.push("nfc");
    appliedLabels.push("NFC tercatat tersedia");
  }
  if (/\b5g\b/.test(text) && !/(?:tanpa|tidak (?:ada|perlu|butuh)|bukan|nggak (?:ada|perlu|butuh))\s+5g\b/.test(text)) {
    requiredFeatures.push("5g");
    appliedLabels.push("5G tercatat tersedia");
  }

  if (/(?:foto|kamera|fotografi).{0,24}(?:malam|low.light)|(?:malam|low.light).{0,24}(?:foto|kamera|fotografi)/.test(text)) {
    reviewTopics.push("foto-malam");
    appliedLabels.push("Cari ulasan reviewer tentang foto malam");
  } else if (/\b(?:foto|kamera|fotografi)\b/.test(text)) {
    cautions.push("Kualitas foto tidak bisa dipastikan dari angka megapiksel; belum dijadikan filter otomatis.");
  }

  if (/\b(?:game|gaming|bermain)\b/.test(text) && !/(?:bukan|tanpa|tidak (?:untuk|main|bermain))\s+(?:game|gaming)\b/.test(text)) {
    reviewTopics.push("game");
    appliedLabels.push("Cari ulasan reviewer tentang bermain game");
  }
  if (/(?:baterai).{0,24}(?:awet|tahan lama|seharian)|(?:awet|tahan lama|seharian).{0,24}(?:baterai)/.test(text)) {
    reviewTopics.push("daya-tahan-baterai");
    appliedLabels.push("Cari ulasan reviewer tentang daya tahan baterai");
  } else if (/\bbaterai\b/.test(text)) {
    cautions.push("Daya tahan nyata tidak bisa dipastikan dari kapasitas mAh saja.");
  }

  // Buang frasa yang sudah menjadi syarat, sisanya kata kunci.
  let keywordText = text;
  if (pricePhrase) keywordText = keywordText.replace(pricePhrase[0], " ");
  for (const nouns of ["ram", "penyimpanan|storage|memori internal"]) {
    keywordText = keywordText
      .replace(new RegExp(`(?:${nouns})\\s*(?:minimal|min|setidaknya|paling sedikit)\\s*\\d{1,4}\\s*(?:gb|giga)?\\b`, "g"), " ")
      .replace(new RegExp(`(?:minimal|min|setidaknya|paling sedikit)\\s*\\d{1,4}\\s*(?:gb|giga)\\s*(?:${nouns})\\b`, "g"), " ");
  }
  keywordText = keywordText
    .replace(new RegExp(`${NEGATION}(?:nfc|5g)\\b`, "g"), " ")
    .replace(/\b(?:nfc|5g)\b/g, " ")
    .replace(TOPIC_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { maxPriceIdr, maxPriceExclusive, minRamGb, minStorageGb, requiredFeatures, reviewTopics, appliedLabels, cautions, keywordText };
}

/** Hanya topik yang benar-benar dibahas dalam ulasan terbit yang boleh cocok. */
export function reviewMatchesTopic(review: ReviewSummary, topic: ReviewTopic): boolean {
  const aspect = review.aspect.toLocaleLowerCase("id-ID");
  const content = [review.summary, ...review.strengths, ...review.limitations]
    .join(" ")
    .toLocaleLowerCase("id-ID");

  switch (topic) {
    case "foto-malam":
      return /kamera|foto/.test(aspect) && /malam|low.light/.test(content);
    case "game":
      return /performa|game|gaming/.test(aspect) && /game|bermain|permainan/.test(content);
    case "daya-tahan-baterai":
      return /baterai/.test(aspect) && /bertahan|daya tahan|awet|sehari/.test(content);
  }
}
