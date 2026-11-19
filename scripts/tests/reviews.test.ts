// Uji deterministik pencocokan video YouTube ke produk (src/lib/reviews/youtube-match.ts).
// Jalankan: pnpm test:reviews
import { test } from "node:test";
import assert from "node:assert/strict";

import { matchVideoTitle, parseYoutubeVideoId, youtubeWatchUrl, type MatchableProduct } from "@/lib/reviews/youtube-match";

// Potongan katalog nyata per 17 Oktober 2026.
const CATALOG: MatchableProduct[] = [
  ["Apple", "iPhone 17"], ["Apple", "iPhone 17 Pro"], ["Apple", "iPhone 17 Pro Max"], ["Apple", "iPhone Air"],
  ["iQOO", "15"], ["iQOO", "15R"], ["iQOO", "Z11"], ["iQOO", "Z11x"],
  ["OPPO", "A6"], ["OPPO", "A6s"], ["OPPO", "A6 Pro"], ["OPPO", "Reno16 F"],
  ["Samsung", "Galaxy A07"], ["Samsung", "Galaxy A07 4G"], ["Samsung", "Galaxy S26 FE"], ["Samsung", "Galaxy S26"],
  ["vivo", "V70"], ["vivo", "X300 Ultra"],
  ["Xiaomi", "17"], ["Xiaomi", "17T"], ["Xiaomi", "17T Pro"], ["Xiaomi", "Redmi 17"], ["Xiaomi", "Poco X8 Pro"],
  ["Xiaomi", "Redmi Note 17"], ["Xiaomi", "Redmi Note 17 4G"], ["Xiaomi", "Redmi Note 17 Pro"], ["Xiaomi", "Redmi Note 17 Pro Max"],
].map(([brand, model]) => ({ id: `${brand} ${model}`, brand, model }));

const ids = (title: string) => matchVideoTitle(title, CATALOG).map((match) => match.productId).sort();

test("nama model utuh: varian Pro/Max/Plus tidak tertukar", () => {
  assert.deepEqual(ids("Unboxing + tes fitur baru iPhone 17 Pro & Pro Max!"), ["Apple iPhone 17 Pro"]);
  assert.deepEqual(ids("Review iPhone 17, worth it?"), ["Apple iPhone 17"]);
  assert.deepEqual(ids("Sang pemecah Rekor - Unboxing Redmi Note 17 Pro Max!"), ["Xiaomi Redmi Note 17 Pro Max"]);
  assert.deepEqual(ids("HP yang biasanya juara rekomendasi - Unboxing Redmi Note 17 Pro 5G!"), ["Xiaomi Redmi Note 17 Pro"]);
});

test("huruf akhiran model bukan model yang sama", () => {
  assert.deepEqual(ids("Review OPPO A6s murah meriah"), ["OPPO A6s"]);
  assert.deepEqual(ids("OPPO A6 Pro vs OPPO A6"), ["OPPO A6", "OPPO A6 Pro"]);
  assert.deepEqual(ids("iQOO Z11x tes game"), ["iQOO Z11x"]);
  assert.deepEqual(ids("Kamera Xiaomi 17T. Ini review jujur gue"), ["Xiaomi 17T"]);
});

test("model angka atau kata umum wajib didahului merek", () => {
  assert.deepEqual(ids("Unboxing Redmi seri murah... Redmi 17!"), ["Xiaomi Redmi 17"]);
  assert.deepEqual(ids("Mending vivo V70 atau vivo V60?"), ["vivo V70"]);
  assert.deepEqual(ids("Review iQOO 15 setelah sebulan"), ["iQOO 15"]);
  assert.deepEqual(ids("V70 vs 15 vs 17, mana yang cocok?"), []);
});

test("yang lebih spesifik menang; tanpa akhiran tetap cocok ke model dasar", () => {
  assert.deepEqual(ids("Review Samsung Galaxy A07 4G | 1 jutaan"), ["Samsung Galaxy A07 4G"]);
  assert.deepEqual(ids("Galaxy A07 5G resmi"), ["Samsung Galaxy A07"]);
  assert.deepEqual(ids("Harga Flagship Ekonomis lagi ga masuk akal... - Galaxy S26 FE!"), ["Samsung Galaxy S26 FE"]);
  assert.deepEqual(ids("Unboxing Midrange jagoan Xiaomi - Redmi Note 17 4G & 5G!"), ["Xiaomi Redmi Note 17 4G"]);
});

test("huruf dan angka menempel dipisah, Shorts berhashtag dilewati", () => {
  assert.deepEqual(ids("Review OPPO Reno 16F tipis banget"), ["OPPO Reno16 F"]);
  assert.deepEqual(ids("Cakeepp abis #pocox8pro #pocoindonesia"), []);
  assert.deepEqual(ids("Xiaomi 17 Ultra Zoom ! #xiaomi17ultra"), []);
  assert.deepEqual(ids("Ketika user kamera ngegeber Poco X8 Pro... cuma tahan 4 jam??"), ["Xiaomi Poco X8 Pro"]);
});

test("saran aspek dan penanda ulasan dari judul", () => {
  const [camera] = matchVideoTitle("In-depth Review vivo X300 Ultra (camera only)", CATALOG);
  assert.equal(camera?.suggestedAspect, "kamera");
  assert.equal(camera?.looksLikeReview, true);
  const [news] = matchVideoTitle("Samsung Galaxy S26 Hadir Resmi di Indonesia!", CATALOG);
  assert.equal(news?.suggestedAspect, "umum");
  assert.equal(news?.looksLikeReview, false);
});

test("tautan YouTube dikenali dalam berbagai bentuk", () => {
  for (const link of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "dQw4w9WgXcQ",
  ]) {
    assert.equal(parseYoutubeVideoId(link), "dQw4w9WgXcQ", link);
  }
  assert.equal(parseYoutubeVideoId("https://evil.example/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(parseYoutubeVideoId("https://www.youtube.com/watch?v=pendek"), null);
  assert.equal(youtubeWatchUrl("dQw4w9WgXcQ", 95), "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=95s");
});

// Rangkuman AI di halaman perbandingan (src/lib/reviews/digest-rules.ts).
import { digestCacheKey, digestFacts, validateDigest, type DigestProduct } from "@/lib/reviews/digest-rules";

const note = (aspect: "umum" | "kamera", summary: string, channelName = "GadgetIn") => ({
  channelName,
  aspect,
  summary,
  strengths: ["Baterai awet"],
  limitations: [],
  isSponsored: false,
});
const PRODUCTS: DigestProduct[] = [
  { slug: "a", name: "OPPO A6", notes: [note("umum", "Baterai tahan seharian penuh untuk pemakaian campuran.")] },
  { slug: "b", name: "vivo Y29", notes: [] },
];

test("rangkuman: kunci cache berubah bila isi ringkasan berubah, tidak bila urutannya", () => {
  const key = digestCacheKey(PRODUCTS);
  assert.equal(key.length, 64);
  const reordered: DigestProduct[] = [
    { ...PRODUCTS[0], notes: [...PRODUCTS[0].notes, note("kamera", "Foto malam cukup terang.", "Pixa Focus ID")] },
    PRODUCTS[1],
  ];
  const reversed: DigestProduct[] = [{ ...reordered[0], notes: [...reordered[0].notes].reverse() }, PRODUCTS[1]];
  assert.notEqual(digestCacheKey(reordered), key);
  assert.equal(digestCacheKey(reversed), digestCacheKey(reordered));
});

test("rangkuman: fakta menyebut channel tiap poin dan produk tanpa ulasan", () => {
  const facts = digestFacts(PRODUCTS);
  assert.match(facts, /\[umum\] GadgetIn: Baterai tahan/);
  assert.match(facts, /## vivo Y29\n\(belum ada ringkasan reviewer\)/);
});

test("rangkuman: penilaian, skor, dan kamera karangan ditolak", () => {
  const ok = "Menurut GadgetIn, OPPO A6 bertahan seharian penuh; vivo Y29 belum punya ringkasan reviewer.";
  assert.deepEqual(validateDigest({ overall: ok, camera: "" }, PRODUCTS), { overall: ok, camera: "" });
  assert.equal(validateDigest({ overall: `${ok} OPPO A6 adalah pilihan terbaik.`, camera: "" }, PRODUCTS), null);
  assert.equal(validateDigest({ overall: `${ok} Nilainya 8/10.`, camera: "" }, PRODUCTS), null);
  assert.equal(validateDigest({ overall: ok, camera: "Kamera OPPO A6 tajam." }, PRODUCTS), null);
  assert.equal(validateDigest({ overall: "pendek", camera: "" }, PRODUCTS), null);
  assert.equal(validateDigest("bukan objek", PRODUCTS), null);
  // Klaim tanpa nama produk tidak bisa dibandingkan.
  assert.equal(validateDigest({ overall: "Menurut GadgetIn, baterainya bertahan seharian penuh untuk pemakaian campuran.", camera: "" }, PRODUCTS), null);
  assert.ok(validateDigest({ overall: "Menurut GadgetIn, baterai A6 bertahan seharian penuh untuk pemakaian campuran.", camera: "" }, PRODUCTS));
});

import { draftSchema } from "@/lib/reviews/ai-draft";

test("draf ulasan AI: hanya bentuk yang diharapkan yang mengisi formulir", () => {
  const valid = {
    relevan: true,
    aspek: "kamera",
    ringkasan: "Menurut reviewer, kamera utamanya tajam di siang hari tetapi agak berisik di malam hari.",
    kelebihan: ["Foto siang tajam"],
    kekurangan: ["Noise di malam hari"],
    konteks: "Dipakai seminggu",
    menit: "4:35",
    bersponsor: false,
    catatan: "",
  };
  assert.ok(draftSchema.safeParse(valid).success);
  assert.equal(draftSchema.safeParse({ ...valid, aspek: "baterai" }).success, false, "aspek hanya umum/kamera (PB-40)");
  assert.equal(draftSchema.safeParse({ ...valid, kelebihan: Array(7).fill("poin") }).success, false, "maksimal 6 poin");
  assert.equal(draftSchema.safeParse({ ...valid, ringkasan: "x".repeat(1300) }).success, false);
  assert.equal(draftSchema.safeParse({ ...valid, bersponsor: "ya" }).success, false);
});

import { clip, firstTimestamp, normalizeDraft } from "@/lib/reviews/ai-draft-rules";

test("draf ulasan AI: keluaran kepanjangan dirapikan, bukan dibuang (uji coba 18 Nov 2026)", () => {
  const long = "Kamera utama tajam di siang hari dengan warna natural dan rentang dinamis lebar ".repeat(5).trim();
  const draft = normalizeDraft(
    {
      relevan: true,
      aspek: "kamera",
      ringkasan: "Ringkasan cukup panjang tentang kamera menurut reviewer yang memakai ponsel ini.",
      kelebihan: [long, "- Zoom AI termasuk yang terbaik", "a", ...Array(6).fill("Poin tambahan")],
      kekurangan: ["Fokus video lepas"],
      konteks: "x ".repeat(400),
      menit: "12:30 - 14:00",
      bersponsor: "tidak",
      catatan: "Reviewer memakai varian 12/256 GB.",
    },
    "umum"
  )!;
  assert.ok(draft, "draf tetap terpakai");
  assert.equal(draft.kelebihan.length, 6, "maksimal 6 poin, poin satu huruf dibuang");
  assert.ok(draft.kelebihan[0]!.length <= 220 && draft.kelebihan[0]!.endsWith("…"), "poin panjang dipotong di batas kata");
  assert.equal(draft.kelebihan[1], "Zoom AI termasuk yang terbaik", "penanda daftar di depan poin dibuang");
  assert.match(draft.catatan, /Kelebihan no\. 2 memuat kata penilaian "terbaik"/);
  assert.match(draft.catatan, /hanya 6 pertama yang dipakai/);
  assert.match(draft.catatan, /12\/256 GB/, "catatan model tetap ada");
  assert.equal(draft.menit, "12:30", "rentang jadi waktu pertama");
  assert.equal(draft.bersponsor, false, "bukan boolean = tidak bersponsor");
  assert.ok(draft.konteks.length <= 300);
  assert.ok(draftSchema.safeParse(draft).success, "hasil normalisasi selalu lolos skema formulir");

  assert.equal(firstTimestamp("0:00"), "", "0:00 tidak menunjuk bagian mana pun");
  assert.equal(firstTimestamp("menit 4:35"), "4:35");
  assert.equal(clip("satu dua tiga empat", 12), "satu dua…");
  assert.equal(normalizeDraft({ ringkasan: "", kelebihan: [], kekurangan: [] }, "umum"), null, "tanpa isi = ditolak");
  assert.equal(normalizeDraft({ ringkasan: "Isi cukup panjang untuk ringkasan draf.", aspek: "baterai" }, "kamera")?.aspek, "kamera");
});

import { JUDGEMENT } from "@/lib/reviews/digest-rules";

test("kata penilaian: 'IP rating' bukan penilaian, 'rating 9/10' dan 'terbaik' tetap terdeteksi", () => {
  assert.equal(JUDGEMENT.test("Sudah dilengkapi IP rating IP64"), false);
  assert.equal(JUDGEMENT.test("rating IP68 untuk debu dan air"), false);
  assert.equal(JUDGEMENT.test("rating kameranya tinggi"), true);
  assert.equal(JUDGEMENT.test("Zoom AI termasuk yang terbaik"), true);
  assert.equal(JUDGEMENT.test("nilai 8,5/10"), true);
});

import fs from "node:fs";
import { VIDEO_DRAFT_LIMITS } from "@/lib/reviews/ai-draft";

test("draf video: batas waktu AI selalu di bawah maxDuration halaman (insiden 19 Nov 2026)", () => {
  const page = fs.readFileSync("src/app/admin/(workspace)/ulasan/[id]/page.tsx", "utf8");
  const maxDuration = Number(/export const maxDuration = (\d+)/.exec(page)?.[1]);
  assert.ok(maxDuration > 0, "maxDuration terbaca");
  // Sisa minimal 15 s untuk audit, kuota, dan render sesudah model menjawab.
  assert.ok(VIDEO_DRAFT_LIMITS.timeoutMs + 15_000 <= maxDuration * 1000, "satu percobaan muat di batas fungsi");
});
