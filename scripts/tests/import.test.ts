// Uji deterministik sistem impor admin.
// Jalankan: pnpm test:import
import { test } from "node:test";
import assert from "node:assert/strict";

import { findMissingOfficialOffers } from "@/lib/import/missing-prices";
import {
  addToProgress,
  batchAgeDays,
  emptyProgress,
  finalStatus,
  isEditable,
  isExpiredDraft,
  isRetryable,
  isStaleApplying,
  mapChunkResults,
} from "@/lib/import/batch-status";
import { mergeOfferSummaries, mergeSpecSummaries } from "@/lib/import/report";

const OFFICIAL = "https://www.vivo.com/id/products";
const storeFor = (url: string) => (url.startsWith("https://www.vivo.com/") ? "store-vivo" : null);
const row = (slug: string, ram: number, storage: number, url = `${OFFICIAL}/${slug}`) => ({
  slug,
  ram_gb: String(ram),
  storage_gb: String(storage),
  url,
});

const catalog = {
  products: [
    { id: "p1", slug: "vivo-v60" },
    { id: "p2", slug: "vivo-y29" },
  ],
  variants: [
    { id: "v1a", productId: "p1", ramGb: 8, storageGb: 128 },
    { id: "v1b", productId: "p1", ramGb: 8, storageGb: 256 },
    { id: "v2a", productId: "p2", ramGb: 6, storageGb: 128 },
  ],
  offers: [
    { id: "o1a", variantId: "v1a", url: `${OFFICIAL}/vivo-v60`, storeId: "store-vivo" },
    { id: "o1b", variantId: "v1b", url: `${OFFICIAL}/vivo-v60`, storeId: "store-vivo" },
    { id: "o2a", variantId: "v2a", url: `${OFFICIAL}/vivo-y29`, storeId: "store-vivo" },
    { id: "o1-shopee", variantId: "v1b", url: "https://shopee.co.id/x", storeId: "store-shopee" },
  ],
};

test("varian yang ada di hasil tarik tetapi tidak dicentang TIDAK ditandai gagal", () => {
  const all = [row("vivo-v60", 8, 128), row("vivo-v60", 8, 256), row("vivo-y29", 6, 128)];
  const missing = findMissingOfficialOffers({
    ...catalog,
    storeFor,
    scopeRows: [all[0]], // admin hanya mencentang 8/128
    seenRows: all,
  });
  assert.deepEqual(missing, []);
});

test("varian yang benar-benar hilang dari hasil tarik ditandai gagal", () => {
  const all = [row("vivo-v60", 8, 128)]; // 8/256 tidak lagi tercantum
  const missing = findMissingOfficialOffers({ ...catalog, storeFor, scopeRows: all, seenRows: all });
  assert.deepEqual(missing, ["o1b"]);
});

test("produk yang tidak dipilih dan toko lain tidak disentuh", () => {
  const all = [row("vivo-v60", 8, 128)];
  const missing = findMissingOfficialOffers({ ...catalog, storeFor, scopeRows: all, seenRows: all });
  assert.ok(!missing.includes("o2a"), "vivo-y29 tidak dipilih");
  assert.ok(!missing.includes("o1-shopee"), "penawaran toko lain bukan urusan tarik situs resmi");
});

test("tanpa baris terpilih tidak ada yang ditandai", () => {
  const all = [row("vivo-v60", 8, 128)];
  assert.deepEqual(findMissingOfficialOffers({ ...catalog, storeFor, scopeRows: [], seenRows: all }), []);
});

const NOW = new Date("2026-10-05T00:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

test("draft kedaluwarsa setelah 14 hari", () => {
  assert.equal(isExpiredDraft({ status: "draft", createdAt: daysAgo(15) }, NOW), true);
  assert.equal(isExpiredDraft({ status: "draft", createdAt: daysAgo(13) }, NOW), false);
  assert.equal(isExpiredDraft({ status: "applied", createdAt: daysAgo(30) }, NOW), false);
  assert.equal(batchAgeDays(daysAgo(3), NOW), 3);
});

test("penerapan macet = lease kedaluwarsa atau tidak ada", () => {
  const inSeconds = (sec: number) => new Date(NOW.getTime() + sec * 1000).toISOString();
  assert.equal(isStaleApplying({ status: "applying", leaseUntil: null }, NOW), true);
  assert.equal(isStaleApplying({ status: "applying", leaseUntil: inSeconds(-1) }, NOW), true);
  assert.equal(isStaleApplying({ status: "applying", leaseUntil: inSeconds(30) }, NOW), false);
  assert.equal(isStaleApplying({ status: "queued", leaseUntil: null }, NOW), false);
});

test("hanya draft yang bisa diubah pilihannya; partial/failed bisa dicoba ulang", () => {
  assert.equal(isEditable("draft"), true);
  assert.equal(isEditable("queued"), false);
  assert.equal(isRetryable("partial"), true);
  assert.equal(isRetryable("failed"), true);
  assert.equal(isRetryable("applied"), false);
});

test("status akhir dari hitungan hasil item", () => {
  assert.equal(finalStatus({ total: 3, done: 3, failed: 0, skipped: 0 }), "applied");
  assert.equal(finalStatus({ total: 3, done: 2, failed: 1, skipped: 0 }), "partial");
  assert.equal(finalStatus({ total: 2, done: 0, failed: 2, skipped: 0 }), "failed");
  assert.equal(finalStatus({ total: 2, done: 0, failed: 1, skipped: 1 }), "partial");
});

test("hasil runner dipetakan ke item lewat baris utamanya", () => {
  const local = new Map([
    ["item-a", 0],
    ["item-b", 1], // baris 2 = listing warna lain milik item-b, tidak menentukan hasil
    ["item-c", 3],
  ]);
  const outcomes = mapChunkResults(
    local,
    [
      { rowIndex: 0, outcome: "created", entityId: "p1", message: null },
      { rowIndex: 1, outcome: "updated", entityId: "o1", message: null },
      { rowIndex: 2, outcome: "skipped", entityId: null, message: "digabung" },
    ],
    null
  );
  assert.deepEqual(
    outcomes.map((o) => [o.id, o.result, o.resultAction, o.entityId]),
    [
      ["item-a", "done", "created", "p1"],
      ["item-b", "done", "updated", "o1"],
      ["item-c", "failed", null, null],
    ]
  );
  assert.equal(outcomes[2].message, "Baris tidak diproses.", "baris yang tidak dilaporkan runner = gagal, bukan berhasil");

  const crashed = mapChunkResults(local, [], "Gangguan sementara");
  assert.ok(crashed.every((o) => o.result === "failed" && o.message === "Gangguan sementara"));

  const progress = addToProgress(emptyProgress(3), outcomes);
  assert.deepEqual(progress, { total: 3, done: 2, failed: 1, skipped: 0 });
});

test("laporan potongan digabung menjadi laporan batch", () => {
  const spec = (n: number) => ({
    totalRows: n, created: n, updated: 0, imagesCreated: 1, imagesUpdated: 0, imagesUnchanged: 0,
    imageSkipped: [], skipped: [{ label: `x${n}`, reason: "r" }], malformedLines: [7],
  });
  const merged = mergeSpecSummaries(mergeSpecSummaries(null, spec(2)), spec(3));
  assert.equal(merged.totalRows, 5);
  assert.equal(merged.created, 5);
  assert.equal(merged.imagesCreated, 2);
  assert.equal(merged.skipped.length, 2);
  assert.deepEqual(merged.malformedLines, [7], "baris rusak berkas tidak dijumlahkan dua kali");

  const offer = (formats: ("template" | "shopee-scrape" | "erafone-scrape")[]) => ({
    totalRows: 1, preprocessedRows: 0, mergedListings: 0, inferredBaseVariants: 0, sourceFormats: formats,
    imagesAdded: 0, imagesUnchanged: 0, imageSkipped: [], created: 1, updated: 0, pricesRecorded: 1,
    duplicatePrices: 0, skipped: [], malformedLines: [],
  });
  const offers = mergeOfferSummaries(offer(["shopee-scrape"]), offer(["shopee-scrape", "template"]));
  assert.deepEqual(offers.sourceFormats, ["shopee-scrape", "template"]);
  assert.equal(offers.pricesRecorded, 2);
});

import { groupPhotoJobs, isPermanentFailure, photoJobNextState, PHOTO_MAX_ATTEMPTS } from "@/lib/import/photo-job-rules";

test("foto: berhasil = done, gagal sementara dicoba ulang, gagal permanen langsung final", () => {
  assert.deepEqual(photoJobNextState({ ok: true, outcome: "created" }, 1), { status: "done", outcome: "created", last_error: null });
  assert.equal(photoJobNextState({ ok: false, reason: "Gambar gagal disimpan ke Storage." }, 1).status, "pending");
  assert.equal(photoJobNextState({ ok: false, reason: "Gambar gagal disimpan ke Storage." }, PHOTO_MAX_ATTEMPTS).status, "failed");
  assert.equal(photoJobNextState({ ok: false, reason: "URL gambar tidak diizinkan." }, 1).status, "failed");
  assert.equal(isPermanentFailure("Galeri sudah berisi 8 foto; foto tambahan tidak disimpan."), true);
  assert.equal(isPermanentFailure("Gangguan sementara saat memproses foto."), false);
});

test("foto: dikelompokkan per produk, foto utama sebelum galeri", () => {
  const groups = groupPhotoJobs([
    { id: "1", product_id: "p1", kind: "gallery" as const },
    { id: "2", product_id: "p2", kind: "gallery" as const },
    { id: "3", product_id: "p1", kind: "primary" as const },
    { id: "4", product_id: "p1", kind: "reprocess" as const },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].map((job) => job.id), ["3", "1", "4"]);
  assert.deepEqual(groups[1].map((job) => job.id), ["2"]);
});

import { finalPrices, isIncludable, planCommit, sessionAgeDays } from "@/lib/scrape/commit-rules";
import type { PreviewItem } from "@/lib/scrape/types";

function preview(overrides: Partial<PreviewItem> = {}): PreviewItem {
  return {
    lineup: {
      officialId: "m1",
      brand: "infinix",
      officialName: "Infinix Uji",
      officialUrl: "https://id.infinixmobility.com/uji",
      prices: [{ ramGb: 8, storageGb: 128, priceIdr: 2_000_000, isPromotion: false }],
      storageOnlyPrices: [],
      unassignedPrices: [{ priceIdr: 2_500_000, isPromotion: false }],
      priceIssues: [],
      siblingHas5g: false,
      gsmarenaPath: null,
    },
    gsmarena: { name: "Infinix Uji", path: "infinix_uji-1.php" },
    alternatives: [],
    specRow: {} as PreviewItem["specRow"],
    summary: {
      brand: "Infinix", model: "Uji", slug: "infinix-uji", releaseYear: 2026, network: "LTE",
      chipset: null, displayInches: null, batteryMah: null,
      variants: [{ ramGb: 8, storageGb: 128 }, { ramGb: 8, storageGb: 256 }],
    },
    prices: [],
    catalog: { status: "new", slug: null },
    issues: [],
    ...overrides,
  };
}

test("tarik otomatis: harga mulai hanya dipasangkan ke varian yang benar-benar ada", () => {
  const item = preview();
  assert.equal(finalPrices(item).length, 1, "tanpa pilihan admin, harga mulai dilewati");
  const chosen = finalPrices(item, { "0": "8+256" });
  assert.deepEqual(chosen.map((p) => [p.ramGb, p.storageGb, p.priceIdr]), [[8, 128, 2_000_000], [8, 256, 2_500_000]]);
  assert.equal(finalPrices(item, { "0": "16+1024" }).length, 1, "varian karangan dari browser diabaikan");
  assert.equal(finalPrices(item, { "5": "8+256" }).length, 1, "indeks harga yang tidak ada diabaikan");
});

test("tarik otomatis: commit hanya menerima model yang diambil dan lolos pratinjau", () => {
  const ok = preview();
  const red = preview({ issues: [{ level: "error", message: "Merek atau nama model kosong." }] });
  const plan = planCommit(
    { m1: { status: "ok", item: ok }, m2: { status: "ok", item: red }, m3: { status: "error" } },
    [{ officialId: "m1" }, { officialId: "m1" }, { officialId: "m2" }, { officialId: "m3" }, { officialId: "palsu" }]
  );
  assert.deepEqual(plan.accepted.map((a) => a.officialId), ["m1"], "duplikat diabaikan");
  assert.deepEqual(plan.rejected.map((r) => r.officialId), ["m2", "m3", "palsu"]);
  assert.equal(isIncludable(preview({ specRow: null })), false);
  assert.equal(sessionAgeDays("2026-10-01T00:00:00.000Z", new Date("2026-10-08T12:00:00.000Z")), 7);
});

import { canUndo, classifyProduct, offerRemovable } from "@/lib/import/undo-rules";

test("undo: hanya produk buatan batch, masih draft, dan belum disentuh yang dihapus", () => {
  const applied = "2026-10-06T10:00:00.000Z";
  const base = { id: "p", label: "QA", status: "draft", createdByBatchId: "b1", updatedAt: "2026-10-06T09:59:00.000Z" };
  assert.equal(classifyProduct(base, "b1", applied).remove, true);
  assert.equal(classifyProduct({ ...base, createdByBatchId: "b0" }, "b1", applied).remove, false, "produk lama tidak dihapus");
  assert.equal(classifyProduct({ ...base, status: "published" }, "b1", applied).remove, false, "produk terbit dilindungi");
  assert.equal(classifyProduct({ ...base, updatedAt: "2026-10-06T10:05:00.000Z" }, "b1", applied).remove, false, "suntingan setelah batch dilindungi");
  assert.equal(offerRemovable({ id: "o", createdByBatchId: "b1", updatedAt: applied }, "b1", applied), true);
  assert.equal(offerRemovable({ id: "o", createdByBatchId: "b1", updatedAt: "2026-10-07T00:00:00.000Z" }, "b1", applied), false);
  assert.equal(canUndo("applied", applied).ok, true);
  assert.equal(canUndo("draft", null).ok, false);
  assert.equal(canUndo("reverted", applied).ok, false);
});

/* ---------------------------------------------- pemeriksaan harga harian */

import {
  MISSING_MODEL_REASON,
  MISSING_VARIANT_REASON,
  planPriceRefresh,
  refreshKeyFor,
} from "@/lib/import/price-refresh-rules";
import type { LineupItem } from "@/lib/scrape/types";

const vivoSource = { marketplace: "Situs resmi vivo Indonesia", sellerName: "vivo Indonesia", host: "www.vivo.com" };
const lineupItem = (id: string, extra: Partial<LineupItem> = {}): LineupItem => ({
  officialId: id,
  brand: "vivo",
  officialName: id,
  officialUrl: `https://www.vivo.com/id/products/${id}`,
  prices: [],
  storageOnlyPrices: [],
  unassignedPrices: [],
  priceIssues: [],
  siblingHas5g: false,
  gsmarenaPath: null,
  ...extra,
});
const refreshOffer = (offerId: string, model: string, ram: number, storage: number, extra = {}) => ({
  offerId,
  url: `https://www.vivo.com/id/products/${model}/`,
  slug: `vivo-${model}`,
  modelName: `vivo ${model}`,
  ramGb: ram,
  storageGb: storage,
  warranty: null,
  sellerVerified: false,
  ...extra,
});

test("pemeriksaan harga: hanya memperbarui penawaran yang ada, menyalin suntingan admin", () => {
  const plan = planPriceRefresh({
    source: vivoSource,
    observedAt: "2026-10-07T00:00:00.000Z",
    offers: [refreshOffer("o1", "y29", 8, 128, { warranty: "Resmi vivo 1 tahun", sellerVerified: true })],
    lineup: [
      lineupItem("y29", {
        prices: [
          { ramGb: 8, storageGb: 128, priceIdr: 2_999_000, isPromotion: false, inStock: false },
          // Varian tanpa penawaran tersimpan: TIDAK dibuat otomatis.
          { ramGb: 8, storageGb: 256, priceIdr: 3_299_000, isPromotion: false },
        ],
      }),
    ],
  });
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].url, "https://www.vivo.com/id/products/y29/", "URL tersimpan dipakai apa adanya");
  assert.equal(plan.rows[0].warranty, "Resmi vivo 1 tahun");
  assert.equal(plan.rows[0].seller_verified, "ya");
  assert.equal(plan.rows[0].listing_status, "out-of-stock");
  assert.equal(plan.rows[0].price_idr, "2999000");
  assert.deepEqual(plan.missing, []);
});

test("pemeriksaan harga: model hilang dan varian hilang dicatat gagal dengan alasan berbeda", () => {
  const plan = planPriceRefresh({
    source: vivoSource,
    observedAt: "2026-10-07T00:00:00.000Z",
    offers: [refreshOffer("o1", "y29", 8, 128), refreshOffer("o2", "y29", 12, 256), refreshOffer("o3", "v40", 8, 256)],
    lineup: [lineupItem("y29", { prices: [{ ramGb: 8, storageGb: 128, priceIdr: 2_999_000, isPromotion: false }] })],
  });
  assert.deepEqual(plan.matchedOfferIds, ["o1"]);
  assert.deepEqual(
    plan.missing.sort((a, b) => a.offerId.localeCompare(b.offerId)),
    [
      { offerId: "o2", reason: MISSING_VARIANT_REASON },
      { offerId: "o3", reason: MISSING_MODEL_REASON },
    ]
  );
});

test("pemeriksaan harga: harga tanpa varian yang tidak bisa dipastikan tidak dicatat apa pun", () => {
  const plan = planPriceRefresh({
    source: { ...vivoSource, host: "id.pro.infinixmobility.com" },
    observedAt: "2026-10-07T00:00:00.000Z",
    offers: [
      { ...refreshOffer("a", "x", 8, 128), url: "https://id.pro.infinixmobility.com/hot-60" },
      { ...refreshOffer("b", "x", 8, 256), url: "https://id.pro.infinixmobility.com/hot-60" },
      { ...refreshOffer("c", "y", 8, 256), url: "https://id.pro.infinixmobility.com/note-50" },
    ],
    lineup: [
      lineupItem("hot-60", { officialUrl: "https://id.pro.infinixmobility.com/hot-60", unassignedPrices: [{ priceIdr: 1_999_000, isPromotion: false }] }),
      lineupItem("note-50", { officialUrl: "https://id.pro.infinixmobility.com/note-50", unassignedPrices: [{ priceIdr: 3_199_000, isPromotion: false }] }),
    ],
  });
  assert.deepEqual(plan.matchedOfferIds, ["c"], "satu harga + satu penawaran: dipakai");
  assert.deepEqual(plan.ambiguous.sort(), ["a", "b"], "dua penawaran untuk satu harga mulai: tidak ditebak");
  assert.deepEqual(plan.missing, []);
});

test("pemeriksaan harga: host asing diabaikan dan kunci harian memakai tanggal WIB", () => {
  const plan = planPriceRefresh({
    source: vivoSource,
    observedAt: "2026-10-07T00:00:00.000Z",
    offers: [refreshOffer("o1", "y29", 8, 128)],
    lineup: [lineupItem("y29", { officialUrl: "https://evil.example/id/products/y29", prices: [{ ramGb: 8, storageGb: 128, priceIdr: 1, isPromotion: false }] })],
  });
  assert.equal(plan.rows.length, 0);
  assert.equal(plan.missing[0]?.reason, MISSING_MODEL_REASON);
  // 23.30 UTC tanggal 6 = 06.30 WIB tanggal 7.
  assert.equal(refreshKeyFor("vivo", new Date("2026-10-06T23:30:00Z")), "vivo:2026-10-07");
});

import { batchStatusView } from "@/lib/import/batch-status";

test("status batch: draft basi tampil Kedaluwarsa tanpa menulis ke database", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  assert.deepEqual(
    { ...batchStatusView({ status: "draft", createdAt: "2026-10-05T00:00:00Z" }, now), tone: undefined },
    { label: "Kedaluwarsa", tone: undefined, expired: true }
  );
  assert.equal(batchStatusView({ status: "draft", createdAt: "2026-10-10T00:00:00Z" }, now).label, "Menunggu ditinjau");
  // Hanya draft yang bisa kedaluwarsa; batch lama yang sudah diterapkan tetap apa adanya.
  assert.equal(batchStatusView({ status: "applied", createdAt: "2026-01-01T00:00:00Z" }, now).label, "Diterapkan");
});

import { modelKey } from "@/lib/scrape/parsers";

test("pemeriksaan harga: URL perwakilan berganti (Samsung) dicocokkan lewat nama model", () => {
  const samsung = { marketplace: "Situs resmi Samsung Indonesia", sellerName: "Samsung Indonesia", host: "www.samsung.com" };
  const keyOf = (name: string) => modelKey(name, { brandWords: ["samsung"] });
  const old = "https://www.samsung.com/id/smartphones/galaxy-a/galaxy-a27-5g-light-pink-128gb-sm-a276blidxid/";
  const offer = (offerId: string, model: string, ram: number, storage: number, url = old) => ({
    offerId, url, slug: "samsung-galaxy-a27", modelName: `Samsung ${model}`, ramGb: ram, storageGb: storage,
    warranty: null, sellerVerified: false,
  });
  const item = (name: string, url: string, prices: LineupItem["prices"]) =>
    lineupItem(name, { brand: "samsung", officialName: name, officialUrl: url, prices });
  const plan = planPriceRefresh({
    source: samsung,
    observedAt: "2026-10-07T00:00:00.000Z",
    keyOf,
    offers: [
      offer("a27-8-256", "Galaxy A27", 8, 256),
      offer("a27-6-128", "Galaxy A27", 6, 128),
      // URL lain yang masih tercantum TIDAK dipindah ke model lain.
      offer("a57", "Galaxy A57", 8, 256, "https://www.samsung.com/id/smartphones/galaxy-a57/"),
    ],
    lineup: [
      item("Galaxy A27 5G", "https://www.samsung.com/id/smartphones/galaxy-a/galaxy-a27-5g-blue-256gb-sm-a276bzbhxid/", [
        { ramGb: 8, storageGb: 256, priceIdr: 4_499_000, isPromotion: false },
      ]),
      item("Galaxy A57 5G", "https://www.samsung.com/id/smartphones/galaxy-a57/", []),
    ],
  });
  assert.deepEqual(plan.matchedOfferIds, ["a27-8-256"]);
  assert.equal(plan.rows[0].url, old, "URL tersimpan dipakai, bukan URL baru");
  assert.deepEqual(
    plan.missing.sort((a, b) => a.offerId.localeCompare(b.offerId)),
    [
      { offerId: "a27-6-128", reason: MISSING_VARIANT_REASON },
      { offerId: "a57", reason: MISSING_VARIANT_REASON },
    ],
    "model masih tercantum: alasannya varian, bukan model hilang"
  );
});

test("pemeriksaan harga: nama model tidak dipakai bila ada dua kandidat (S26 vs S26+)", () => {
  const keyOf = (name: string) => modelKey(name, { brandWords: ["samsung"] });
  const plan = planPriceRefresh({
    source: { marketplace: "S", sellerName: "S", host: "www.samsung.com" },
    observedAt: "2026-10-07T00:00:00.000Z",
    keyOf,
    offers: [{ offerId: "s26", url: "https://www.samsung.com/id/old-s26/", slug: "s26", modelName: "Samsung Galaxy S26", ramGb: 12, storageGb: 256, warranty: null, sellerVerified: false }],
    lineup: [
      lineupItem("s26plus", { officialName: "Galaxy S26+", officialUrl: "https://www.samsung.com/id/s26-plus/", prices: [{ ramGb: 12, storageGb: 256, priceIdr: 1, isPromotion: false }] }),
      lineupItem("s26ultra", { officialName: "Galaxy S26 Ultra", officialUrl: "https://www.samsung.com/id/s26-ultra/", prices: [{ ramGb: 12, storageGb: 256, priceIdr: 2, isPromotion: false }] }),
    ],
  });
  assert.deepEqual(plan.matchedOfferIds, []);
  assert.equal(plan.missing[0]?.reason, MISSING_MODEL_REASON);
});

test("modelKey: tanda + bagian dari nama model", () => {
  const key = (name: string) => modelKey(name, { brandWords: ["samsung"] }).base;
  assert.notEqual(key("Samsung Galaxy S26+"), key("Galaxy S26"));
  assert.equal(key("Galaxy S26+"), key("Samsung Galaxy S26 Plus"));
  assert.equal(key("Galaxy A27 5G"), key("Samsung Galaxy A27"));
});

test("modelKey: label penjualan [Online Exclusive] dan PO bukan bagian nama model", () => {
  const key = (name: string) => modelKey(name, { brandWords: ["oppo"] });
  assert.deepEqual(key("OPPO A6t [Online Exclusive]"), key("Oppo A6t"));
  assert.deepEqual(key("OPPO A6t Pro 5G [Online Exclusive]"), key("A6t Pro 5G"));
  assert.deepEqual(key("OPPO A7 Pro Max 5G PO"), key("Oppo A7 Pro Max 5G"));
  // "POCO" adalah nama seri, bukan label pre-order.
  assert.equal(modelKey("POCO X8 Pro", { brandWords: ["xiaomi"] }).base, "pocox8pro");
});

// Kontrak templat unduhan: templat yang diberikan ke tim harus lolos importer
// apa adanya. Kalau importer berubah tetapi templat tidak, tes ini gagal.
import { parseCsv } from "@/lib/import/csv-parser";
import { mapRow, SPEC_COLUMNS, templateSpesifikasi } from "@/lib/import/gsmarena";
import { mapOfferRow, OFFER_COLUMNS, templatePenawaran } from "@/lib/import/offers";

test("templat spesifikasi lolos mapRow dan mengisi semua spesifikasi", () => {
  const parsed = parseCsv(templateSpesifikasi());
  assert.deepEqual(parsed.headers, [...SPEC_COLUMNS]);
  assert.equal(parsed.rows.length, 1);
  const outcome = mapRow(parsed.rows[0]!);
  assert.ok(outcome.ok, outcome.ok ? "" : outcome.reason);
  assert.equal(outcome.candidate.slug, "oppo-reno16c");
  assert.equal(outcome.candidate.sourceKey, "gsmarena:oppo_reno16c_5g-14768");
  assert.equal(outcome.candidate.variants.length, 3);
  const kosong = Object.entries(outcome.candidate.specs).filter(([, v]) => v === null);
  assert.deepEqual(kosong, [], "contoh templat harus memperlihatkan semua kolom terisi");
});

test("templat penawaran lolos mapOfferRow; harga kosong tetap null, bukan nol", () => {
  const parsed = parseCsv(templatePenawaran());
  assert.deepEqual(parsed.headers, [...OFFER_COLUMNS]);
  const outcomes = parsed.rows.map(mapOfferRow);
  assert.ok(outcomes.every((o) => o.ok));
  const tanpaHarga = outcomes.find((o) => o.ok && o.row.slug === "oppo-a6c");
  assert.ok(tanpaHarga?.ok && tanpaHarga.row.priceIdr === null);
});

// Percobaan ulang pengambilan situs (PB-22, aturan system design 7).
import { SCRAPE_MAX_ATTEMPTS, isRetryableScrapeFailure, scrapeBackoffMs } from "@/lib/scrape/retry-rules";

test("retry tarik otomatis: hanya jaringan dan 5xx, blokir anti-bot tidak pernah diulang", () => {
  assert.equal(isRetryableScrapeFailure({ kind: "network" }), true);
  assert.equal(isRetryableScrapeFailure({ kind: "http", status: 503 }), true);
  assert.equal(isRetryableScrapeFailure({ kind: "http", status: 404 }), false);
  assert.equal(isRetryableScrapeFailure({ kind: "http", status: 429 }), false);
  assert.equal(isRetryableScrapeFailure({ kind: "blocked" }), false);
  assert.ok(SCRAPE_MAX_ATTEMPTS >= 2 && SCRAPE_MAX_ATTEMPTS <= 3, "retry terbatas");
  assert.equal(scrapeBackoffMs(1, () => 0), 1_000);
  assert.equal(scrapeBackoffMs(2, () => 0), 3_000);
  assert.ok(scrapeBackoffMs(2, () => 0.999) < 3_250);
});

// Patch semantics impor (langkah 1 impor terpadu): sel kosong = tidak diubah,
// "-" = kosongkan.
import { applyKeepExisting, mergeSpecs, specsPatch } from "@/lib/import/patch-rules";

const specRowFor = (overrides: Record<string, string>) => {
  const parsed = parseCsv(templateSpesifikasi());
  return { ...parsed.rows[0]!, ...overrides };
};

test("patch spesifikasi: sel kosong tidak diubah, tanda - mengosongkan", () => {
  const outcome = mapRow(specRowFor({ nfc: "", chipset: "-", ip_rating: "IP69" }));
  assert.ok(outcome.ok);
  assert.deepEqual(outcome.candidate.clearedSpecs, ["chipset"]);
  const patch = specsPatch(outcome.candidate.specs, outcome.candidate.clearedSpecs);
  assert.ok(!("hasNfc" in patch), "NFC kosong tidak ikut patch");
  assert.equal(patch.chipset, null, "chipset sengaja dikosongkan");
  assert.equal(patch.ipRating, "IP69");

  const merged = mergeSpecs({ hasNfc: true, chipset: "Lama", ipRating: "IP68", batteryMah: 5000 }, patch);
  assert.equal(merged.hasNfc, true, "isian admin tidak hilang");
  assert.equal(merged.chipset, null);
  assert.equal(merged.ipRating, "IP69");
  assert.equal(merged.batteryMah, 7000, "nilai baru menimpa nilai lama");
});

test("patch spesifikasi: NFC 'market dependent' dianggap tidak diketahui, tidak menimpa", () => {
  const outcome = mapRow(specRowFor({ nfc: "Yes (market/region dependent)" }));
  assert.ok(outcome.ok);
  const patch = specsPatch(outcome.candidate.specs, outcome.candidate.clearedSpecs);
  assert.ok(!("hasNfc" in patch));
});

test("patch penawaran: kolom kosong mempertahankan suntingan admin", () => {
  const base = "slug,ram_gb,storage_gb,marketplace,seller_name,url,warranty,listing_status,seller_verified,price_idr,observed_at\n";
  const rows = parseCsv(
    base +
      "oppo-a6c,4,128,Blibli,Toko,https://www.blibli.com/p/x,,,,1999000,2026-10-10T10:00:00+07:00\n" +
      "oppo-a6c,4,128,Blibli,Toko,https://www.blibli.com/p/x,-,inactive,tidak,,2026-10-10T10:00:00+07:00\n"
  ).rows;
  const empty = mapOfferRow(rows[0]!);
  const explicit = mapOfferRow(rows[1]!);
  assert.ok(empty.ok && explicit.ok);
  assert.deepEqual(empty.row.keepExisting, ["warranty", "listing_status", "seller_verified"]);
  assert.deepEqual(explicit.row.keepExisting, []);
  assert.equal(explicit.row.warranty, null, "garansi '-' dikosongkan");

  const existing = { warranty: "Resmi 1 tahun", listing_status: "out-of-stock", seller_verified: true };
  const kept = applyKeepExisting(
    { warranty: null, listing_status: "active", seller_verified: false },
    existing,
    empty.row.keepExisting
  );
  assert.deepEqual(kept, existing, "badge terverifikasi dan garansi tidak dicabut sel kosong");
});

// Bentuk baris internal (langkah 2 impor terpadu): semua format masuk lewat
// adaptor ke CanonicalRow, dan jenis berkas dikenali dari isinya.
import { detectFileKind, offerRowsToCanonical, productRowsToCanonical } from "@/lib/import/canonical";
import { templateShopeeScrape } from "@/lib/import/offers";

const detect = (csv: string) => {
  const parsed = parseCsv(csv);
  return detectFileKind(parsed.headers, parsed.rows);
};

test("deteksi berkas: templat resmi dikenali dari isinya, bukan dari formulir", () => {
  assert.deepEqual(detect(templateSpesifikasi()), { kind: "specs", format: "gsmarena-spec" });
  assert.deepEqual(detect(templatePenawaran()), { kind: "offers", format: "template" });
  assert.deepEqual(detect(templateShopeeScrape()), { kind: "offers", format: "shopee-scrape" });
  const erafone = detect(
    "a,b,c,d\nhttps://erafone.com/produk/iqoo-z11-5g-8-256gb-black,https://cdnpro.eraspace.com/media/catalog/product/x.jpg,iQOO Z11 5G 8/256GB - Black,Rp 4.299.000\n"
  );
  assert.deepEqual(erafone, { kind: "offers", format: "erafone-scrape" });
});

test("deteksi berkas: gabungan dan format asing ditolak dengan alasan, bukan ditebak", () => {
  // Format spesifikasi lama dicampur kolom penawaran lama: diarahkan ke templat terpadu.
  const mixed = detect("brand,model_name,url,slug\nOPPO,A6,oppo_a6-1.php,oppo-a6\n");
  assert.equal(mixed.kind, null);
  assert.ok(mixed.kind === null && /templat terpadu/.test(mixed.reason));
  const unknown = detect("nama,harga\nHP,1000\n");
  assert.ok(unknown.kind === null && /tidak dikenali/.test(unknown.reason));
});

test("adaptor kanonik: baris valid membawa bagiannya, baris rusak membawa alasan", () => {
  const specRows = [
    parseCsv(templateSpesifikasi()).rows[0]!,
    { brand: "OPPO", model_name: "", memory_variants_summary: "128GB/8GB", url: "x.php" },
  ];
  const products = productRowsToCanonical(specRows);
  assert.equal(products[0]!.product?.candidate.slug, "oppo-reno16c");
  assert.equal(products[0]!.offer, null);
  assert.equal(products[1]!.product, null);
  assert.match(products[1]!.issue ?? "", /kosong/);

  const catalog = [{ id: "p1", slug: "oppo-a6c", brand: "OPPO", model: "A6c", variants: [{ id: "v1", ramGb: 4, storageGb: 128 }] }];
  const offers = offerRowsToCanonical(parseCsv(templatePenawaran()).rows, catalog, { observedAt: "2026-10-10T03:00:00.000Z" });
  assert.equal(offers.length, 3);
  assert.ok(offers.every((row) => row.format === "template" && row.product === null));
  assert.equal(offers[2]!.offer?.row.priceIdr, null, "harga kosong tetap null");
});

test("pencocokan judul berindeks: akhiran 5G hanya dibuang bila jaringan katalog sama", () => {
  const catalog = [
    { id: "a27", slug: "samsung-galaxy-a27", brand: "Samsung", model: "Galaxy A27", is5G: true, variants: [{ id: "v1", ramGb: 8, storageGb: 256 }] },
    { id: "a17", slug: "samsung-galaxy-a17", brand: "Samsung", model: "Galaxy A17", is5G: false, variants: [{ id: "v2", ramGb: 8, storageGb: 256 }] },
  ];
  const row = (title: string) => ({ listing_url: "https://shopee.co.id/x-i.1.2", title, price_idr: "4999000", seller_name: "Toko" });
  const [match, wrongNetwork, invalidTime] = offerRowsToCanonical(
    [row("Samsung Galaxy A27 5G (8/256GB)"), row("Samsung Galaxy A17 5G (8/256GB)"), { ...row("Samsung Galaxy A27 (8/256GB)"), scraped_at: "bukan tanggal" }],
    catalog,
    { observedAt: "2026-10-10T01:00:00.000Z" }
  );
  assert.equal(match!.offer?.row.slug, "samsung-galaxy-a27");
  assert.equal(wrongNetwork!.offer, null, "A17 4G tidak boleh dicocokkan dengan judul 5G");
  assert.match(invalidTime!.issue ?? "", /Waktu pengamatan harga tidak valid/);
});

// Templat terpadu (langkah 3): alias header, koreksi pasti, penggabungan per produk.
import {
  canonicalHeader,
  normalizeGsmarenaPath,
  normalizeListingStatus,
  normalizeMemoryGb,
  normalizeObservedAt,
  normalizePriceIdr,
  normalizeYesNo,
  parseVariantPair,
} from "@/lib/import/normalize";
import { convertUnifiedRows, templateTerpadu } from "@/lib/import/unified";

test("normalisasi: hanya koreksi yang pasti, sisanya dibiarkan untuk ditolak", () => {
  assert.equal(normalizePriceIdr("Rp 7.999.000").value, "7999000");
  assert.equal(normalizePriceIdr("7.999.000,00").value, "7999000");
  assert.equal(normalizePriceIdr("7,999,000").value, "7999000");
  assert.equal(normalizePriceIdr("7,5 jt").value, "7500000");
  assert.equal(normalizePriceIdr("7999000").note, null);
  assert.equal(normalizePriceIdr("tujuh juta").value, "tujuh juta", "harga tidak ditebak");
  assert.equal(normalizeMemoryGb("1TB").value, "1024");
  assert.equal(normalizeMemoryGb("8 GB").value, "8");
  assert.deepEqual(parseVariantPair("12/1TB"), { ramGb: 12, storageGb: 1024 });
  assert.equal(parseVariantPair("8 256"), null);
  assert.equal(normalizeListingStatus("Stok habis").value, "out-of-stock");
  assert.equal(normalizeYesNo("Yes").value, "ya");
  assert.equal(normalizeYesNo("mungkin").value, "mungkin");
  assert.equal(normalizeObservedAt("10/10/2026 14.30").value, "2026-10-10T14:30:00+07:00");
  assert.match(normalizeObservedAt("2026-10-10").note ?? "", /00\.00 WIB/);
  assert.equal(normalizeObservedAt("31/02/2026").value, "31/02/2026", "tanggal mustahil tidak dikoreksi");
  assert.equal(normalizeObservedAt("2026-10-10T09:00:00+07:00").note, null);
  assert.equal(normalizeGsmarenaPath("https://www.gsmarena.com/oppo_reno16c_5g-14768.php").value, "oppo_reno16c_5g-14768.php");
});

test("alias header: nama Indonesia dikenali, kolom scraper Shopee tidak dibajak", () => {
  assert.equal(canonicalHeader("Harga"), "price_idr");
  assert.equal(canonicalHeader("Merek"), "brand");
  assert.equal(canonicalHeader("Link"), "offer_url");
  assert.equal(canonicalHeader("listing_url"), "listing_url");
  assert.deepEqual(detect(templateTerpadu()), { kind: "unified", format: "unified" });
  assert.deepEqual(detect(templateShopeeScrape()), { kind: "offers", format: "shopee-scrape" });
});

test("templat terpadu: produk digabung per varian, penawaran dipisah lanjutan vs produk lama", () => {
  const converted = convertUnifiedRows(parseCsv(templateTerpadu()).rows);
  assert.equal(converted.specRows.length, 1, "dua baris Reno16c menjadi satu produk");
  const product = mapRow(converted.specRows[0]!);
  assert.ok(product.ok);
  assert.equal(product.candidate.sourceKey, "gsmarena:oppo_reno16c_5g-14768");
  assert.deepEqual(product.candidate.variants, [{ ramGb: 8, storageGb: 128 }, { ramGb: 8, storageGb: 256 }]);

  assert.equal(converted.followUpOfferRows.length, 2);
  assert.ok(converted.followUpOfferRows.every((row) => row.source_key === product.candidate.sourceKey));
  assert.equal(converted.followUpOfferRows[0]!.price_idr, "4999000");
  assert.equal(converted.followUpOfferRows[1]!.price_idr, "", "harga kosong tetap kosong, bukan nol");
  assert.equal(converted.offerRows.length, 1);
  assert.equal(converted.offerRows[0]!.slug, "oppo-a6c");
  assert.equal(converted.offerRows[0]!.listing_status, "active");

  const offer = mapOfferRow({ ...converted.followUpOfferRows[0]!, slug: "oppo-reno16c" });
  assert.ok(offer.ok, offer.ok ? "" : offer.reason);
  assert.equal(offer.row.observedAt, "2026-10-10T02:00:00.000Z", "09.00 WIB");
  const notes = converted.corrections.map((c) => `${c.line}:${c.column}`);
  assert.ok(notes.includes("2:price_idr") && notes.includes("2:observed_at"));
  assert.ok(converted.corrections.every((c) => c.level === "info"));
});

test("templat terpadu: konflik antarbaris dicatat dan nilai baris pertama dipakai", () => {
  const rows: Record<string, string>[] = [
    { merek: "QAUji", model: "Konflik 1", ram: "8", storage: "128", chipset: "Chip A" },
    { merek: "QAUji", model: "Konflik 1", ram: "8", storage: "256", chipset: "Chip B" },
    { merek: "", model: "", harga: "1000000" },
  ];
  const converted = convertUnifiedRows(rows);
  assert.equal(converted.specRows[0]!.chipset, "Chip A");
  const conflict = converted.corrections.find((c) => c.level === "warning");
  assert.equal(conflict?.line, 3);
  assert.match(conflict?.note ?? "", /baris 2/);
  const skipped = converted.corrections.find((c) => c.level === "error");
  assert.equal(skipped?.line, 4, "penawaran tanpa slug atau merek+model dilewati dengan alasan");
});

test("templat terpadu: baris varian + harga tanpa spesifikasi tetap milik produk di berkas, di atas maupun di bawah", () => {
  const rows: Record<string, string>[] = [
    { merek: "QAUji", model: "Urutan 1", ram: "8", storage: "256", link: "https://www.blibli.com/p/u1", harga: "Rp 4.000.000" },
    { merek: "QAUji", model: "Urutan 1", ram: "8", storage: "128", chipset: "Chip QA", gsmarena_url: "qauji_urutan_1-1.php" },
  ];
  const converted = convertUnifiedRows(rows);
  assert.equal(converted.offerRows.length, 0, "bukan penawaran untuk produk lama");
  assert.equal(converted.followUpOfferRows[0]!.source_key, "gsmarena:qauji_urutan_1-1");
  const product = mapRow(converted.specRows[0]!);
  assert.ok(product.ok);
  assert.equal(product.candidate.sourceKey, "gsmarena:qauji_urutan_1-1");
  assert.deepEqual(product.candidate.variants.map((v) => v.storageGb).sort(), [128, 256]);
});

import { selectStoredCorrections } from "@/lib/import/corrections";

test("catatan koreksi: konflik dan baris dilewati tidak tenggelam oleh ribuan koreksi info", () => {
  const info = Array.from({ length: 2000 }, (_, i) => ({ line: i + 2, column: "price_idr", from: "Rp 1", to: "1", note: "", level: "info" as const }));
  const late = [
    { line: 1900, column: "chipset", from: "B", to: "A", note: "konflik", level: "warning" as const },
    { line: 1999, column: "-", from: "", to: "", note: "dilewati", level: "error" as const },
  ];
  const stored = selectStoredCorrections([...info, ...late], 300);
  assert.equal(stored.length, 300);
  assert.deepEqual(stored.slice(0, 2).map((c) => c.level), ["error", "warning"]);
});

// Pratinjau per produk (langkah 5): status tinjauan, kelompok, pilihan bawaan.
import { countByStatus, groupReviewItems, reviewStatus, selectedByDefault } from "@/lib/import/review-groups";

const reviewItem = (id: string, entity: "product" | "offer", action: "create" | "update" | "unchanged" | "skip", view: Record<string, unknown> = {}, changes: { field: string; before: string | null; after: string | null }[] = []) =>
  ({ id, entity, action, label: id, reason: null, view, changes });

test("pratinjau per produk: status rinci dan 'Perlu tinjau' tidak dicentang otomatis", () => {
  const stale = reviewItem("a", "offer", "update", { priceStale: true, product: "OPPO A6", variant: "8/256 GB" });
  const inferred = reviewItem("b", "offer", "create", { inferredVariant: true, product: "OPPO A6", variant: "8/128 GB" });
  const restored = reviewItem("c", "product", "update", { sourceKey: "k" }, [{ field: "Status data", before: "Terhapus", after: "Dipulihkan sebagai draft" }]);
  const plain = reviewItem("d", "offer", "update", { product: "OPPO A6", variant: "12/256 GB" });
  assert.equal(reviewStatus(stale), "stale");
  assert.equal(reviewStatus(inferred), "review");
  assert.equal(reviewStatus(restored), "review");
  assert.equal(reviewStatus(plain), "update");
  assert.equal(reviewStatus(reviewItem("e", "offer", "skip")), "skip");
  assert.deepEqual([stale, inferred, restored, plain].map(selectedByDefault), [true, false, false, true]);
  assert.equal(countByStatus([stale, inferred, restored, plain]).review, 2);
});

test("pratinjau per produk: penawaran dikelompokkan per produk dan diurutkan per varian", () => {
  const groups = groupReviewItems([
    reviewItem("1", "offer", "update", { product: "OPPO A6", variant: "8/256 GB" }),
    reviewItem("2", "offer", "create", { product: "vivo Y29", variant: "8/128 GB" }),
    reviewItem("3", "offer", "create", { product: "OPPO A6", variant: "8/128 GB" }),
  ]);
  assert.deepEqual(groups.map((g) => g.title), ["OPPO A6", "vivo Y29"]);
  assert.deepEqual(groups[0]!.items.map((i) => i.id), ["3", "1"]);
});

// Foto di templat terpadu dan templat penawaran (2026-10-12).
import { imageSourceName, safeHttpsImageUrl } from "@/lib/import/image-hosts";
import { readTemplateListingImage } from "@/lib/import/offers";

test("foto: templat terpadu punya kolom foto; foto utama ke produk baru, foto produk lama ikut penawaran", () => {
  const header = templateTerpadu().split("\n")[0]!.split(",");
  for (const column of ["image_url", "image_usage_basis", "image_usage_rights"]) assert.ok(header.includes(column), column);
  const converted = convertUnifiedRows(parseCsv(templateTerpadu()).rows);
  assert.equal(converted.specRows[0]!.image_url, "https://fdn2.gsmarena.com/vv/bigpic/contoh.jpg", "foto utama Reno16c");
  assert.ok(converted.followUpOfferRows.every((row) => !row.image_url), "foto utama tidak digandakan ke galeri");
  assert.equal(converted.offerRows[0]!.image_url, "https://down-id.img.susercontent.com/file/contoh");
});

test("foto: kolom url_image dikenali dan tidak membuat baris produk palsu untuk produk lama", () => {
  assert.equal(canonicalHeader("url_image"), "image_url");
  assert.equal(canonicalHeader("Link Gambar"), "image_url");
  const converted = convertUnifiedRows([
    {
      brand: "Xiaomi", model_name: "Redmi 17", ram_gb: "4", storage_gb: "128", marketplace: "Shopee",
      seller_name: "Xiaomi Official Store", offer_url: "https://shopee.co.id/redmi-17-i.1.2",
      url_image: "https://i02.appmifile.com/contoh/redmi-17.png", price_idr: "1899000",
    },
    { brand: "Xiaomi", model_name: "Redmi 17", url_image: "https://i02.appmifile.com/contoh/lain.png" },
  ]);
  assert.equal(converted.specRows.length, 0, "foto saja bukan alasan membuat atau menimpa produk");
  assert.equal(converted.offerRows.length, 1);
  assert.equal(converted.offerRows[0]!.slug, "xiaomi-redmi-17");
  assert.equal(converted.offerRows[0]!.image_url, "https://i02.appmifile.com/contoh/redmi-17.png");
  const photoOnly = converted.corrections.find((c) => c.level === "error");
  assert.equal(photoOnly?.line, 3);
  assert.match(photoOnly?.note ?? "", /perlu penawaran di baris yang sama, atau gsmarena_url/);
});

test("foto: produk di berkas memakai foto pertama sebagai utama, foto warna lain masuk galeri tanpa peringatan", () => {
  const base = { merek: "QAUji", model: "Foto 1", gsmarena_url: "qauji_foto_1-1.php", chipset: "Chip QA" };
  const converted = convertUnifiedRows([
    { ...base, ram: "8", storage: "128", foto: "https://fdn2.gsmarena.com/vv/bigpic/a.jpg" },
    { merek: "QAUji", model: "Foto 1", ram: "8", storage: "128", link: "https://www.blibli.com/p/biru", harga: "1000000", foto: "https://down-id.img.susercontent.com/file/biru" },
  ]);
  assert.equal(converted.specRows[0]!.image_url, "https://fdn2.gsmarena.com/vv/bigpic/a.jpg");
  assert.equal(converted.followUpOfferRows[0]!.image_url, "https://down-id.img.susercontent.com/file/biru");
  assert.equal(converted.corrections.filter((c) => c.level !== "info").length, 0);
});

test("foto listing templat: host diizinkan, hak pakai per baris divalidasi, harga tidak pernah gagal karena foto", () => {
  const xiaomi = safeHttpsImageUrl("https://i02.appmifile.com/contoh.png");
  assert.ok(xiaomi);
  assert.equal(imageSourceName(xiaomi), "Situs resmi Xiaomi");
  assert.equal(safeHttpsImageUrl("http://i02.appmifile.com/contoh.png"), null, "wajib HTTPS");
  assert.equal(safeHttpsImageUrl("https://contoh.com/a.png"), null);

  const ok = readTemplateListingImage({ url_image: "https://down-id.img.susercontent.com/file/a" });
  assert.deepEqual(ok, { image: { url: "https://down-id.img.susercontent.com/file/a", productId: null, rights: null } });
  assert.match(readTemplateListingImage({ image_url: "https://contoh.com/a.png" }).issue ?? "", /host-nya belum diizinkan/);
  const noProof = readTemplateListingImage({ image_url: "https://down-id.img.susercontent.com/file/a", image_usage_basis: "written-permission" });
  assert.equal(noProof.image, null);
  assert.match(noProof.issue ?? "", /bukti hak pakai/i);
  const own = readTemplateListingImage({ image_url: "https://down-id.img.susercontent.com/file/a", image_usage_basis: "own-work" });
  assert.equal(own.image?.rights?.basis, "own-work");

  const offer = offerRowsToCanonical(
    [{ slug: "oppo-a6c", ram_gb: "4", storage_gb: "128", marketplace: "Blibli", seller_name: "Toko", url: "https://www.blibli.com/p/a", image_url: "https://contoh.com/a.png" }],
    [],
    { observedAt: "2026-10-10T01:00:00.000Z" }
  )[0]!;
  assert.ok(offer.offer, "baris harga tetap valid");
  assert.match(offer.offer!.imageIssue ?? "", /host-nya belum diizinkan/);
});
