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
  assert.deepEqual(offer, { warranty: "Resmi 1 tahun", seller_verified: true, listing_status: "active" });
});
