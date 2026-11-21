// Uji deterministik aturan modul iklan (audit iklan 21 November 2026).
// Jalankan: pnpm test:ads
import { test } from "node:test";
import assert from "node:assert/strict";

import { matchesSlotRatio, mobileImageRequired } from "@/lib/ads/admin-schema";
import { pickCandidate, sharedBrand, type CandidateRow } from "@/lib/ads/selection";

function row(id: string, overrides: Partial<CandidateRow> = {}): CandidateRow {
  return {
    line_item_id: id,
    slot_code: "product_inline",
    format: "display",
    image_url: `https://cdn.example/${id}.png`,
    headline: null,
    priority: 10,
    weight: 1,
    target_brands: [],
    remaining: null,
    ...overrides,
  };
}

const first = () => 0;

test("F2: prioritas berbayar menang atas house ad bertarget merek halaman", () => {
  const paid = row("paid", { priority: 10 });
  const house = row("house", { priority: 90, target_brands: ["Samsung"] });
  const chosen = pickCandidate([house, paid], { slotCode: "product_inline", brand: "Samsung", random: first });
  assert.equal(chosen?.line_item_id, "paid");
});

test("F2: target merek menjadi pemenang seri pada prioritas yang sama", () => {
  const plain = row("plain", { priority: 10, weight: 100 });
  const targeted = row("targeted", { priority: 10, target_brands: ["samsung"] });
  const chosen = pickCandidate([plain, targeted], { slotCode: "product_inline", brand: "Samsung", random: first });
  assert.equal(chosen?.line_item_id, "targeted");
});

test("iklan bertarget merek lain tidak tayang; tanpa merek halaman hanya iklan umum", () => {
  const vivo = row("vivo", { priority: 1, target_brands: ["vivo"] });
  const plain = row("plain", { priority: 50 });
  assert.equal(pickCandidate([vivo, plain], { slotCode: "product_inline", brand: "Samsung" })?.line_item_id, "plain");
  assert.equal(pickCandidate([vivo, plain], { slotCode: "product_inline", brand: null })?.line_item_id, "plain");
  assert.equal(pickCandidate([vivo], { slotCode: "product_inline", brand: null }), null);
});

test("kandidat disaring: slot lain, sudah tampil, target habis, materi tidak lengkap", () => {
  const rows = [
    row("other-slot", { slot_code: "home_top" }),
    row("shown"),
    row("spent", { remaining: 0 }),
    row("no-image", { image_url: null }),
    row("native-no-headline", { format: "native", headline: null }),
    row("ok", { priority: 99, remaining: 5 }),
  ];
  const chosen = pickCandidate(rows, { slotCode: "product_inline", exclude: ["shown"] });
  assert.equal(chosen?.line_item_id, "ok");
});

test("rotasi berbobot mengikuti bobot", () => {
  const a = row("a", { weight: 1 });
  const b = row("b", { weight: 3 });
  assert.equal(pickCandidate([a, b], { slotCode: "product_inline", random: () => 0.1 })?.line_item_id, "a");
  assert.equal(pickCandidate([a, b], { slotCode: "product_inline", random: () => 0.5 })?.line_item_id, "b");
});

test("T3: merek bersama hanya bila semua produk satu merek", () => {
  assert.equal(sharedBrand(["Samsung", "samsung "]), "Samsung");
  assert.equal(sharedBrand(["Samsung", "vivo"]), null);
  assert.equal(sharedBrand([]), null);
});

test("F1: gambar ponsel wajib bila rasio slot ponsel berbeda", () => {
  assert.equal(mobileImageRequired("970x250", "300x250"), true);
  assert.equal(mobileImageRequired("728x90", "320x50"), true);
  assert.equal(mobileImageRequired("1200x150", "320x40"), false);
  assert.equal(mobileImageRequired("300x250", null), false);
  // Rasio materi tetap divalidasi; ukuran 2× diterima.
  assert.equal(matchesSlotRatio({ width: 640, height: 100 }, "320x50"), true);
  assert.equal(matchesSlotRatio({ width: 1456, height: 180 }, "728x90"), true);
  assert.equal(matchesSlotRatio({ width: 640, height: 200 }, "320x50"), false);
});
