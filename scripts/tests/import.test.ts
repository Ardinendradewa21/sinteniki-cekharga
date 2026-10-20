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
  DUPLICATE_URL_REASON,
  isPendingUrlSuggestion,
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
  assert.deepEqual(plan.urlSuggestions, [], "cocok lewat URL: tidak ada usulan");
  assert.deepEqual(plan.urlConfirmed, ["o1"], "garis miring akhir tidak membuat URL dianggap berbeda");
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
  // PB-06: URL yang tercantum hari ini menjadi usulan untuk admin, bukan ditimpa.
  assert.deepEqual(plan.urlSuggestions, [
    { offerId: "a27-8-256", url: "https://www.samsung.com/id/smartphones/galaxy-a/galaxy-a27-5g-blue-256gb-sm-a276bzbhxid" },
  ]);
  assert.deepEqual(plan.urlConfirmed, ["a57"], "URL tersimpan masih tercantum: usulan lamanya dihapus");
  assert.deepEqual(
    plan.missing.sort((a, b) => a.offerId.localeCompare(b.offerId)),
    [
      { offerId: "a27-6-128", reason: MISSING_VARIANT_REASON },
      { offerId: "a57", reason: MISSING_VARIANT_REASON },
    ],
    "model masih tercantum: alasannya varian, bukan model hilang"
  );
});

test("pemeriksaan harga: penawaran ganda dengan URL lama ditandai duplikat dan diusulkan ke URL penawaran yang aktif (DEF-018)", () => {
  const keyOf = (name: string) => modelKey(name, { brandWords: ["samsung"] });
  const graphite = "https://www.samsung.com/id/smartphones/galaxy-s/galaxy-s26-fe-graphite-128gb-sm-s741bzkbxid/";
  const blueberry = "https://www.samsung.com/id/smartphones/galaxy-s/galaxy-s26-fe-blueberry-128gb-sm-s741bzvbxid/";
  const offer = (offerId: string, url: string, storage: number) => ({
    offerId, url, slug: "samsung-galaxy-s26-fe", modelName: "Samsung Galaxy S26 FE", ramGb: 8, storageGb: storage, warranty: null, sellerVerified: false,
  });
  const plan = planPriceRefresh({
    source: { marketplace: "Situs resmi Samsung Indonesia", sellerName: "Samsung Indonesia", host: "www.samsung.com" },
    observedAt: "2026-10-17T00:00:00.000Z",
    keyOf,
    offers: [offer("lama-128", graphite, 128), offer("baru-128", blueberry, 128), offer("lama-512", graphite, 512)],
    lineup: [
      lineupItem("s26fe", {
        brand: "samsung",
        officialName: "Galaxy S26 FE",
        officialUrl: blueberry,
        prices: [
          { ramGb: 8, storageGb: 128, priceIdr: 7_999_000, isPromotion: false },
          { ramGb: 8, storageGb: 512, priceIdr: 9_999_000, isPromotion: false },
        ],
      }),
    ],
  });
  assert.deepEqual(plan.matchedOfferIds.sort(), ["baru-128", "lama-512"], "varian tanpa penawaran aktif tetap diperbarui lewat nama");
  assert.deepEqual(plan.missing, [{ offerId: "lama-128", reason: DUPLICATE_URL_REASON }], "yang ganda tetap jujur dicatat gagal");
  assert.deepEqual(
    plan.urlSuggestions,
    [{ offerId: "lama-128", url: blueberry.replace(/\/$/, "") }],
    "halaman perwakilan 128 GB tidak diusulkan untuk varian 512 GB"
  );
  assert.deepEqual(plan.urlConfirmed.sort(), ["baru-128", "lama-512"], "harga diperbarui tanpa usulan: usulan lama dihapus");
});

import { findRelocatedOffer } from "@/lib/import/offer-relocation";
import { isOfficialOffer } from "@/lib/scrape/official-sellers";

test("pemindahan penawaran: penjual resmi dan Erafone dipindah ke URL baru, marketplace lain tidak", () => {
  const samsungPayload = { marketplace: "Situs resmi Samsung Indonesia", seller_name: "Samsung Indonesia" };
  const graphite = "https://www.samsung.com/id/s26-fe-graphite-128gb/";
  const blueberry = "https://www.samsung.com/id/s26-fe-blueberry-128gb/";
  const existing = [
    { id: "hapus", variant_id: "v1", url: "https://www.samsung.com/id/lama-dihapus/", ...samsungPayload, deleted_at: "2026-10-01T00:00:00Z" },
    { id: "lama", variant_id: "v1", url: graphite, ...samsungPayload, deleted_at: null },
    { id: "shopee", variant_id: "v1", url: "https://shopee.co.id/a", marketplace: "Shopee", seller_name: "Toko A", deleted_at: null },
    { id: "era", variant_id: "v1", url: "https://erafone.com/hitam", marketplace: "Erafone", seller_name: "Erafone", deleted_at: null },
  ];
  const none = new Set<string>();
  const item = (url: string, payload = samsungPayload, format: "template" | "erafone-scrape" = "template") => ({ format, variantId: "v1", url, payload });
  assert.equal(findRelocatedOffer(item(blueberry), existing, none)?.id, "lama", "yang terhapus tidak dihidupkan lagi");
  assert.equal(findRelocatedOffer(item(blueberry), existing, new Set([`v1|${graphite}`])), undefined, "URL lama ikut diimpor: keduanya dipertahankan");
  assert.equal(findRelocatedOffer(item("https://shopee.co.id/b", { marketplace: "Shopee", seller_name: "Toko A" }), existing, none), undefined, "listing marketplace bisa lebih dari satu");
  assert.equal(findRelocatedOffer(item("https://erafone.com/biru", { marketplace: "Erafone", seller_name: "Erafone" }, "erafone-scrape"), existing, none)?.id, "era");
  assert.equal(findRelocatedOffer({ ...item(blueberry), variantId: "v2" }, existing, none), undefined, "varian lain tidak disentuh");
  assert.equal(isOfficialOffer({ url: "https://evil.example/s26", marketplace: samsungPayload.marketplace, sellerName: samsungPayload.seller_name }), false, "host asing bukan penjual resmi");
  assert.equal(isOfficialOffer({ url: "https://www.digimap.co.id/iphone-17", marketplace: "Digimap", sellerName: "Digimap" }), true);
});

test("usulan URL: hanya yang berbeda dari URL sekarang dan belum ditolak yang menunggu keputusan", () => {
  const current = "https://www.samsung.com/id/a27-pink-128gb/";
  const fresh = "https://www.samsung.com/id/a27-blue-256gb";
  assert.equal(isPendingUrlSuggestion({ suggestedUrl: fresh, dismissedUrl: null, currentUrl: current }), true);
  assert.equal(isPendingUrlSuggestion({ suggestedUrl: "https://www.samsung.com/id/a27-pink-128gb", dismissedUrl: null, currentUrl: current }), false, "sudah dipakai");
  assert.equal(isPendingUrlSuggestion({ suggestedUrl: fresh, dismissedUrl: `${fresh}/`, currentUrl: current }), false, "sudah ditolak");
  assert.equal(isPendingUrlSuggestion({ suggestedUrl: fresh, dismissedUrl: "https://www.samsung.com/id/a27-green", currentUrl: current }), true, "URL lain yang ditolak tidak menahan usulan baru");
  assert.equal(isPendingUrlSuggestion({ suggestedUrl: "bukan url", dismissedUrl: null, currentUrl: current }), false);
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

test("deteksi berkas: templat resmi dikenali dari isinya, bukan dari formulir; berkas spesifikasi ditolak", () => {
  const spec = detect(templateSpesifikasi());
  assert.ok(spec.kind === null && /Tarik otomatis/.test(spec.reason), "spesifikasi tidak lagi lewat CSV (Sprint 9)");
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
  assert.ok(mixed.kind === null && /CSV gabungan/.test(mixed.reason));
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

test("CSV gabungan: penawaran untuk produk di katalog dicari lewat nama, harga kosong tetap kosong", () => {
  const converted = convertUnifiedRows(parseCsv(templateTerpadu()).rows);
  assert.equal(converted.offerRows.length, 2, "dua varian A6c");
  assert.ok(converted.offerRows.every((row) => row.slug === "oppo-a6c" && row.product_name === "OPPO A6c"));
  assert.equal(converted.offerRows[0]!.price_idr, "1999000");
  assert.equal(converted.offerRows[1]!.price_idr, "", "harga kosong tetap kosong, bukan nol");
  assert.equal(converted.offerRows[1]!.listing_status, "active");
  const offer = mapOfferRow(converted.offerRows[0]!);
  assert.ok(offer.ok, offer.ok ? "" : offer.reason);
  assert.equal(offer.row.observedAt, "2026-10-10T02:00:00.000Z", "09.00 WIB");
  const notes = converted.corrections.map((c) => `${c.line}:${c.column}`);
  assert.ok(notes.includes("2:price_idr") && notes.includes("2:observed_at"));
  assert.ok(converted.corrections.every((c) => c.level === "info"));
});

test("CSV gabungan: kolom spesifikasi sheet lama diabaikan dengan satu peringatan, harga dan foto tetap masuk", () => {
  const rows: Record<string, string>[] = [
    { merek: "QAUji", model: "Lama 1", ram: "8", storage: "128", chipset: "Chip A", gsmarena_url: "qauji_lama_1-1.php", link: "https://www.blibli.com/p/l1", harga: "Rp 4.000.000" },
    { merek: "QAUji", model: "Lama 1", ram: "8", storage: "256", chipset: "Chip B", warna: "Hitam", foto: "https://fdn2.gsmarena.com/vv/bigpic/l1.jpg" },
    { merek: "", model: "", harga: "1000000" },
    { merek: "QAUji", model: "Lama 2", nfc: "Yes" },
  ];
  const converted = convertUnifiedRows(rows);
  assert.equal(converted.offerRows.length, 1, "baris harga tetap menjadi penawaran untuk produk lama");
  assert.equal(converted.offerRows[0]!.slug, "qauji-lama-1");
  assert.equal(converted.photoRows.length, 1);
  const warnings = converted.corrections.filter((c) => c.level === "warning");
  assert.equal(warnings.length, 1, "satu peringatan untuk seluruh berkas, bukan per baris");
  assert.match(warnings[0]!.note, /Kolom spesifikasi di 3 baris diabaikan.*Tarik otomatis/);
  assert.equal(warnings[0]!.line, 2);
  const skipped = converted.corrections.filter((c) => c.level === "error").map((c) => c.line);
  assert.deepEqual(skipped, [4], "penawaran tanpa slug atau merek+model dilewati; baris spesifikasi saja tidak dianggap galat");
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

test("CSV gabungan: templat hanya penawaran dan foto; semua foto jadi baris galeri, bukan menempel ke penawaran", () => {
  const header = templateTerpadu().split("\n")[0]!.split(",");
  for (const column of ["image_url", "urutan", "is_cover", "image_source_url", "image_usage_basis", "offer_url"]) assert.ok(header.includes(column), column);
  for (const column of ["gsmarena_url", "chipset", "colors", "nfc"]) assert.ok(!header.includes(column), `${column} tidak lagi di templat`);
  const converted = convertUnifiedRows(parseCsv(templateTerpadu()).rows);
  assert.ok(converted.offerRows.every((row) => !row.image_url), "penawaran tanpa foto");
  assert.deepEqual(
    converted.photoRows.map((row) => [row.model_name, row.color, row.urutan, row.is_cover]),
    [["A6c", "Biru", "1", "ya"], ["A6c", "Biru", "2", ""], ["A6c", "Hitam", "1", "ya"]]
  );
  assert.equal(converted.photoRows[2]!.source_url, "https://www.blibli.com/p/contoh");
  assert.equal(converted.corrections.filter((c) => c.level === "error").length, 0);
});

test("CSV gabungan: bagian yang tidak dipilih diabaikan sejak awal", () => {
  const rows = parseCsv(templateTerpadu()).rows;
  const photosOnly = convertUnifiedRows(rows, ["photos"]);
  assert.equal(photosOnly.offerRows.length, 0);
  assert.equal(photosOnly.photoRows.length, 3);
  const offersOnly = convertUnifiedRows(rows, ["offers"]);
  assert.equal(offersOnly.offerRows.length, 2);
  assert.equal(offersOnly.photoRows.length, 0);
});

test("foto: kolom url_image dikenali, baris foto saja sah, dan foto tidak membuat baris produk palsu", () => {
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
  assert.equal(converted.offerRows.length, 1);
  assert.equal(converted.offerRows[0]!.slug, "xiaomi-redmi-17");
  assert.equal(converted.offerRows[0]!.image_url, undefined);
  // Kedua baris tanpa warna: foto ditolak dengan alasan, harga tetap masuk.
  assert.equal(converted.photoRows.length, 0);
  assert.deepEqual(converted.corrections.filter((c) => c.level === "error").map((c) => c.line), [2, 3]);
  assert.match(converted.corrections.find((c) => c.level === "error")?.note ?? "", /wajib menyebut warnanya/);
  const withColor = convertUnifiedRows([{ brand: "Xiaomi", model_name: "Redmi 17", warna: "Hitam", url_image: "https://i02.appmifile.com/contoh/lain.png" }]);
  assert.equal(withColor.photoRows.length, 1, "baris foto saja untuk produk lama kini sah");
});

test("foto: foto yang diulang per varian dihitung sekali, foto warna lain jadi baris galeri sendiri", () => {
  const base = { merek: "QAUji", model: "Foto 1", gsmarena_url: "qauji_foto_1-1.php", chipset: "Chip QA" };
  const converted = convertUnifiedRows([
    { ...base, ram: "8", storage: "128", warna: "Hitam", foto: "https://fdn2.gsmarena.com/vv/bigpic/a.jpg" },
    { merek: "QAUji", model: "Foto 1", ram: "8", storage: "256", warna: "Hitam", foto: "https://fdn2.gsmarena.com/vv/bigpic/a.jpg" },
    { merek: "QAUji", model: "Foto 1", ram: "8", storage: "128", link: "https://www.blibli.com/p/biru", harga: "1000000", warna: "Biru", foto: "https://down-id.img.susercontent.com/file/biru" },
  ]);
  assert.deepEqual(converted.photoRows.map((row) => row.color), ["Hitam", "Biru"]);
  assert.equal(converted.offerRows[0]!.image_url, undefined);
  assert.deepEqual(converted.corrections.filter((c) => c.level !== "info").map((c) => c.column), ["spesifikasi"], "hanya peringatan kolom spesifikasi diabaikan");
  assert.match(converted.corrections.find((c) => c.column === "image_url")?.note ?? "", /sama dengan baris 2/);
});

test("foto listing templat: host diizinkan, hak pakai per baris divalidasi, harga tidak pernah gagal karena foto", () => {
  const xiaomi = safeHttpsImageUrl("https://i02.appmifile.com/contoh.png");
  assert.ok(xiaomi);
  assert.equal(imageSourceName(xiaomi), "Situs resmi Xiaomi");
  assert.equal(safeHttpsImageUrl("http://i02.appmifile.com/contoh.png"), null, "wajib HTTPS");
  assert.equal(safeHttpsImageUrl("https://contoh.com/a.png"), null);

  const ok = readTemplateListingImage({ url_image: "https://down-id.img.susercontent.com/file/a" });
  assert.deepEqual(ok, { image: { url: "https://down-id.img.susercontent.com/file/a", productId: null, rights: null, color: null } });
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

// Warna dan pencocokan nama di templat terpadu (2026-10-12).
import { readErafoneListing } from "@/lib/import/offers";
import { buildColorOptions, colorSwatch } from "@/lib/catalog/colors";
import { mergeColors, normalizeColorName, sameColors } from "@/lib/import/colors";

const xiaomiCatalog = [
  { id: "n17", slug: "xiaomi-redmi-note-17", brand: "Xiaomi", model: "Redmi Note 17", is5G: true, variants: [{ id: "n17-6-128", ramGb: 6, storageGb: 128 }] },
  { id: "n17-4g", slug: "xiaomi-redmi-note-17-4g", brand: "Xiaomi", model: "Redmi Note 17 4G", is5G: false, variants: [{ id: "n174-6-128", ramGb: 6, storageGb: 128 }] },
  { id: "n17p", slug: "xiaomi-redmi-note-17-pro", brand: "Xiaomi", model: "Redmi Note 17 Pro", is5G: true, variants: [{ id: "n17p-8-256", ramGb: 8, storageGb: 256 }] },
];
const unifiedOffer = (overrides: Record<string, string>) =>
  convertUnifiedRows([{ brand: "Xiaomi", ram_gb: "6", storage_gb: "128", marketplace: "Shopee", seller_name: "Xiaomi Official Store", price_idr: "3549000", ...overrides }]);
const canonicalOf = (rows: Record<string, string>[]) => offerRowsToCanonical(rows, xiaomiCatalog, { observedAt: "2026-10-12T01:00:00.000Z" });

test("warna: kolom url dibaca dari isinya, kolom warna masuk baris penawaran dan baris foto", () => {
  const offer = unifiedOffer({ model_name: "Redmi Note 17", url: "https://shopee.co.id/x-i.1.2", warna: "Lotus Purple" }).offerRows[0]!;
  assert.equal(offer.url, "https://shopee.co.id/x-i.1.2");
  assert.equal(offer.color, "Lotus Purple");
  assert.equal(offer.product_name, "Xiaomi Redmi Note 17");
  const product = convertUnifiedRows([
    { brand: "QAUji", model_name: "Warna 2", url: "https://www.gsmarena.com/qauji_warna_2-92.php", ram_gb: "8", storage_gb: "128", chipset: "Chip", image_url: "https://fdn2.gsmarena.com/vv/bigpic/a.jpg", color: "Hitam" },
  ]);
  assert.equal(product.offerRows.length, 0, "tautan GSMArena di kolom url bukan listing toko");
  assert.match(product.corrections.find((c) => c.level === "warning")?.note ?? "", /spesifikasi .* diabaikan/);
  assert.deepEqual(product.photoRows.map((row) => row.color), ["Hitam"], "warna ikut baris foto");
  assert.equal(canonicalHeader("Warna"), "color");
  assert.equal(canonicalHeader("daftar warna"), "colors");
});

test("pencocokan nama: akhiran 5G dibuang bila jaringan sama, saudara 4G membuat baris perlu ditinjau", () => {
  const [pro5g, plain, explicit5g] = canonicalOf([
    unifiedOffer({ model_name: "REDMI Note 17 Pro 5G", ram_gb: "8", storage_gb: "256", url: "https://shopee.co.id/a-i.1.2" }).offerRows[0]!,
    unifiedOffer({ model_name: "REDMI Note 17", url: "https://shopee.co.id/b-i.1.3" }).offerRows[0]!,
    unifiedOffer({ model_name: "REDMI Note 17 5G", url: "https://shopee.co.id/b-i.1.3" }).offerRows[0]!,
  ]);
  assert.equal(pro5g!.offer?.row.slug, "xiaomi-redmi-note-17-pro");
  assert.equal(pro5g!.offer?.reviewNote, null);
  assert.equal(plain!.offer?.row.slug, "xiaomi-redmi-note-17");
  assert.match(plain!.offer?.reviewNote ?? "", /Redmi Note 17 4G/);
  assert.equal(explicit5g!.offer?.row.slug, "xiaomi-redmi-note-17");
  assert.equal(explicit5g!.offer?.reviewNote, null, "label 5G eksplisit tidak perlu ditinjau");
});

test("URL listing: parameter Shopee dibuang, tautan gambar dan host yang tidak cocok ditolak", () => {
  const [shopee, image, mismatch] = canonicalOf([
    unifiedOffer({ model_name: "Redmi Note 17 5G", url: "https://shopee.co.id/x-i.1.2?extraParams=%7B%7D" }).offerRows[0]!,
    unifiedOffer({ model_name: "Redmi Note 17 5G", url: "https://i02.appmifile.com/a.png?thumb=1" }).offerRows[0]!,
    unifiedOffer({ model_name: "Redmi Note 17 5G", url: "https://www.tokopedia.com/x" }).offerRows[0]!,
  ]);
  assert.equal(shopee!.offer?.row.url, "https://shopee.co.id/x-i.1.2");
  assert.match(image!.issue ?? "", /tautan gambar/);
  assert.match(mismatch!.issue ?? "", /bukan halaman Shopee/);
});

test("warna: Erafone dari akhiran judul, nama dirapikan, gabungan tanpa duplikat", () => {
  const listing = readErafoneListing({ a: "https://erafone.com/produk/x", b: "Xiaomi Redmi Note 17 Pro 8/256GB - Cloud Blush", c: "Rp 5.799.000" });
  assert.equal(listing?.color, "Cloud Blush");
  assert.equal(listing?.matchTitle, "Xiaomi Redmi Note 17 Pro 8/256GB");
  assert.equal(normalizeColorName("  Oak   Green "), "Oak Green");
  assert.equal(normalizeColorName("-"), null);
  assert.deepEqual(mergeColors(["Black"], ["black", "Green"]), ["Black", "Green"]);
  assert.ok(sameColors(["Black", "Green"], ["green", "BLACK"]));
});

test("pilihan warna: warna foto utama dipilih bawaan, galeri mengikuti warna, harga tidak tersentuh", () => {
  const photos = [
    { src: "/a.webp", alt: "a", source: "Shopee", color: "Black" },
    { src: "/b.webp", alt: "b", source: "Shopee", color: "Oak Green" },
    { src: "/c.webp", alt: "c", source: "Shopee", color: "Black" },
  ];
  const base = { photos, offerColors: [["Black", "Lotus Purple"]], selectedVariantOfferColors: [["Black"], ["black"]] };
  const auto = buildColorOptions({ ...base, requestedKey: undefined });
  assert.deepEqual(auto.options.map((o) => o.key), ["black", "oak-green", "lotus-purple"]);
  assert.equal(auto.selected?.name, "Black");
  assert.deepEqual(auto.gallery.map((p) => p.src), ["/a.webp", "/c.webp"]);
  assert.equal(auto.options[0]!.offerCount, 2);
  assert.equal(auto.options[2]!.thumbnail, null, "warna tanpa foto tidak meminjam foto warna lain");

  const purple = buildColorOptions({ ...base, requestedKey: "lotus-purple" });
  assert.equal(purple.selected?.name, "Lotus Purple");
  assert.equal(purple.gallery.length, 0, "tanpa foto warna itu dan tanpa foto umum: ilustrasi generik, bukan foto warna lain");
  const withGeneral = buildColorOptions({
    ...base,
    photos: [...photos, { src: "/umum.webp", alt: "umum", source: "GSMArena", color: null }],
    requestedKey: "lotus-purple",
  });
  assert.deepEqual(withGeneral.gallery.map((p) => p.src), ["/umum.webp"], "warna tanpa foto memakai foto umum");
  const ordered = buildColorOptions({
    ...base,
    photos: [
      { src: "/k3.webp", alt: "", source: "", color: "Black", sortOrder: 3 },
      { src: "/k2.webp", alt: "", source: "", color: "Black", sortOrder: 2 },
      { src: "/sampul.webp", alt: "", source: "", color: "Black", sortOrder: 9, isCover: true },
    ],
    requestedKey: "black",
  });
  assert.deepEqual(ordered.gallery.map((p) => p.src), ["/sampul.webp", "/k2.webp", "/k3.webp"], "sampul dulu, lalu urutan");
  assert.equal(buildColorOptions({ ...base, requestedKey: "tidak-ada" }).selected?.name, "Black");

  const noPhotos = buildColorOptions({ photos: [], offerColors: [["Black"]], selectedVariantOfferColors: [], requestedKey: undefined });
  assert.equal(noPhotos.selected, null, "tanpa foto berwarna, judul tidak mengklaim warna");
  assert.equal(colorSwatch("Oak Green"), colorSwatch("Green"));
  assert.equal(colorSwatch("F9 Pro"), null);
});

// Galeri foto per warna (2026-10-12).
import { colorInOptions } from "@/lib/import/colors";
import { findSamePhoto, galleryLimitIssue, shouldBecomeCover, MAX_PHOTOS_PER_COLOR } from "@/lib/import/photo-rules";
import { looksLikeGalleryHeaders, planGalleryRows, readGalleryRow, templateGaleri } from "@/lib/import/photo-gallery-rows";
import { mergeGallerySummaries } from "@/lib/import/report";

test("warna spesifikasi: nama dalam kurung dihitung, kolom colors tidak membuat baris produk", () => {
  assert.ok(colorInOptions("Deep Blue", ["Absolute Black", "Deep Blue (Endless Blue)"]));
  assert.ok(colorInOptions("endless blue", ["Deep Blue (Endless Blue)"]));
  assert.ok(!colorInOptions("Celestian Purple", ["Celestial Purple", "Black"]));
  assert.ok(colorInOptions("Apa saja", null), "tanpa daftar warna tidak ada yang dicek");
  const converted = convertUnifiedRows([
    { brand: "Xiaomi", model_name: "17T", ram_gb: "12", storage_gb: "256", colors: "Black, Violet", color: "Black", offer_url: "https://shopee.co.id/a-i.1.2", marketplace: "Shopee", seller_name: "Toko", price_idr: "8999000" },
  ]);
  assert.equal(converted.offerRows.length, 1, "daftar warna di berkas harga tidak mengganggu penawaran");
});

test("aturan galeri: foto dikenali dari URL + warna, batas per warna, sampul tidak menimpa", () => {
  const photos = [
    { id: "a", original_url: "u1", color: null, is_cover: false },
    { id: "b", original_url: "u2", color: "Black", is_cover: true },
  ];
  assert.equal(findSamePhoto(photos, "u2", "black")?.id, "b", "huruf besar warna tidak membedakan");
  assert.equal(findSamePhoto(photos, "u1", "Green")?.id, "a", "foto tanpa warna diklaim warnanya");
  assert.equal(findSamePhoto(photos, "u2", "Green"), undefined, "URL sama untuk warna lain = foto lain");
  assert.equal(shouldBecomeCover(photos, "Black", true), false, "sampul yang ada tidak ditimpa");
  assert.equal(shouldBecomeCover(photos, "Green", true), true);
  const full = Array.from({ length: MAX_PHOTOS_PER_COLOR }, (_, i) => ({ id: String(i), original_url: `x${i}`, color: "Lotus Purple" }));
  assert.match(galleryLimitIssue(full, "lotus purple") ?? "", /Warna "lotus purple" sudah berisi 6 foto; foto ke-7/);
  assert.equal(galleryLimitIssue(full, "Black"), null);
});

test("berkas galeri: dikenali dari kolomnya, baris dibaca, rencana mendahulukan sampul dan urutan kecil", () => {
  const header = templateGaleri().split("\n")[0]!.split(",");
  assert.ok(looksLikeGalleryHeaders(header));
  assert.ok(!looksLikeGalleryHeaders([...header, "ram_gb", "storage_gb"]), "berkas berharga/varian bukan galeri");
  assert.deepEqual(detect(templateGaleri()), { kind: "photos", format: "photo-gallery" });
  assert.equal(readGalleryRow({ brand: "Xiaomi", model_name: "17T", color: "", image_url: "https://x" }).ok, false);

  const products = [{ id: "p17t", slug: "xiaomi-17t", brand: "Xiaomi", model: "17T", colorOptions: ["Black", "Opal White"], variants: [] }];
  const row = (color: string, n: number, cover = "tidak", host = "down-id.img.susercontent.com") => ({
    brand: "Xiaomi", model_name: "17T", color, urutan: String(n), is_cover: cover, image_url: `https://${host}/file/${color}-${n}`,
  });
  const rows = [
    ...Array.from({ length: 7 }, (_, i) => row("Black", 7 - i)), // urutan 7..1, terbalik
    row("Black", 9, "ya"),
    row("Violet", 1),
    row("Black", 1, "tidak", "contoh.com"),
    { brand: "Xiaomi", model_name: "17T Ultra Max", color: "Black", image_url: "https://down-id.img.susercontent.com/file/z" },
  ];
  const plan = planGalleryRows(rows, {
    products,
    existing: new Map([["p17t", [{ id: "lama", original_url: "https://down-id.img.susercontent.com/file/Black-1", color: "Black", is_cover: false }]]]),
    defaultRights: { basis: "admin-declared", text: "uji" },
  });
  const byRow = (i: number) => plan.find((item) => item.rowIndex === i)!;
  assert.equal(byRow(6).action, "unchanged", "urutan 1 sudah tersimpan");
  assert.equal(byRow(7).action, "create", "sampul didahulukan walau urutannya 9");
  const created = plan.filter((item) => item.action === "create" && item.photo?.color === "Black").map((item) => item.photo!.sortOrder);
  assert.deepEqual(created.sort((a, b) => a - b), [2, 3, 4, 5, 9], "5 foto baru + 1 lama = 6");
  assert.match(byRow(0).reason ?? "", /sudah berisi 6 foto/, "urutan terbesar yang terlewat");
  assert.equal(byRow(8).colorReview, true, "Violet di luar daftar warna: Perlu tinjau");
  assert.match(byRow(9).reason ?? "", /host-nya belum diizinkan/);
  assert.match(byRow(10).reason ?? "", /tidak ditemukan di katalog/);
  const noRights = planGalleryRows([row("Black", 3)], { products, existing: new Map(), defaultRights: null });
  assert.match(noRights[0]!.reason ?? "", /hak pakai/);
  assert.deepEqual(
    mergeGallerySummaries({ fileName: "a", totalRows: 2, queued: 1, unchanged: 1, skipped: [] }, { fileName: "a", totalRows: 3, queued: 2, unchanged: 0, skipped: [{ label: "x", reason: "y" }] }),
    { fileName: "a", totalRows: 5, queued: 3, unchanged: 1, skipped: [{ label: "x", reason: "y" }] }
  );
});

import { groupPhotosByColor, movePhoto } from "@/lib/import/photo-rules";

test("panel foto: grup per warna (umum paling akhir), sampul dulu, naik/turun dalam batas", () => {
  const p = (id: string, color: string | null, sort: number, cover = false) => ({ id, original_url: id, color, is_cover: cover, sort_order: sort, created_at: `2026-10-12T00:00:0${sort}Z` });
  const groups = groupPhotosByColor([p("u", null, 0), p("b2", "Black", 2), p("b1", "black", 1), p("bc", "Black", 5, true), p("g", "Green", 0)]);
  assert.deepEqual(groups.map((g) => g.color), ["Black", "Green", null]);
  assert.deepEqual(groups[0]!.photos.map((x) => x.id), ["bc", "b1", "b2"]);
  assert.deepEqual(movePhoto(["a", "b", "c"], "b", "up"), ["b", "a", "c"]);
  assert.deepEqual(movePhoto(["a", "b", "c"], "c", "down"), null);
  assert.deepEqual(movePhoto(["a", "b"], "x", "up"), null);
});

test("galeri: merek tidak digandakan bila model sudah memuat merek; link foto Samsung dirapikan", () => {
  const read = readGalleryRow({ brand: "Samsung", model_name: "Samsung Galaxy A57 5G ", color: "Awesome Gray", image_url: "https://images.samsung.com/x/a?imbypass=true", is_cover: "tidak " });
  assert.ok(read.ok);
  assert.equal(read.ok && read.row.name, "Samsung Galaxy A57 5G");
  assert.equal(read.ok && read.row.isCover, false);
  const products = [{ id: "a57", slug: "samsung-galaxy-a57", brand: "Samsung", model: "Galaxy A57", is5G: true, variants: [] }];
  const plan = planGalleryRows(
    [
      { brand: "Samsung", model_name: "Samsung Galaxy A57 5G", color: "Gray", image_url: "https://images.samsung.com/is/image/samsung/p6pim/id/a-1?imbypass=true" },
      { brand: "Samsung", model_name: "Samsung Galaxy A57 5G", color: "Gray", image_url: "https://images.samsung.com/is/image/samsung/p6pim/id/a-1?$LazyLoad_Home_JPG$" },
    ],
    { products, existing: new Map(), defaultRights: { basis: "admin-declared", text: "uji" } }
  );
  assert.deepEqual(plan.map((i) => i.action), ["create", "unchanged"], "parameter berbeda = foto yang sama");
  assert.equal(plan[0]!.photo?.url, "https://images.samsung.com/is/image/samsung/p6pim/id/a-1");
  assert.equal(safeHttpsImageUrl("https://images.samsung.com/a?$650_519_PNG$")?.href, "https://images.samsung.com/a");
});

import { refreshAlerts, type RefreshRun } from "@/lib/import/price-refresh-rules";

test("PB-05 peringatan pemeriksaan harian: belum jalan, gagal hari ini, dan lama tidak berhasil", () => {
  // 16 Okt 2026 10.00 WIB
  const now = new Date("2026-10-16T03:00:00Z");
  const run = (brand: string, runDate: string, status: RefreshRun["status"], message: string | null = null): RefreshRun => ({
    brand,
    runDate,
    status,
    message,
  });
  const alerts = refreshAlerts(
    [
      run("vivo", "2026-10-16", "queued"),
      run("oppo", "2026-10-16", "blocked", "Turnstile"),
      run("samsung", "2026-10-16", "nothing-to-update"),
      run("xiaomi", "2026-10-13", "queued"),
      run("xiaomi", "2026-10-16", "no-offers"),
      run("itel", "2026-10-16", "no-offers"),
    ],
    now
  );
  assert.deepEqual(alerts, [
    { kind: "gagal", brand: "oppo", status: "blocked", message: "Turnstile" },
    { kind: "lama-tidak-berhasil", brand: "xiaomi", lastSuccess: "2026-10-13" },
  ]);

  assert.deepEqual(refreshAlerts([], now), [{ kind: "belum-jalan", runDate: "2026-10-16" }]);
  assert.deepEqual(refreshAlerts([], new Date("2026-10-15T23:30:00Z")), [], "06.30 WIB: cron mungkin belum dipanggil");
});

import { planPricesOnly } from "@/lib/scrape/prices-only-rules";

test("PB-16 harga saja: hanya produk dan varian katalog, tanpa mengarang", () => {
  const products = [
    { id: "p1", slug: "xiaomi-redmi-17", brand: "Xiaomi", model: "Redmi 17", is5G: true, colorOptions: null, variants: [{ id: "v1", ramGb: 4, storageGb: 128 }, { id: "v2", ramGb: 6, storageGb: 128 }] },
    { id: "p2", slug: "samsung-galaxy-a57", brand: "Samsung", model: "Galaxy A57", is5G: true, colorOptions: null, variants: [{ id: "v3", ramGb: 8, storageGb: 256 }] },
  ];
  const item = (officialName: string, extra: Partial<LineupItemForTest>): LineupItemForTest => ({
    officialId: officialName,
    brand: "xiaomi",
    officialName,
    officialUrl: "https://www.mi.co.id/id/product/x/",
    prices: [],
    storageOnlyPrices: [],
    unassignedPrices: [],
    priceIssues: [],
    siblingHas5g: false,
    gsmarenaPath: null,
    ...extra,
  });
  const plan = planPricesOnly({
    lineup: [
      item("Redmi 17", { prices: [
        { ramGb: 4, storageGb: 128, priceIdr: 2_899_000, isPromotion: false },
        { ramGb: 8, storageGb: 256, priceIdr: 3_999_000, isPromotion: false },
      ] }),
      item("Redmi 99", { prices: [{ ramGb: 4, storageGb: 128, priceIdr: 1, isPromotion: false }] }),
      item("Redmi 17", { officialId: "luar", officialUrl: "https://contoh.com/redmi" }),
    ],
    products,
    source: { marketplace: "Situs resmi Xiaomi Indonesia", sellerName: "Xiaomi Indonesia", host: "www.mi.co.id" },
    brandName: "Xiaomi",
    observedAt: "2026-10-16T00:00:00.000Z",
  });
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0]!.slug, "xiaomi-redmi-17");
  assert.equal(plan.rows[0]!.price_idr, "2899000");
  assert.deepEqual(plan.unmatched, ["Xiaomi Redmi 99"]);
  assert.ok(plan.notes.some((note) => /8\/256 GB tidak tercatat/.test(note.reason)));
  assert.ok(plan.notes.some((note) => /tidak berada di situs resmi/.test(note.reason)));

  const samsung = planPricesOnly({
    lineup: [item("Galaxy A57 5G", { brand: "samsung", officialUrl: "https://www.samsung.com/id/a57/", storageOnlyPrices: [{ storageGb: 256, priceIdr: 6_499_000, isPromotion: false }] })],
    products,
    source: { marketplace: "Situs resmi Samsung Indonesia", sellerName: "Samsung Indonesia", host: "www.samsung.com" },
    brandName: "Samsung",
    observedAt: "2026-10-16T00:00:00.000Z",
  });
  assert.deepEqual([samsung.rows[0]?.ram_gb, samsung.rows[0]?.storage_gb], ["8", "256"], "RAM diambil dari satu-satunya varian katalog");
});

type LineupItemForTest = import("@/lib/scrape/types").LineupItem;

// Galeri vivo 2026-10-17: host resmi vivo, nama tanpa spasi, foto ganda lintas
// warna, dan latar biru muda kanvas vivo.

import { removePlainBackground } from "@/lib/import/image-matte";

test("galeri vivo: host resmi diizinkan, V70FE cocok ke V70 FE dengan tinjau, URL ganda lintas warna ditandai", () => {
  assert.ok(safeHttpsImageUrl("https://asia-exstatic-vivofs.vivo.com/PSee2l50xoirPK7y/Picture_library/1/zip/img/pc3.jpg"));
  assert.equal(safeHttpsImageUrl("http://asia-exstatic-vivofs.vivo.com/a.jpg"), null, "tetap wajib HTTPS");

  const products = [
    { id: "v70fe", slug: "vivo-v70-fe", brand: "vivo", model: "V70 FE", colorOptions: null, variants: [] },
    { id: "y05", slug: "vivo-y05", brand: "vivo", model: "Y05", colorOptions: null, variants: [] },
    { id: "z10", slug: "iqoo-z10", brand: "iQOO", model: "Z10", colorOptions: null, variants: [] },
  ];
  const vivo = (model: string, color: string, file: string) => ({
    brand: "Vivo", model_name: model, color, urutan: "1", is_cover: "ya", image_url: `https://asia-exstatic-vivofs.vivo.com/x/${file}`,
  });
  const plan = planGalleryRows(
    [vivo("vivo V70FE", "Ocean Blue", "a.jpg"), vivo("vivo Y05", "Hitam Malam", "y.png"), vivo("vivo Y05", "Biru Langit", "y.png"), vivo("iQOO Z10R", "Black", "z.jpg")],
    { products, existing: new Map(), defaultRights: { basis: "admin-declared", text: "uji" } }
  );
  assert.equal(plan[0]!.action, "create");
  assert.equal(plan[0]!.colorReview, true);
  assert.match(plan[0]!.reason ?? "", /penulisan spasinya berbeda/);
  assert.match(plan[1]!.reason ?? "", /juga dipakai untuk warna Biru Langit/);
  assert.equal(plan[2]!.colorReview, true);
  assert.match(plan[3]!.reason ?? "", /tidak ditemukan di katalog/, "Z10R bukan Z10");
});

test("matte: latar terang seragam di sudut (biru muda vivo) dihapus, bodi pastel tetap utuh", () => {
  const canvas = (width: number, height: number, bg: number[], body: number[]) => {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inside = x >= 3 && x < width - 3 && y >= 2 && y < height - 2;
        data.set([...(inside ? body : bg), 255], (y * width + x) * 4);
      }
    }
    return data;
  };
  const vivoBg = [242, 250, 253];
  const lavender = [235, 230, 245];
  const data = canvas(12, 10, vivoBg, lavender);
  const result = removePlainBackground(data, 12, 10);
  assert.equal(result.applied, true, "biru muda vivo dianggap latar");
  assert.equal(data[3], 0, "sudut transparan");
  assert.equal(data[(5 * 12 + 6) * 4 + 3], 255, "bodi lavender tetap utuh");

  const busy = canvas(12, 10, [120, 160, 200], lavender);
  assert.equal(removePlainBackground(busy, 12, 10).applied, false, "latar gelap/berwarna tidak disentuh");
});

import { prepareOfferRow } from "@/lib/import/offers";

test("templat terpadu: slug salah salin tidak mengalahkan merek + model (vivo Y05 ber-slug Samsung)", () => {
  const products = [
    { id: "a07", slug: "samsung-galaxy-a07-4g", brand: "Samsung", model: "Galaxy A07 4G", is5G: false, colorOptions: null, variants: [{ id: "va", ramGb: 4, storageGb: 64 }] },
    { id: "y05", slug: "vivo-y05", brand: "vivo", model: "Y05", is5G: false, colorOptions: null, variants: [{ id: "vy", ramGb: 4, storageGb: 64 }] },
  ];
  const sheetRow = (slug: string) => ({
    brand: "Vivo", model_name: "vivo Y05", slug, ram_gb: "4", storage_gb: "64", color: "Hitam Malam",
    marketplace: "Shopee", seller_name: "Vivo Official Store", offer_url: "https://shopee.co.id/vivo-y05-i.30843261.45256316103",
    price_idr: "Rp2.649.000", listing_status: "active",
  });
  const toOffer = (slug: string) => {
    const converted = convertUnifiedRows([sheetRow(slug)]);
    const row = converted.offerRows[0]!;
    return prepareOfferRow(row, products, { observedAt: "2026-10-17T00:00:00.000Z" });
  };
  const wrong = toOffer("samsung-galaxy-a07-4g");
  assert.equal(wrong.ok, false);
  assert.match(!wrong.ok ? wrong.reason : "", /milik Samsung Galaxy A07 4G, tidak cocok dengan "vivo Y05"/);
  const right = toOffer("vivo-y05");
  assert.equal(right.ok, true, "slug yang benar tetap diterima");
  const empty = toOffer("");
  assert.equal(empty.ok, true, "slug kosong dicari lewat nama");
});

test("peringatan harga harian: batch pemeriksaan yang antre lama ikut diperingatkan", () => {
  const now = new Date("2026-10-17T03:00:00Z"); // 10.00 WIB
  const runs: RefreshRun[] = [{ brand: "xiaomi", runDate: "2026-10-17", status: "queued", message: null }];
  assert.deepEqual(refreshAlerts(runs, now), [], "pengambilan berhasil dan tidak ada batch macet");
  assert.deepEqual(refreshAlerts(runs, now, { count: 2, oldestCreatedAt: "2026-10-16T23:39:25Z" }), [
    { kind: "antre-lama", count: 2, since: "2026-10-16T23:39:25Z" },
  ]);
  assert.deepEqual(refreshAlerts(runs, now, null), []);
});

import { looksLikeAccessory } from "@/lib/scrape/parsers";

test("daftar model situs resmi: aksesori tidak ikut dilaporkan sebagai model (temuan Sprint 11)", () => {
  for (const name of [
    "OPPO Hasselblad Teleconverter Find X9 Ultra",
    "OPPO Pencil 2R",
    "Xiaomi 67W HyperCharge Combo (Type-A)",
    "Xiaomi 17 Ultra Photography Kit Pro",
    "Xiaomi 33W Charging Combo (Type-A)",
    "Xiaomi Mi Selfie Stick Tripod",
    "Xiaomi Selfie Stick",
  ]) assert.equal(looksLikeAccessory(name), true, name);
  for (const name of ["OPPO A6t Pro 5G [Online Exclusive]", "Xiaomi POCO F9 Ultra 5G", "Samsung Galaxy A07 Power Pack", "Xiaomi 17 Ultra"]) {
    assert.equal(looksLikeAccessory(name), false, name);
  }
});
