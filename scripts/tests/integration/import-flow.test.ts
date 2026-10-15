// Uji integrasi sistem impor terhadap database NYATA (docs/qa/TEST-PLAN.md §5.3).
// Jalankan: pnpm test:integration   (butuh .env.local berisi INSFORGE_URL dan INSFORGE_API_KEY)
//
// Semua data uji memakai merek penanda "QAUji" / label "QA-UJI" dan dihapus
// sebelum dan sesudah tes, termasuk objek storage. Jangan jalankan paralel
// dengan sesi lain yang memakai penanda yang sama.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import {
  createBatch,
  getBatch,
  getFollowUpBatchId,
  purgeScheduledBatches,
  queueBatch,
} from "@/lib/import/batches";
import { processBatchStep } from "@/lib/import/jobs";
import { purgePhotoJobs } from "@/lib/import/photo-jobs";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/import/product-images";
import { executeUndo, planUndo } from "@/lib/import/undo";

const actor = { userId: "", email: "qa-integrasi@cekharga.local", role: "admin" as const };
const client = getInsforgeAdminClient();
const db = client.database;
const bucket = client.storage.from(PRODUCT_IMAGE_BUCKET);
const batches: string[] = [];
const storageKeys: string[] = [];

const spec = (tag: string, n: number) => ({
  brand: "QAUji", model_name: `${tag} ${n}`, url: `qauji_${tag.toLowerCase()}_${n}-9${n}.php`, device_type: "phone",
  announced: "2026", memory_variants_summary: "128GB/8GB", chipset: "Chip QA",
});
const officialPrice = (tag: string, n: number, idr: number) => ({
  source_key: `gsmarena:qauji_${tag.toLowerCase()}_${n}-9${n}`, ram_gb: "8", storage_gb: "128",
  marketplace: "vivo Indonesia", seller_name: "vivo Indonesia", url: `https://www.vivo.com/id/products/qauji-${tag.toLowerCase()}-${n}`,
  warranty: "", listing_status: "active", seller_verified: "tidak", price_idr: String(idr),
  observed_at: new Date(Date.now() - 3_600_000).toISOString(),
});

async function cleanup() {
  // Produk dan riwayat harga tidak bisa dihapus permanen (aturan system
  // design 8); data uji dibersihkan lewat RPC khusus merek QAUji.
  const purged = await db.rpc("qa_purge_test_data");
  if (purged.error) throw new Error(`Data uji gagal dibersihkan: ${purged.error.message}`);
  for (const key of storageKeys.splice(0)) await bucket.remove(key);
  await db.from("photo_jobs").delete().like("image_url", "https://qa-uji.invalid/%");
  await db.from("photo_jobs").delete().like("image_url", "https://down-id.img.susercontent.com/file/qa-uji-%");
  const labelled = ((await db.from("import_batches").select("id").like("source_label", "QA-UJI%")).data ?? []) as { id: string }[];
  const ids = [...new Set([...batches.splice(0), ...labelled.map((b) => b.id)])];
  if (ids.length) await db.from("import_batches").delete().in("id", ids);
  await db.from("admin_audit").delete().eq("actor_email", actor.email);
}

async function applyAll(batchId: string) {
  const batch = (await getBatch(batchId))!;
  const queued = await queueBatch(batchId, batch.items.filter((i) => i.action !== "skip").map((i) => i.id), actor);
  assert.ok(queued.ok, JSON.stringify(queued));
  let step = await processBatchStep(batchId);
  while (step.claimed && step.status === "applying") step = await processBatchStep(batchId);
}

async function productsByModel() {
  const rows = ((await db
    .from("products")
    .select("id, model, status, created_by_batch_id, last_source")
    .eq("brand", "QAUji")
    .is("deleted_at", null)).data ?? []) as Record<string, string>[];
  return Object.fromEntries(rows.map((row) => [row.model, row]));
}

before(cleanup);
after(cleanup);

test("INT-01 tarik otomatis: spesifikasi + harga resmi, jejak asal, undo terbatas", async () => {
  const created = await createBatch({
    kind: "specs", origin: "scrape", sourceLabel: "QA-UJI undo",
    options: { imageRights: null, followUpOffers: { sourceLabel: "QA-UJI undo harga", defaultObservedAt: new Date().toISOString(),
      rows: [officialPrice("Undo", 1, 3e6), officialPrice("Undo", 2, 4e6), officialPrice("Undo", 3, 5e6)] } },
    rows: [spec("Undo", 1), spec("Undo", 2), spec("Undo", 3)], malformedLines: [], admin: actor,
  });
  assert.ok(created.ok);
  batches.push(created.id);
  await applyAll(created.id);
  const childId = (await getFollowUpBatchId(created.id))!;
  assert.ok(childId, "batch harga resmi lanjutan dibuat");
  batches.push(childId);
  let step = await processBatchStep(childId);
  while (step.claimed && step.status === "applying") step = await processBatchStep(childId);

  const byModel = await productsByModel();
  for (const product of Object.values(byModel)) {
    assert.equal(product.created_by_batch_id, created.id);
    assert.equal(product.last_source, "scrape");
    assert.equal(product.status, "draft", "produk baru selalu draft");
  }

  // Setelah diterapkan: satu disunting manual, satu diterbitkan.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await db.from("products").update({ last_source: "manual", updated_by_batch_id: null }).eq("id", byModel["Undo 2"].id);
  await db.from("products").update({ status: "published" }).eq("id", byModel["Undo 3"].id);

  const plan = (await planUndo(created.id))!;
  assert.deepEqual(plan.products.remove.map((d) => d.label), ["QAUji Undo 1"]);
  const result = await executeUndo(created.id, actor);
  assert.ok(result.ok, JSON.stringify(result));
  assert.deepEqual(Object.keys(await productsByModel()).sort(), ["Undo 2", "Undo 3"]);
  const offersLeft = ((await db
    .from("offers")
    .select("url")
    .like("url", "https://www.vivo.com/id/products/qauji-undo-%")
    .is("deleted_at", null)).data ?? []) as { url: string }[];
  assert.deepEqual(offersLeft.map((o) => o.url.split("/").pop()), ["qauji-undo-3"], "penawaran produk terbit dilindungi");

  // Hapus lunak (aturan system design 8): baris produk dan riwayat harganya
  // tetap ada, hanya ditandai terhapus/batal.
  const hidden = ((await db.from("products").select("deleted_at, status").eq("id", byModel["Undo 1"].id)).data ?? []) as {
    deleted_at: string | null; status: string;
  }[];
  assert.ok(hidden[0]?.deleted_at, "produk yang diurungkan dihapus lunak, bukan permanen");
  assert.equal(hidden[0]?.status, "draft");
  const prices = ((await db.from("price_observations").select("voided_at").eq("batch_id", childId)).data ?? []) as {
    voided_at: string | null;
  }[];
  assert.ok(prices.length >= 2, "riwayat harga batch yang diurungkan tetap tersimpan");
  assert.equal(prices.filter((p) => p.voided_at).length, prices.length - 1, "hanya harga produk terbit yang tidak dibatalkan");
  const hardDelete = await db.from("price_observations").delete().eq("batch_id", childId);
  assert.ok(hardDelete.error, "database menolak penghapusan riwayat harga");

  // Impor ulang data yang sama memulihkan produk yang diurungkan sebagai draft.
  const again = await createBatch({
    kind: "specs", origin: "csv", sourceLabel: "QA-UJI impor ulang", options: {},
    rows: [spec("Undo", 1)], malformedLines: [], admin: actor,
  });
  assert.ok(again.ok);
  batches.push(again.id);
  const againItems = (await getBatch(again.id))!.items;
  assert.equal(againItems[0]?.action, "update", "produk terhapus dikenali, bukan dibuat ganda");
  await applyAll(again.id);
  const revived = await productsByModel();
  assert.ok(revived["Undo 1"], "produk dipulihkan oleh impor ulang");
  assert.equal(revived["Undo 1"].status, "draft");
  assert.equal((await getBatch(created.id))!.status, "reverted");
  assert.equal((await executeUndo(created.id, actor)).ok, false, "undo kedua ditolak");
});

test("INT-02 draft basi ditolak saat diterapkan", async () => {
  const stale = await createBatch({ kind: "specs", origin: "csv", sourceLabel: "QA-UJI basi", options: {}, rows: [spec("Basi", 1)], malformedLines: [], admin: actor });
  assert.ok(stale.ok);
  batches.push(stale.id);
  await db.from("import_batches").update({ created_at: new Date(Date.now() - 20 * 86_400_000).toISOString() }).eq("id", stale.id);
  const queued = await queueBatch(stale.id, (await getBatch(stale.id))!.items.map((i) => i.id), actor);
  assert.equal(queued.ok, false);
});

test("INT-03 undo menghapus foto buatan batch di produk draft, melindungi produk terbit, menunggu foto berjalan", async () => {
  const created = await createBatch({ kind: "specs", origin: "csv", sourceLabel: "QA-UJI foto", options: {},
    rows: [spec("Foto", 1), spec("Foto", 2), spec("Foto", 3)], malformedLines: [], admin: actor });
  assert.ok(created.ok);
  batches.push(created.id);
  await applyAll(created.id);
  const by = await productsByModel();
  await new Promise((resolve) => setTimeout(resolve, 1100));

  const addPhoto = async (productId: string, label: string) => {
    const key = `qa-uji/${productId}/${label}.txt`;
    assert.ok(!(await bucket.upload(key, new Blob([label], { type: "text/plain" }))).error);
    storageKeys.push(key);
    const inserted = await db.from("product_assets").insert([{
      product_id: productId, kind: "photo", src: `https://qa-uji.invalid/${label}.jpg`, alt: label, source: "QA",
      retrieved_at: new Date().toISOString(), usage_rights: "QA", usage_basis: "admin-declared",
      storage_key: key, original_url: `https://qa-uji.invalid/${label}.jpg`, created_by_batch_id: created.id,
    }]);
    assert.ok(!inserted.error, JSON.stringify(inserted.error));
    return key;
  };
  await addPhoto(by["Foto 1"].id, "f1");
  const key2 = await addPhoto(by["Foto 2"].id, "f2");
  const key3 = await addPhoto(by["Foto 3"].id, "f3");
  await db.from("products").update({ last_source: "manual", updated_by_batch_id: null }).eq("id", by["Foto 2"].id);
  await db.from("products").update({ status: "published" }).eq("id", by["Foto 3"].id);
  const job = (name: string, status: string, leaseMs: number | null) => ({
    product_id: by["Foto 2"].id, kind: "gallery", image_url: `https://qa-uji.invalid/${name}.jpg`, source: "QA", alt: name,
    rights: { basis: "admin-declared", text: "QA" }, batch_id: created.id, status,
    lease_until: leaseMs === null ? null : new Date(Date.now() + leaseMs).toISOString(),
  });
  assert.ok(!(await db.from("photo_jobs").insert([job("antre", "pending", null), job("jalan", "running", 60_000)])).error);

  assert.deepEqual((await planUndo(created.id))!.photos, { remove: 1, protected: 1 });
  assert.equal((await executeUndo(created.id, actor)).ok, false, "ditolak selama foto sedang diunggah");

  await db.from("photo_jobs").update({ lease_until: new Date(Date.now() - 1000).toISOString() }).eq("image_url", "https://qa-uji.invalid/jalan.jpg");
  const done = await executeUndo(created.id, actor);
  assert.ok(done.ok && done.result.photos === 1, JSON.stringify(done));
  const left = ((await db.from("product_assets").select("alt").eq("created_by_batch_id", created.id)).data ?? []) as { alt: string }[];
  assert.deepEqual(left.map((a) => a.alt), ["f3"]);
  const jobs = ((await db.from("photo_jobs").select("status").like("image_url", "https://qa-uji.invalid/%")).data ?? []) as { status: string }[];
  assert.ok(jobs.every((j) => j.status === "skipped"), "antrean foto batch dibatalkan");
  assert.ok((await bucket.download(key2)).error, "objek foto produk draft terhapus");
  assert.ok(!(await bucket.download(key3)).error, "objek foto produk terbit tetap ada");
});

test("INT-04 retensi antrean foto dan batch terjadwal, kunci harian unik", async () => {
  const products = await productsByModel();
  const productId = Object.values(products)[0]?.id;
  assert.ok(productId, "butuh satu produk QAUji dari tes sebelumnya");
  const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const job = (name: string, updatedAt: string) => ({
    product_id: productId, kind: "gallery", image_url: `https://qa-uji.invalid/${name}.jpg`, source: "QA", alt: name,
    rights: { basis: "admin-declared", text: "QA" }, status: "done", updated_at: updatedAt,
  });
  assert.ok(!(await db.from("photo_jobs").insert([job("lama", old), job("baru", new Date().toISOString())])).error);
  await purgePhotoJobs();
  const names = (((await db.from("photo_jobs").select("image_url").like("image_url", "https://qa-uji.invalid/%")).data ?? []) as { image_url: string }[])
    .map((j) => j.image_url.split("/").pop());
  assert.ok(!names.includes("lama.jpg") && names.includes("baru.jpg"));

  const scheduled = (key: string, label: string, createdAt?: string) => ({
    kind: "offers", origin: "schedule", source_label: label, options: { refreshKey: key }, rows: [], malformed_lines: [],
    counts: {}, status: "applied", created_at: createdAt ?? new Date().toISOString(),
  });
  const first = await db.from("import_batches").insert([scheduled("qauji:2026-08-01", "QA-UJI terjadwal lama", old)]).select("id");
  assert.ok(!first.error, JSON.stringify(first.error));
  const duplicate = await db.from("import_batches").insert([scheduled("qauji:2026-08-01", "QA-UJI kunci ganda")]).select("id");
  assert.ok(duplicate.error, "kunci pemeriksaan harian ganda ditolak database");
  await purgeScheduledBatches();
  const still = await db.from("import_batches").select("id").eq("id", (first.data as { id: string }[])[0].id);
  assert.equal((still.data ?? []).length, 0, "batch terjadwal > 30 hari terhapus");
});

test("INT-05 impor ulang sebagai patch: sel kosong tidak menghapus, '-' mengosongkan", async () => {
  const first = await createBatch({
    kind: "specs", origin: "csv", sourceLabel: "QA-UJI patch 1", options: {},
    rows: [{ ...spec("Patch", 1), nfc: "Yes", ip_rating: "IP68" }], malformedLines: [], admin: actor,
  });
  assert.ok(first.ok);
  batches.push(first.id);
  await applyAll(first.id);

  // Impor ulang: NFC kosong (tidak diubah), chipset "-" (dikosongkan), IP baru.
  const second = await createBatch({
    kind: "specs", origin: "csv", sourceLabel: "QA-UJI patch 2", options: {},
    rows: [{ ...spec("Patch", 1), nfc: "", chipset: "-", ip_rating: "IP69" }], malformedLines: [], admin: actor,
  });
  assert.ok(second.ok);
  batches.push(second.id);
  const changes = (await getBatch(second.id))!.items[0]!.changes.map((c) => c.field).sort();
  assert.deepEqual(changes, ["Chipset", "IP rating"], "pratinjau hanya menampilkan perubahan nyata");
  await applyAll(second.id);
  const product = ((await db.from("products").select("specs").eq("source_key", "gsmarena:qauji_patch_1-91")).data ?? [])[0] as
    | { specs: Record<string, unknown> }
    | undefined;
  assert.equal(product?.specs.hasNfc, true, "NFC tidak terhapus oleh sel kosong");
  assert.equal(product?.specs.chipset, null, "chipset dikosongkan oleh tanda -");
  assert.equal(product?.specs.ipRating, "IP69");

  // Penawaran: badge terverifikasi dan garansi tidak dicabut sel kosong.
  const offerRow = (warranty: string, verified: string, price: string) => ({
    slug: "qauji-patch-1", ram_gb: "8", storage_gb: "128", marketplace: "Blibli", seller_name: "Toko QA",
    url: "https://www.blibli.com/p/qauji-patch-1", warranty, listing_status: "", seller_verified: verified,
    price_idr: price, observed_at: new Date(Date.now() - 3_600_000).toISOString(),
  });
  for (const [label, row] of [
    ["QA-UJI patch harga 1", offerRow("Resmi 1 tahun", "ya", "3000000")],
    ["QA-UJI patch harga 2", offerRow("", "", "")],
  ] as const) {
    const batch = await createBatch({ kind: "offers", origin: "csv", sourceLabel: label, options: {}, rows: [row], malformedLines: [], admin: actor });
    assert.ok(batch.ok, JSON.stringify(batch));
    batches.push(batch.id);
    await applyAll(batch.id);
  }
  const offer = ((await db.from("offers").select("warranty, seller_verified, listing_status").eq("url", "https://www.blibli.com/p/qauji-patch-1")).data ?? [])[0];
  // Teks garansi dibakukan saat impor (PB-27).
  assert.deepEqual(offer, { warranty: "Garansi resmi Indonesia, 1 tahun", seller_verified: true, listing_status: "active" });
});

test("INT-06 templat terpadu: produk baru + harga dalam satu berkas, harga lanjutan ditinjau dulu", async () => {
  const { convertUnifiedRows } = await import("@/lib/import/unified");
  const converted = convertUnifiedRows([
    { merek: "QAUji", model: "Terpadu 1", ram: "8", storage: "128", chipset: "Chip QA", marketplace: "Blibli", toko: "Toko QA",
      link: "https://www.blibli.com/p/qauji-terpadu-1", harga: "Rp 3.499.000", diperiksa: "10/10/2026 09:00" },
    { merek: "QAUji", model: "Terpadu 1", ram: "8", storage: "256", marketplace: "Blibli", toko: "Toko QA",
      link: "https://www.blibli.com/p/qauji-terpadu-1", harga: "", diperiksa: "10/10/2026 09:00" },
  ]);
  assert.equal(converted.specRows.length, 1);
  const created = await createBatch({
    kind: "specs", origin: "csv", sourceLabel: "QA-UJI terpadu", rows: converted.specRows, malformedLines: [], admin: actor,
    options: { sourceFormat: "unified", imageRights: null,
      followUpOffers: { sourceLabel: "QA-UJI terpadu (harga)", defaultObservedAt: new Date().toISOString(), rows: converted.followUpOfferRows } },
  });
  assert.ok(created.ok, JSON.stringify(created));
  batches.push(created.id);
  await applyAll(created.id);

  const childId = (await getFollowUpBatchId(created.id))!;
  assert.ok(childId, "batch harga lanjutan dibuat setelah produk tersimpan");
  batches.push(childId);
  const child = (await getBatch(childId))!;
  assert.equal(child.status, "draft", "harga dari CSV ditinjau dulu, tidak langsung diterapkan");
  assert.equal(child.origin, "csv");
  assert.deepEqual(child.items.map((i) => i.action).sort(), ["create", "create"]);

  await applyAll(childId);
  const offers = ((await db.from("offers").select("id").eq("url", "https://www.blibli.com/p/qauji-terpadu-1")).data ?? []) as { id: string }[];
  assert.equal(offers.length, 2, "satu penawaran per varian");
  const prices = ((await db.from("price_observations").select("price_idr, observed_at").in("offer_id", offers.map((o) => o.id))).data ?? []) as
    { price_idr: number; observed_at: string }[];
  assert.equal(prices.length, 1, "harga kosong tidak dicatat sebagai nol");
  assert.equal(Number(prices[0]!.price_idr), 3499000);
  assert.equal(new Date(prices[0]!.observed_at).toISOString(), "2026-10-10T02:00:00.000Z", "09.00 WIB");
});

test("INT-07 unggahan dianalisis di worker: baris di raw_listings, status analyzing -> draft", async () => {
  const { stageUpload } = await import("@/lib/import/batches");
  const { listWorkableBatches } = await import("@/lib/import/jobs");
  const rowsOf = async (batchId: string, role: string) =>
    ((await db.from("raw_listings").select("position").eq("batch_id", batchId).eq("role", role)).data ?? []).length;

  // Format spesifikasi lama: disimpan sebagai baris kerja, belum ada item.
  const legacy = await stageUpload({
    kind: "specs", origin: "csv", sourceLabel: "QA-UJI analisis lama", role: "row",
    rows: [spec("Analisis", 1), spec("Analisis", 2)], malformedLines: [], admin: actor, options: { sourceFormat: "gsmarena-spec", imageRights: null },
  });
  assert.ok(legacy.ok);
  batches.push(legacy.id);
  assert.equal((await getBatch(legacy.id))!.status, "analyzing");
  assert.equal((await getBatch(legacy.id))!.items.length, 0, "unggah tidak menghitung pratinjau");
  assert.ok((await listWorkableBatches(50)).includes(legacy.id), "worker terjadwal ikut mengambil batch yang menunggu analisis");
  const step = await processBatchStep(legacy.id);
  assert.equal(step.status, "draft");
  const analysed = (await getBatch(legacy.id))!;
  assert.equal(analysed.status, "draft");
  assert.deepEqual(analysed.items.map((i) => i.action), ["create", "create"]);
  assert.equal((await processBatchStep(legacy.id)).claimed, false, "draft tidak dianalisis ulang");

  // Templat terpadu: baris unggahan dikoreksi di worker, penawaran jadi lanjutan.
  const unified = await stageUpload({
    kind: "specs", origin: "csv", sourceLabel: "QA-UJI analisis terpadu", role: "upload", malformedLines: [], admin: actor,
    options: { sourceFormat: "unified", imageRights: null, defaultObservedAt: new Date().toISOString() },
    rows: [
      { merek: "QAUji", model: "Analisis 3", ram: "8", storage: "128", chipset: "Chip QA", link: "https://www.blibli.com/p/qa-a3", harga: "Rp 2.000.000" },
      { merek: "QAUji", model: "Analisis 3", ram: "8", storage: "256", link: "https://www.blibli.com/p/qa-a3", harga: "2,5 jt" },
    ],
  });
  assert.ok(unified.ok);
  batches.push(unified.id);
  await processBatchStep(unified.id);
  const detail = (await getBatch(unified.id))!;
  assert.equal(detail.status, "draft");
  assert.equal(detail.kind, "specs");
  assert.equal(detail.options.followUpOffers?.staged, true);
  assert.equal(detail.options.followUpOffers?.count, 2);
  assert.ok((detail.options.corrections?.summary.info ?? 0) >= 2, "koreksi harga tercatat");
  assert.equal(await rowsOf(unified.id, "upload"), 2);
  assert.equal(await rowsOf(unified.id, "row"), 1, "dua baris jadi satu produk");
  assert.equal(await rowsOf(unified.id, "follow_up"), 2);

  // Berkas tanpa baris yang bisa dipakai: gagal dengan alasan, tidak menggantung.
  const empty = await stageUpload({
    kind: "specs", origin: "csv", sourceLabel: "QA-UJI analisis kosong", role: "upload", malformedLines: [], admin: actor,
    options: { sourceFormat: "unified", imageRights: null }, rows: [{ merek: "", model: "", ram: "8" }],
  });
  assert.ok(empty.ok);
  batches.push(empty.id);
  await processBatchStep(empty.id);
  const failed = (await getBatch(empty.id))!;
  assert.equal(failed.status, "failed");
  assert.match(String((failed.report as { error?: string } | null)?.error ?? ""), /Tidak ada baris/);

  // Retensi 30 hari tidak menyentuh batch yang baru dibuat.
  const purged = await db.rpc("import_purge_raw_listings", { p_keep_days: 30 });
  assert.ok(!purged.error);
  assert.equal(await rowsOf(unified.id, "upload"), 2);
});

test("INT-08 tarik otomatis sebagai job: klaim satu per jenis, antre ulang idempoten, berhenti, sesi baru dari worker", async () => {
  const jobs = await import("@/lib/scrape/jobs");
  const { createSession } = await import("@/lib/scrape/sessions");
  const lineupItem = (id: string) => ({
    officialId: id, brand: "infinix" as const, officialName: `QA ${id}`, officialUrl: null, prices: [], storageOnlyPrices: [],
    unassignedPrices: [], priceIssues: [], siblingHas5g: false, gsmarenaPath: null,
  });
  const sessionId = (await createSession("infinix", [lineupItem("qa-1"), lineupItem("qa-2"), lineupItem("qa-3")], new Date().toISOString(), actor))!;
  assert.ok(sessionId);
  const statusOf = async () =>
    Object.fromEntries((await jobs.sessionJobs(sessionId)).map((job) => [job.official_id, job.status]));
  try {
    assert.ok(await jobs.enqueueResolve(sessionId, "infinix", ["qa-1", "qa-2", "qa-3"], actor));
    assert.ok(await jobs.enqueueResolve(sessionId, "infinix", ["qa-1"], actor), "antre ulang tidak membuat job ganda");
    assert.equal((await jobs.sessionJobs(sessionId)).length, 3);

    // Hanya satu job spesifikasi boleh berjalan pada satu waktu (sopan ke GSMArena).
    const first = await db.rpc("scrape_claim_job", { p_lease_seconds: 60 });
    assert.equal((first.data ?? []).length, 1);
    const second = await db.rpc("scrape_claim_job", { p_lease_seconds: 60 });
    assert.equal((second.data ?? []).length, 0, "job sejenis kedua tidak diklaim selama yang pertama berjalan");

    // Tombol Hentikan: job yang belum berjalan dibatalkan, yang berjalan dibiarkan selesai.
    assert.equal(await jobs.cancelQueuedJobs(sessionId, "Dihentikan admin."), 2);
    const statuses = await statusOf();
    assert.equal(Object.values(statuses).filter((s) => s === "cancelled").length, 2);
    assert.equal(Object.values(statuses).filter((s) => s === "running").length, 1);

    // Sesi yang sudah dikirim: job yang diklaim worker dibatalkan tanpa menghubungi situs mana pun.
    // Lease dibuat jelas kedaluwarsa: jam lokal bisa beberapa detik lebih cepat dari
    // jam database, sedangkan worker membandingkannya dengan now() database.
    await db.from("scrape_jobs").update({ lease_until: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("session_id", sessionId).eq("status", "running");
    await db.from("scrape_sessions").update({ status: "committed" }).eq("id", sessionId);
    await jobs.processScrapeStep(10_000);
    assert.equal(Object.values(await statusOf()).filter((s) => s === "running").length, 0);
    assert.ok(Object.values(await statusOf()).every((s) => s === "cancelled"));

    // Job daftar model sungguhan (Infinix, satu halaman toko resmi): worker membuat sesi.
    const lineupJob = (await jobs.enqueueLineup("infinix", actor))!;
    await jobs.processScrapeStep(40_000);
    const done = (await jobs.getScrapeJob(lineupJob))!;
    assert.equal(done.status, "done", done.error ?? "");
    assert.ok(done.session_id, "sesi dibuat oleh worker, bukan oleh request");
    await db.from("scrape_sessions").delete().eq("id", done.session_id!);
  } finally {
    await db.from("scrape_sessions").delete().eq("id", sessionId);
    await db.from("scrape_jobs").delete().eq("created_by_email", actor.email);
  }
});

test("INT-09 pratinjau langkah 5: harga lama ditandai, spesifikasi saja, harga saja untuk produk yang ada", async () => {
  const { resolveRowsForExistingProducts } = await import("@/lib/import/batches");
  // Produk QAUji yang sudah ada + satu harga terkini.
  const base = await createBatch({ kind: "specs", origin: "csv", sourceLabel: "QA-UJI langkah5 produk", options: {}, rows: [spec("Langkah", 1)], malformedLines: [], admin: actor });
  assert.ok(base.ok);
  batches.push(base.id);
  await applyAll(base.id);
  const offer = (price: string, observedAt: string) => ({
    slug: "qauji-langkah-1", ram_gb: "8", storage_gb: "128", marketplace: "Blibli", seller_name: "Toko QA",
    url: "https://www.blibli.com/p/qauji-langkah-1", warranty: "", listing_status: "", seller_verified: "", price_idr: price, observed_at: observedAt,
  });
  const now = await createBatch({ kind: "offers", origin: "csv", sourceLabel: "QA-UJI langkah5 harga kini", options: {}, rows: [offer("3000000", new Date(Date.now() - 3_600_000).toISOString())], malformedLines: [], admin: actor });
  assert.ok(now.ok);
  batches.push(now.id);
  await applyAll(now.id);

  // Harga yang lebih tua dari harga terakhir: masuk riwayat, ditandai.
  const old = await createBatch({ kind: "offers", origin: "csv", sourceLabel: "QA-UJI langkah5 harga lama", options: {}, rows: [offer("2500000", new Date(Date.now() - 5 * 86_400_000).toISOString())], malformedLines: [], admin: actor });
  assert.ok(old.ok);
  batches.push(old.id);
  const oldItem = (await getBatch(old.id))!.items[0]!;
  assert.equal(oldItem.view.priceStale, true);
  assert.match(oldItem.reason ?? "", /lebih lama dari harga terakhir/);
  assert.deepEqual(oldItem.changes.map((c) => c.field), ["Riwayat harga"]);

  // Spesifikasi saja: batch harga lanjutan tidak dibuat.
  const withPrices = await createBatch({
    kind: "specs", origin: "csv", sourceLabel: "QA-UJI langkah5 spesifikasi saja", rows: [spec("Langkah", 2)], malformedLines: [], admin: actor,
    options: { followUpOffers: { sourceLabel: "QA-UJI langkah5 (harga)", defaultObservedAt: new Date().toISOString(),
      rows: [{ ...offer("4000000", new Date().toISOString()), slug: "", source_key: "gsmarena:qauji_langkah_2-92" }] } },
  });
  assert.ok(withPrices.ok);
  batches.push(withPrices.id);
  const detail = (await getBatch(withPrices.id))!;
  const queued = await queueBatch(withPrices.id, detail.items.map((i) => i.id), actor, { skipFollowUp: true });
  assert.ok(queued.ok);
  let step = await processBatchStep(withPrices.id);
  while (step.claimed && step.status === "applying") step = await processBatchStep(withPrices.id);
  assert.equal(await getFollowUpBatchId(withPrices.id), null, "spesifikasi saja: tidak ada batch harga");

  // Harga saja: hanya penawaran produk yang sudah ada; produk baru dihitung, tidak dibuang diam-diam.
  const resolved = await resolveRowsForExistingProducts([
    { ...offer("1", ""), slug: "", source_key: "gsmarena:qauji_langkah_1-91" },
    { ...offer("1", ""), slug: "", source_key: "gsmarena:qauji_belum_ada-99" },
    offer("1", ""),
  ]);
  assert.equal(resolved.rows.length, 2);
  assert.equal(resolved.dropped, 1);
  assert.ok(resolved.rows.every((row) => row.slug === "qauji-langkah-1" && !row.source_key));
});

test("INT-10 foto di templat terpadu: produk lama mendapat foto galeri tiap warna, harga dari baris terakhir", async () => {
  const { convertUnifiedRows } = await import("@/lib/import/unified");
  const base = await createBatch({ kind: "specs", origin: "csv", sourceLabel: "QA-UJI foto produk", options: {}, rows: [spec("Foto", 1)], malformedLines: [], admin: actor });
  assert.ok(base.ok);
  batches.push(base.id);
  await applyAll(base.id);

  const row = (price: string, color: string) => ({
    merek: "QAUji", model: "Foto 1", ram: "8", storage: "128", marketplace: "Blibli", toko: "Toko QA",
    link: "https://www.blibli.com/p/qauji-foto-1", harga: price, diperiksa: "10/10/2026 09:00",
    url_image: `https://down-id.img.susercontent.com/file/qa-uji-${color}`, color,
  });
  const converted = convertUnifiedRows([row("Rp 2.000.000", "biru"), row("Rp 2.100.000", "hijau")]);
  assert.equal(converted.specRows.length, 0, "foto tidak membuat baris produk untuk produk lama");
  assert.equal(converted.offerRows.length, 2);

  const created = await createBatch({
    kind: "offers", origin: "csv", sourceLabel: "QA-UJI foto harga", rows: converted.offerRows, malformedLines: [], admin: actor,
    options: { sourceFormat: "unified", imageRights: { basis: "own-work", text: "Aset uji QA" }, defaultObservedAt: new Date().toISOString() },
  });
  assert.ok(created.ok, JSON.stringify(created));
  batches.push(created.id);
  const detail = (await getBatch(created.id))!;
  const winner = detail.items.find((i) => i.action === "create")!;
  assert.equal(winner.view.photos, "2 foto", "foto kedua warna dihitung di penawaran pemenang");
  assert.match(detail.items.find((i) => i.action === "skip")?.reason ?? "", /fotonya tetap ikut/);

  await applyAll(created.id);
  const offers = ((await db.from("offers").select("id").eq("url", "https://www.blibli.com/p/qauji-foto-1")).data ?? []) as { id: string }[];
  assert.equal(offers.length, 1);
  const prices = ((await db.from("price_observations").select("price_idr").eq("offer_id", offers[0]!.id)).data ?? []) as { price_idr: number }[];
  assert.deepEqual(prices.map((p) => Number(p.price_idr)), [2100000], "data baris terakhir yang dipakai");
  const jobs = ((await db.from("photo_jobs").select("kind, image_url, batch_id").like("image_url", "https://down-id.img.susercontent.com/file/qa-uji-%")).data ?? []) as
    { kind: string; image_url: string; batch_id: string }[];
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.kind === "gallery" && j.batch_id === created.id));
});

test("INT-11 warna penawaran: gabungan baris per warna, diganti saat impor ulang, sel kosong tidak menghapus", async () => {
  const { convertUnifiedRows } = await import("@/lib/import/unified");
  const base = await createBatch({ kind: "specs", origin: "csv", sourceLabel: "QA-UJI warna produk", options: {}, rows: [spec("Warna", 1)], malformedLines: [], admin: actor });
  assert.ok(base.ok);
  batches.push(base.id);
  await applyAll(base.id);

  const url = "https://shopee.co.id/qauji-warna-1-i.9.9";
  const row = (color: string, price = "Rp 2.000.000") => ({
    merek: "QAUji", model: "Warna 1", ram: "8", storage: "128", marketplace: "Shopee", toko: "Toko QA",
    url: `${url}?extraParams=qa`, harga: price, diperiksa: "10/10/2026 09:00", warna: color,
    url_image: color ? `https://down-id.img.susercontent.com/file/qa-uji-warna-${color.toLowerCase()}` : "",
  });
  const importRows = async (label: string, rows: ReturnType<typeof row>[]) => {
    const created = await createBatch({
      kind: "offers", origin: "csv", sourceLabel: label, rows: convertUnifiedRows(rows).offerRows, malformedLines: [], admin: actor,
      options: { sourceFormat: "unified", imageRights: { basis: "own-work", text: "Aset uji QA" }, defaultObservedAt: new Date().toISOString() },
    });
    assert.ok(created.ok, JSON.stringify(created));
    batches.push(created.id);
    await applyAll(created.id);
    return created.id;
  };
  const colorsOf = async () =>
    (((await db.from("offers").select("colors").eq("url", url)).data ?? []) as { colors: string[] }[]).map((o) => o.colors);

  const first = await importRows("QA-UJI warna 1", [row("Hitam"), row("Hijau")]);
  assert.deepEqual(await colorsOf(), [["Hitam", "Hijau"]], "satu penawaran, URL Shopee dirapikan, warna digabung");
  const jobs = ((await db.from("photo_jobs").select("color").eq("batch_id", first)).data ?? []) as { color: string }[];
  assert.deepEqual(jobs.map((j) => j.color).sort(), ["Hijau", "Hitam"], "warna ikut antrean foto");

  await importRows("QA-UJI warna 2", [row("Biru", "Rp 2.100.000")]);
  assert.deepEqual(await colorsOf(), [["Biru"]], "warna terisi menggantikan daftar lama");
  await importRows("QA-UJI warna 3", [row("", "Rp 2.200.000")]);
  assert.deepEqual(await colorsOf(), [["Biru"]], "sel warna kosong tidak menghapus");
});

test("INT-12 galeri foto: batas per warna, sampul dan urutan ke antrean, undo menghapus foto di produk terbit", async () => {
  const base = await createBatch({ kind: "specs", origin: "csv", sourceLabel: "QA-UJI galeri produk", options: {}, rows: [spec("Galeri", 1)], malformedLines: [], admin: actor });
  assert.ok(base.ok);
  batches.push(base.id);
  await applyAll(base.id);
  const product = (await productsByModel())["Galeri 1"]!;
  await db.from("products").update({ status: "published" }).eq("id", product.id);

  const url = (name: string) => `https://down-id.img.susercontent.com/file/qa-uji-galeri-${name}`;
  const rows = [
    ...Array.from({ length: 7 }, (_, i) => ({ brand: "QAUji", model_name: "Galeri 1", color: "Hitam", urutan: String(i + 1), is_cover: i === 3 ? "ya" : "tidak", image_url: url(`hitam-${i + 1}`) })),
    { brand: "QAUji", model_name: "Galeri 1", color: "Hijau", urutan: "1", is_cover: "ya", image_url: url("hijau-1") },
  ];
  const created = await createBatch({
    kind: "photos", origin: "csv", sourceLabel: "QA-UJI galeri", rows, malformedLines: [], admin: actor,
    options: { sourceFormat: "photo-gallery", imageRights: { basis: "own-work", text: "Aset uji QA" } },
  });
  assert.ok(created.ok, JSON.stringify(created));
  batches.push(created.id);
  const detail = (await getBatch(created.id))!;
  assert.deepEqual(detail.counts, { create: 7, update: 0, unchanged: 0, skip: 1 });
  assert.match(detail.items.find((i) => i.action === "skip")?.reason ?? "", /Warna "Hitam" sudah berisi 6 foto; foto ke-7/);

  await applyAll(created.id);
  const jobs = ((await db.from("photo_jobs").select("image_url, color, sort_order, is_cover, kind, batch_id").eq("batch_id", created.id)).data ?? []) as
    { image_url: string; color: string; sort_order: number; is_cover: boolean; kind: string }[];
  assert.equal(jobs.length, 7);
  assert.ok(jobs.every((j) => j.kind === "gallery"));
  assert.deepEqual(jobs.filter((j) => j.is_cover).map((j) => j.image_url).sort(), [url("hijau-1"), url("hitam-4")]);
  assert.ok(!jobs.some((j) => j.image_url === url("hitam-7")), "urutan terbesar yang terlewat");

  // Unggahan kedua berkas yang sama: foto yang masih antre dihitung, tidak ada antrean ganda.
  const again = await createBatch({
    kind: "photos", origin: "csv", sourceLabel: "QA-UJI galeri ulang", rows, malformedLines: [], admin: actor,
    options: { sourceFormat: "photo-gallery", imageRights: { basis: "own-work", text: "Aset uji QA" } },
  });
  assert.ok(again.ok);
  batches.push(again.id);
  assert.deepEqual((await getBatch(again.id))!.counts, { create: 0, update: 0, unchanged: 7, skip: 1 });

  // Satu foto sudah tersimpan oleh worker; undo batch galeri menghapusnya walau produknya terbit.
  const key = `qa-uji/${product.id}/galeri.txt`;
  assert.ok(!(await bucket.upload(key, new Blob(["galeri"], { type: "text/plain" }))).error);
  storageKeys.push(key);
  assert.ok(!(await db.from("product_assets").insert([{
    product_id: product.id, kind: "photo", src: url("hijau-1"), alt: "galeri", source: "QA", retrieved_at: new Date().toISOString(),
    usage_rights: "QA", usage_basis: "own-work", storage_key: key, original_url: url("hijau-1"), color: "Hijau", is_cover: true,
    created_by_batch_id: created.id,
  }])).error);
  assert.deepEqual((await planUndo(created.id))!.photos, { remove: 1, protected: 0 });
  const undone = await executeUndo(created.id, actor);
  assert.ok(undone.ok && undone.result.photos === 1, JSON.stringify(undone));
  const left = ((await db.from("photo_jobs").select("status").eq("batch_id", created.id)).data ?? []) as { status: string }[];
  assert.ok(left.every((j) => j.status === "skipped"), "antrean foto batch dibatalkan");
  assert.ok((await bucket.download(key)).error, "objek foto ikut terhapus");
});

test("INT-13 panel foto: satu sampul per warna lewat RPC, urutan atomik", async () => {
  const base = await createBatch({ kind: "specs", origin: "csv", sourceLabel: "QA-UJI panel foto", options: {}, rows: [spec("Panel", 1)], malformedLines: [], admin: actor });
  assert.ok(base.ok);
  batches.push(base.id);
  await applyAll(base.id);
  const product = (await productsByModel())["Panel 1"]!;
  const asset = (name: string, cover: boolean) => ({
    product_id: product.id, kind: "photo", src: `https://qa-uji.invalid/${name}.jpg`, alt: name, source: "QA",
    retrieved_at: new Date().toISOString(), usage_rights: "QA", usage_basis: "own-work", original_url: `https://qa-uji.invalid/${name}.jpg`,
    color: "Hitam", is_cover: cover,
  });
  const inserted = await db.from("product_assets").insert([asset("a", true), asset("b", false), asset("c", false)]).select("id, alt");
  assert.ok(!inserted.error, JSON.stringify(inserted.error));
  const id = Object.fromEntries(((inserted.data ?? []) as { id: string; alt: string }[]).map((r) => [r.alt, r.id]));
  // Indeks unik menolak sampul kedua untuk warna yang sama.
  assert.ok((await db.from("product_assets").update({ is_cover: true }).eq("id", id.b!)).error, "dua sampul untuk satu warna ditolak");
  assert.equal((await db.rpc("admin_set_photo_cover", { p_id: id.c })).data, true);
  const covers = ((await db.from("product_assets").select("alt").eq("product_id", product.id).eq("is_cover", true)).data ?? []) as { alt: string }[];
  assert.deepEqual(covers.map((r) => r.alt), ["c"]);
  assert.equal((await db.rpc("admin_set_photo_order", { p_product: product.id, p_ids: [id.b, id.a] })).data, 2);
  const order = ((await db.from("product_assets").select("alt, sort_order").eq("product_id", product.id).order("sort_order")).data ?? []) as { alt: string; sort_order: number }[];
  assert.deepEqual(order.filter((r) => r.alt !== "c").map((r) => [r.alt, r.sort_order]), [["b", 0], ["a", 1]]);
});
