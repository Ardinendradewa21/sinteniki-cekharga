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
