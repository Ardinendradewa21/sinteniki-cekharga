"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/admin/audit";
import {
  advertiserFromForm,
  adsTxtInput,
  canTransitionIo,
  checklistComplete,
  checklistFromForm,
  computePpn,
  CONTRACT_STATUS,
  contractInput,
  creativeInput,
  IO_LABEL,
  IO_STATUS,
  invoiceInput,
  ioInput,
  LINE_ITEM_STATUS,
  lineItemFromForm,
  needsEscalation,
  parseRupiah,
  text,
  type AdActionState,
  type IoStatus,
} from "@/lib/ads/admin-schema";
import {
  advertiserHasApprovedCreative,
  getContract,
  getCreative,
  getIo,
  lineItemContext,
  listSettings,
  listSlots,
} from "@/lib/ads/admin-queries";
import {
  CONTRACT_BUCKET,
  CREATIVE_BUCKET,
  creativeKeyFromUrl,
  fileFrom,
  removeObjects,
  uploadContractPdf,
  uploadCreativeImage,
} from "@/lib/ads/admin-storage";
import { ADS_CACHE_TAG } from "@/lib/ads/decision";
import { requireStaff } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";

/**
 * Aksi tulis modul iklan. Urutannya sama dengan aksi admin lain
 * (src/lib/admin/actions.ts): gerbang peran → validasi → tulis → audit →
 * revalidasi. Gerbang memakai requireStaff() dengan peran sesuai
 * docs/ads/ADS-CONTEXT.md §7; `admin` selalu lolos.
 */

const BASE = "/admin/iklan";

function db() {
  return getInsforgeAdminClient().database;
}

function fail(error: string): AdActionState {
  return { error };
}

function ok(message: string): AdActionState {
  return { error: null, message };
}

function firstIssue(result: { error?: { issues: { message: string }[] } }): string {
  return result.error?.issues[0]?.message ?? "Data tidak valid.";
}

/** Pesan galat database yang aman ditampilkan (pelanggaran unik → bahasa manusia). */
function dbError(error: unknown, fallback: string): string {
  const record = (error ?? {}) as { code?: string; message?: string };
  if (record.code === "23505") return "Nomor itu sudah dipakai. Gunakan nomor lain.";
  if (record.code === "23503") return "Data masih dipakai oleh data lain sehingga tidak bisa diubah/dihapus.";
  console.error("[iklan-admin]", fallback, error);
  return fallback;
}

/** Perubahan yang memengaruhi iklan tayang: segarkan cache penyajian publik. */
function refreshServing() {
  revalidateTag(ADS_CACHE_TAG, { expire: 0 });
}

function refreshAdmin(...paths: string[]) {
  revalidatePath(BASE);
  for (const path of paths) revalidatePath(path);
}

/* ================================================================ advertiser */

export async function saveAdvertiserAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["sales"]);
  const parsed = advertiserFromForm(formData);
  if (!parsed.success) return fail(firstIssue(parsed));
  const id = text(formData, "id");

  if (id) {
    const { error } = await db().from("advertisers").update(parsed.data).eq("id", id);
    if (error) return fail(dbError(error, "Advertiser gagal disimpan."));
    await recordAudit(staff, "update", "advertiser", id, { company: parsed.data.company_name });
    refreshAdmin(`${BASE}/advertiser`, `${BASE}/advertiser/${id}`);
    refreshServing();
    return ok("Advertiser disimpan.");
  }

  const { data, error } = await db()
    .from("advertisers")
    .insert([{ ...parsed.data, source: "manual" }])
    .select("id");
  const newId = (data as { id: string }[] | null)?.[0]?.id;
  if (error || !newId) return fail(dbError(error, "Advertiser gagal dibuat."));
  await recordAudit(staff, "create", "advertiser", newId, { company: parsed.data.company_name });
  refreshAdmin(`${BASE}/advertiser`);
  redirect(`${BASE}/advertiser/${newId}`);
}

/* ================================================================ PKS */

export async function createContractAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["sales", "legal"]);
  const advertiserId = text(formData, "advertiser_id");
  if (!advertiserId) return fail("Advertiser tidak ditemukan.");
  const parsed = contractInput.safeParse({
    contract_number: text(formData, "contract_number") ?? "",
    start_date: text(formData, "start_date") ?? "",
    end_date: text(formData, "end_date") ?? "",
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return fail(firstIssue(parsed));

  let signedFileKey: string | null = null;
  const file = fileFrom(formData, "signed_file");
  if (file) {
    const uploaded = await uploadContractPdf(file, parsed.data.contract_number);
    if (!uploaded.ok) return fail(uploaded.reason);
    signedFileKey = uploaded.key;
  }

  const { data, error } = await db()
    .from("contracts")
    .insert([
      {
        ...parsed.data,
        advertiser_id: advertiserId,
        signed_file_key: signedFileKey,
        status: signedFileKey ? "signed" : "draft",
      },
    ])
    .select("id");
  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (error || !id) {
    await removeObjects(CONTRACT_BUCKET, [signedFileKey]);
    return fail(dbError(error, "PKS gagal disimpan."));
  }
  await recordAudit(staff, "create", "contract", id, { number: parsed.data.contract_number, file: Boolean(signedFileKey) });
  refreshAdmin(`${BASE}/advertiser/${advertiserId}`);
  return ok("PKS disimpan.");
}

export async function updateContractAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["legal"]);
  const id = text(formData, "id");
  const contract = id ? await getContract(id) : null;
  if (!contract) return fail("PKS tidak ditemukan.");

  const status = text(formData, "status") ?? contract.status;
  if (!(CONTRACT_STATUS as readonly string[]).includes(status)) return fail("Status PKS tidak valid.");

  let signedFileKey = contract.signed_file_key;
  const file = fileFrom(formData, "signed_file");
  if (file) {
    const uploaded = await uploadContractPdf(file, contract.contract_number);
    if (!uploaded.ok) return fail(uploaded.reason);
    signedFileKey = uploaded.key;
  }
  if (status === "signed" && !signedFileKey) return fail("Unggah PKS bertanda tangan sebelum menandai ditandatangani.");

  const { error } = await db().from("contracts").update({ status, signed_file_key: signedFileKey }).eq("id", contract.id);
  if (error) {
    if (signedFileKey !== contract.signed_file_key) await removeObjects(CONTRACT_BUCKET, [signedFileKey]);
    return fail(dbError(error, "PKS gagal diperbarui."));
  }
  if (signedFileKey !== contract.signed_file_key) await removeObjects(CONTRACT_BUCKET, [contract.signed_file_key]);
  await recordAudit(staff, "update", "contract", contract.id, { status, newFile: signedFileKey !== contract.signed_file_key });
  refreshAdmin(`${BASE}/advertiser/${contract.advertiser_id}`);
  refreshServing();
  return ok("PKS diperbarui.");
}

/* ================================================================ IO */

export async function createIoAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["sales"]);
  const contractId = text(formData, "contract_id");
  const contract = contractId ? await getContract(contractId) : null;
  if (!contract) return fail("PKS tidak ditemukan.");
  if (contract.status === "ended" || contract.status === "terminated") {
    return fail("PKS sudah berakhir/diputus. Buat PKS baru dulu.");
  }
  const parsed = ioInput.safeParse({
    io_number: text(formData, "io_number") ?? "",
    campaign_name: text(formData, "campaign_name") ?? "",
    total_amount: parseRupiah(text(formData, "total_amount")) ?? 0,
    tax_included: formData.get("tax_included") === "on",
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return fail(firstIssue(parsed));

  const { data, error } = await db()
    .from("insertion_orders")
    .insert([{ ...parsed.data, contract_id: contract.id }])
    .select("id");
  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (error || !id) return fail(dbError(error, "IO gagal dibuat."));
  await recordAudit(staff, "create", "insertion_order", id, { number: parsed.data.io_number });
  refreshAdmin(`${BASE}/advertiser/${contract.advertiser_id}`);
  redirect(`${BASE}/io/${id}`);
}

export async function updateIoAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["sales"]);
  const io = await getIo(text(formData, "id") ?? "");
  if (!io) return fail("IO tidak ditemukan.");
  if (io.status === "completed" || io.status === "cancelled") return fail("IO yang sudah selesai/dibatalkan tidak bisa diubah.");
  const parsed = ioInput.safeParse({
    io_number: io.io_number,
    campaign_name: text(formData, "campaign_name") ?? "",
    total_amount: parseRupiah(text(formData, "total_amount")) ?? 0,
    tax_included: formData.get("tax_included") === "on",
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return fail(firstIssue(parsed));
  const { campaign_name, total_amount, tax_included, notes } = parsed.data;
  const changes = { campaign_name, total_amount, tax_included, notes };
  const { error } = await db().from("insertion_orders").update(changes).eq("id", io.id);
  if (error) return fail(dbError(error, "IO gagal disimpan."));
  await recordAudit(staff, "update", "insertion_order", io.id, changes);
  refreshAdmin(`${BASE}/io/${io.id}`);
  return ok("IO disimpan.");
}

export async function transitionIoAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["sales", "legal", "finance", "adops"]);
  const io = await getIo(text(formData, "id") ?? "");
  if (!io) return fail("IO tidak ditemukan.");
  const to = text(formData, "to") as IoStatus | null;
  if (!to || !(IO_STATUS as readonly string[]).includes(to)) return fail("Status tujuan tidak valid.");
  if (!canTransitionIo(staff.role, io.status, to)) {
    return fail(`Peran ${staff.role} tidak bisa mengubah IO dari "${IO_LABEL[io.status]}" ke "${IO_LABEL[to]}".`);
  }

  // Prasyarat bisnis (ADS-CONTEXT §5): IO disetujui hanya bila PKS sudah ditandatangani.
  if (to === "approved") {
    const contract = await getContract(io.contract_id);
    if (contract?.status !== "signed") return fail("PKS belum berstatus ditandatangani.");
  }

  // Kunci optimistis: gagal bila status sudah diubah orang lain sejak halaman dibuka.
  const { data: changed, error } = await db()
    .from("insertion_orders")
    .update({ status: to })
    .eq("id", io.id)
    .eq("status", io.status)
    .select("id");
  if (error) return fail(dbError(error, "Status IO gagal diubah."));
  if (!(changed as unknown[] | null)?.length) return fail("Status IO sudah diubah orang lain. Muat ulang halaman.");
  // IO berhenti tayang: line item aktif ikut diakhiri supaya tidak tersaji lagi.
  if (to === "completed" || to === "cancelled") {
    await db().from("line_items").update({ status: "ended" }).eq("io_id", io.id).in("status", ["pending", "active", "paused"]);
  }
  await recordAudit(staff, "transition", "insertion_order", io.id, { from: io.status, to });
  refreshAdmin(`${BASE}/io/${io.id}`);
  refreshServing();
  return ok(`Status IO menjadi "${IO_LABEL[to]}".`);
}

/* ================================================================ line item */

export async function saveLineItemAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["adops"]);
  const ioId = text(formData, "io_id");
  const io = ioId ? await getIo(ioId) : null;
  if (!io) return fail("IO tidak ditemukan.");
  if (io.status === "completed" || io.status === "cancelled") return fail("IO sudah selesai/dibatalkan.");
  const parsed = lineItemFromForm(formData);
  if (!parsed.success) return fail(firstIssue(parsed));
  const slot = (await listSlots()).find((row) => row.id === parsed.data.slot_id);
  if (!slot || slot.kind !== "banner") return fail("Slot tidak ditemukan atau belum didukung.");

  const id = text(formData, "id");
  if (id) {
    const { error } = await db().from("line_items").update(parsed.data).eq("id", id).eq("io_id", io.id);
    if (error) return fail(dbError(error, "Line item gagal disimpan."));
    await recordAudit(staff, "update", "line_item", id, { slot: slot.code });
  } else {
    const { data, error } = await db()
      .from("line_items")
      .insert([{ ...parsed.data, io_id: io.id, status: "pending" }])
      .select("id");
    const newId = (data as { id: string }[] | null)?.[0]?.id;
    if (error || !newId) return fail(dbError(error, "Line item gagal dibuat."));
    await recordAudit(staff, "create", "line_item", newId, { slot: slot.code });
  }
  refreshAdmin(`${BASE}/io/${io.id}`);
  refreshServing();
  return ok("Line item disimpan.");
}

export async function setLineItemStatusAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["adops"]);
  const context = await lineItemContext(text(formData, "id") ?? "");
  if (!context?.io) return fail("Line item tidak ditemukan.");
  const status = text(formData, "status");
  if (!status || !(LINE_ITEM_STATUS as readonly string[]).includes(status)) return fail("Status tidak valid.");
  if (status === "active" && !["ready", "live"].includes(context.io.status)) {
    return fail("Line item hanya bisa diaktifkan setelah IO berstatus Siap tayang atau Tayang.");
  }
  const { error } = await db().from("line_items").update({ status }).eq("id", context.item.id);
  if (error) return fail(dbError(error, "Status line item gagal diubah."));
  await recordAudit(staff, "status", "line_item", context.item.id, { status });
  refreshAdmin(`${BASE}/io/${context.io.id}`);
  refreshServing();
  return ok("Status line item diperbarui.");
}

/* ================================================================ creative */

export async function createCreativeAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["adops"]);
  const context = await lineItemContext(text(formData, "line_item_id") ?? "");
  if (!context?.io || !context.slot) return fail("Line item tidak ditemukan.");
  const parsed = creativeInput.safeParse({
    format: text(formData, "format") ?? "display",
    alt_text: text(formData, "alt_text") ?? "",
    destination_url: text(formData, "destination_url") ?? "",
    headline: text(formData, "headline"),
    body: text(formData, "body"),
    cta_label: text(formData, "cta_label"),
  });
  if (!parsed.success) return fail(firstIssue(parsed));
  const input = parsed.data;
  if (input.format === "native" && !context.slot.allows_native) return fail("Slot ini tidak menerima format native.");

  const uploadedKeys: string[] = [];
  const cleanup = () => removeObjects(CREATIVE_BUCKET, uploadedKeys);
  const upload = async (name: string, label: string, slotSize: string | null, checkRatio: boolean) => {
    const file = fileFrom(formData, name);
    if (!file) return { ok: true as const, url: null };
    const result = await uploadCreativeImage(file, { lineItemId: context.item.id, slotSize, label, checkRatio });
    if (result.ok) uploadedKeys.push(result.key);
    return result.ok ? { ok: true as const, url: result.url, key: result.key } : result;
  };

  const isNative = input.format === "native";
  const main = await upload("image", "Gambar utama", context.slot.desktop_size, !isNative);
  if (!main.ok) return fail(main.reason);
  if (!isNative && !main.url) return fail("Iklan display wajib punya gambar.");
  const mobile = isNative ? { ok: true as const, url: null } : await upload("image_mobile", "Gambar mobile", context.slot.mobile_size, true);
  if (!mobile.ok) {
    await cleanup();
    return fail(mobile.reason);
  }
  const logo = isNative ? await upload("logo", "Logo", null, false) : { ok: true as const, url: null };
  if (!logo.ok) {
    await cleanup();
    return fail(logo.reason);
  }

  const { data, error } = await db()
    .from("creatives")
    .insert([
      {
        ...input,
        line_item_id: context.item.id,
        image_url: main.url,
        image_key: "key" in main ? main.key : null,
        image_url_mobile: mobile.url,
        logo_url: logo.url,
        review_status: "pending",
      },
    ])
    .select("id");
  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (error || !id) {
    await cleanup();
    return fail(dbError(error, "Materi gagal disimpan."));
  }
  await recordAudit(staff, "create", "creative", id, { lineItem: context.item.id, format: input.format });
  refreshAdmin(`${BASE}/io/${context.io.id}`, `${BASE}/review`);
  return ok("Materi diunggah dan masuk antrean review.");
}

export async function reviewCreativeAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["adops"]);
  const creative = await getCreative(text(formData, "id") ?? "");
  if (!creative) return fail("Materi tidak ditemukan.");
  const context = await lineItemContext(creative.line_item_id);
  if (!context?.advertiser) return fail("Data advertiser materi ini tidak lengkap.");

  const decision = text(formData, "decision");
  const note = text(formData, "review_note");
  const checklist = checklistFromForm(formData);

  if (decision === "approve") {
    if (!checklistComplete(checklist)) return fail("Centang semua butir checklist sebelum menyetujui.");
    const isNew = !(await advertiserHasApprovedCreative(context.advertiser.id));
    if (needsEscalation(checklist, isNew) && staff.role !== "admin") {
      return fail(
        isNew
          ? "Advertiser baru: persetujuan pertama wajib oleh peran admin."
          : "Kategori sensitif: persetujuan wajib oleh peran admin."
      );
    }
  } else if (decision === "reject") {
    if (!note) return fail("Tulis alasan penolakan supaya advertiser bisa memperbaiki materi.");
  } else {
    return fail("Pilih setujui atau tolak.");
  }

  const { error } = await db()
    .from("creatives")
    .update({
      review_status: decision === "approve" ? "approved" : "rejected",
      review_note: note,
      review_checklist: checklist,
      reviewed_by: staff.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", creative.id);
  if (error) return fail(dbError(error, "Hasil review gagal disimpan."));
  await recordAudit(staff, decision, "creative", creative.id, { checklist, note });
  refreshAdmin(`${BASE}/review`, `${BASE}/io/${context.io?.id ?? ""}`);
  refreshServing();
  return ok(decision === "approve" ? "Materi disetujui." : "Materi ditolak.");
}

export async function deleteCreativeAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["adops"]);
  const creative = await getCreative(text(formData, "id") ?? "");
  if (!creative) return fail("Materi tidak ditemukan.");
  const context = await lineItemContext(creative.line_item_id);
  // Materi yang sudah punya event tidak dihapus (bukti tagihan); cukup ditolak/dijeda.
  const { count } = await db()
    .from("ad_daily_report")
    .select("creative_id", { count: "exact", head: true })
    .eq("creative_id", creative.id);
  if ((count ?? 0) > 0) return fail("Materi ini sudah punya data tayang dan menjadi bukti tagihan. Tolak atau jeda line item-nya.");

  const { error } = await db().from("creatives").delete().eq("id", creative.id);
  if (error) return fail(dbError(error, "Materi gagal dihapus."));
  await removeObjects(CREATIVE_BUCKET, [
    creative.image_key,
    creativeKeyFromUrl(creative.image_url_mobile),
    creativeKeyFromUrl(creative.logo_url),
  ]);
  await recordAudit(staff, "delete", "creative", creative.id);
  refreshAdmin(`${BASE}/io/${context?.io?.id ?? ""}`, `${BASE}/review`);
  refreshServing();
  return ok("Materi dihapus.");
}

/* ================================================================ invoice */

export async function createInvoiceAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["finance"]);
  const io = await getIo(text(formData, "io_id") ?? "");
  if (!io) return fail("IO tidak ditemukan.");
  const amount = parseRupiah(text(formData, "amount")) ?? -1;
  const settings = await listSettings();
  const rate = Number(settings.ppn_rate_percent);
  const parsed = invoiceInput.safeParse({
    invoice_number: text(formData, "invoice_number") ?? "",
    kind: text(formData, "kind") ?? "",
    amount,
    ppn_amount: computePpn(Math.max(0, amount), Number.isFinite(rate) && rate > 0 ? rate : null, io.tax_included),
    due_date: text(formData, "due_date") ?? "",
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return fail(firstIssue(parsed));
  const { data, error } = await db().from("invoices").insert([{ ...parsed.data, io_id: io.id }]).select("id");
  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (error || !id) return fail(dbError(error, "Invoice gagal dibuat."));
  await recordAudit(staff, "create", "invoice", id, { number: parsed.data.invoice_number, amount });
  refreshAdmin(`${BASE}/io/${io.id}`);
  return ok("Invoice dibuat.");
}

export async function updateInvoiceAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["finance"]);
  const id = text(formData, "id");
  const ioId = text(formData, "io_id");
  const status = text(formData, "status");
  if (!id || !ioId || !status || !["unpaid", "paid", "overdue"].includes(status)) return fail("Data invoice tidak valid.");
  const proof = text(formData, "pph23_proof_url");
  if (proof && !/^https:\/\//.test(proof)) return fail("Tautan bukti potong PPh 23 harus https://");
  const { error } = await db()
    .from("invoices")
    .update({ status, pph23_proof_url: proof, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("io_id", ioId);
  if (error) return fail(dbError(error, "Invoice gagal diperbarui."));
  await recordAudit(staff, "update", "invoice", id, { status });
  refreshAdmin(`${BASE}/io/${ioId}`);
  return ok("Invoice diperbarui.");
}

/* ================================================================ slot & rate card */

export async function saveSlotAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["adops"]);
  const id = text(formData, "id");
  const fallback = text(formData, "fallback") ?? "none";
  if (!id || !["adsense", "gam", "house", "none"].includes(fallback)) return fail("Data slot tidak valid.");
  const sortOrder = Number(text(formData, "sort_order") ?? "0");
  const changes = {
    label: (text(formData, "label") ?? "").slice(0, 80) || undefined,
    is_active: formData.get("is_active") === "on",
    fallback,
    sort_order: Number.isSafeInteger(sortOrder) ? sortOrder : 0,
    notes: text(formData, "notes"),
  };
  const { error } = await db().from("ad_slots").update(changes).eq("id", id);
  if (error) return fail(dbError(error, "Slot gagal disimpan."));
  await recordAudit(staff, "update", "ad_slot", id, changes);
  refreshAdmin(`${BASE}/slot`, "/iklan");
  refreshServing();
  return ok("Slot disimpan.");
}

export async function saveRateCardAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff(["sales"]);
  const slotId = text(formData, "slot_id");
  const model = text(formData, "pricing_model");
  const rate = parseRupiah(text(formData, "rate"));
  if (!slotId || !model || !["flat", "cpm", "cpc"].includes(model) || rate === null) {
    return fail("Isi tarif dalam rupiah.");
  }
  const row = {
    slot_id: slotId,
    pricing_model: model,
    rate,
    min_order: text(formData, "min_order"),
    notes: text(formData, "notes"),
  };
  const { error } = await db().from("ad_rate_card").upsert([row], { onConflict: "slot_id,pricing_model" });
  if (error) return fail(dbError(error, "Rate card gagal disimpan."));
  await recordAudit(staff, "upsert", "ad_rate_card", slotId, row);
  refreshAdmin(`${BASE}/slot`, "/iklan");
  refreshServing();
  return ok("Rate card disimpan.");
}

/* ================================================================ pengaturan & ads.txt */

export async function saveSettingsAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff([]);
  const values = {
    ppn_rate_percent: text(formData, "ppn_rate_percent"),
    sales_email: text(formData, "sales_email"),
    sales_whatsapp: text(formData, "sales_whatsapp"),
    adsense_client: text(formData, "adsense_client"),
  };
  if (values.ppn_rate_percent && !/^\d{1,2}(\.\d{1,2})?$/.test(values.ppn_rate_percent)) {
    return fail("Tarif PPN berupa angka persen, mis. 11 atau 12.");
  }
  if (values.sales_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.sales_email)) return fail("Email sales tidak valid.");
  if (values.sales_whatsapp && !/^\+?\d{9,15}$/.test(values.sales_whatsapp.replace(/[\s-]/g, ""))) {
    return fail("Nomor WhatsApp tidak valid. Contoh: 6281234567890.");
  }
  if (values.adsense_client && !/^ca-pub-\d{10,20}$/.test(values.adsense_client)) {
    return fail("ID penerbit AdSense berbentuk ca-pub-xxxxxxxxxxxxxxxx.");
  }
  for (const [key, value] of Object.entries(values)) {
    const { error } = await db().from("ad_settings").update({ value }).eq("key", key);
    if (error) return fail(dbError(error, "Pengaturan gagal disimpan."));
  }
  await recordAudit(staff, "update", "ad_settings", null, values);
  refreshAdmin(`${BASE}/pengaturan`, "/iklan");
  refreshServing();
  return ok("Pengaturan disimpan.");
}

export async function addAdsTxtAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff([]);
  const parsed = adsTxtInput.safeParse({
    ad_system_domain: text(formData, "ad_system_domain") ?? "",
    publisher_id: text(formData, "publisher_id") ?? "",
    relationship: text(formData, "relationship") ?? "",
    cert_authority_id: text(formData, "cert_authority_id"),
  });
  if (!parsed.success) return fail(firstIssue(parsed));
  const { error } = await db().from("ads_txt_entries").insert([parsed.data]);
  if (error) return fail(dbError(error, "Entri ads.txt gagal disimpan."));
  await recordAudit(staff, "create", "ads_txt", null, parsed.data);
  refreshAdmin(`${BASE}/pengaturan`, "/ads.txt");
  return ok("Entri ads.txt ditambahkan.");
}

export async function toggleAdsTxtAction(_prev: AdActionState, formData: FormData): Promise<AdActionState> {
  const staff = await requireStaff([]);
  const id = text(formData, "id");
  const op = text(formData, "op");
  if (!id || (op !== "toggle" && op !== "delete")) return fail("Data tidak valid.");
  if (op === "delete") {
    const { error } = await db().from("ads_txt_entries").delete().eq("id", id);
    if (error) return fail(dbError(error, "Entri gagal dihapus."));
  } else {
    const active = formData.get("is_active") === "true";
    const { error } = await db().from("ads_txt_entries").update({ is_active: !active }).eq("id", id);
    if (error) return fail(dbError(error, "Entri gagal diubah."));
  }
  await recordAudit(staff, op, "ads_txt", id);
  refreshAdmin(`${BASE}/pengaturan`, "/ads.txt");
  return ok(op === "delete" ? "Entri dihapus." : "Status entri diubah.");
}
