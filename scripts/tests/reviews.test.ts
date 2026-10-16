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
