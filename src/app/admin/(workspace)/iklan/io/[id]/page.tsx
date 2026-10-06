import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ActionForm } from "@/components/admin/ads/action-form";
import {
  AdsNav,
  Checkbox,
  Field,
  Notice,
  PageHeader,
  Panel,
  Pill,
  SelectField,
  Table,
  td,
  TextArea,
} from "@/components/admin/ads/fields";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import {
  createCreativeAction,
  createInvoiceAction,
  deleteCreativeAction,
  saveLineItemAction,
  setLineItemStatusAction,
  transitionIoAction,
  updateInvoiceAction,
  updateIoAction,
} from "@/lib/ads/admin-actions";
import {
  canTransitionIo,
  IO_LABEL,
  IO_TRANSITIONS,
  LINE_ITEM_LABEL,
  PRICING_MODELS,
  type IoStatus,
} from "@/lib/ads/admin-schema";
import {
  billingFor,
  countPendingCreatives,
  getAdvertiser,
  getContract,
  getIo,
  listCreatives,
  listInvoices,
  listLineItems,
  listRateCard,
  listSlots,
  readDailyReport,
  sumDelivery,
  type AdSlotRow,
  type LineItem,
} from "@/lib/ads/admin-queries";
import { formatPercent, PRICING_LABEL } from "@/lib/ads/billing";
import { formatJakarta, toJakartaLocalInput } from "@/lib/ads/time";
import { requireStaff } from "@/lib/auth/dal";
import { formatIdr } from "@/lib/catalog/pricing";

export const metadata: Metadata = { title: "Insertion order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nf = new Intl.NumberFormat("id-ID");
const REVIEW_TONE = { pending: "warn", approved: "good", rejected: "bad" } as const;
const REVIEW_LABEL = { pending: "Menunggu review", approved: "Disetujui", rejected: "Ditolak" } as const;
const INVOICE_LABEL = { unpaid: "Belum dibayar", paid: "Lunas", overdue: "Terlambat" } as const;

function LineItemFields({ slots, item, scope }: { slots: AdSlotRow[]; item?: LineItem; scope: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          scope={scope}
          name="slot_id"
          label="Slot"
          defaultValue={item?.slot_id}
          options={slots
            .filter((slot) => slot.kind === "banner")
            .map((slot) => ({
              value: slot.id,
              label: `${slot.label} · ${slot.desktop_size ?? "–"}${slot.is_active ? "" : " (nonaktif)"}`,
            }))}
        />
        <Field scope={scope} name="name" label="Nama line item" defaultValue={item?.name ?? ""} maxLength={200} />
        <SelectField
          scope={scope}
          name="pricing_model"
          label="Model harga"
          defaultValue={item?.pricing_model ?? "cpm"}
          options={PRICING_MODELS.map((value) => ({ value, label: PRICING_LABEL[value] }))}
        />
        <Field
          scope={scope}
          name="rate"
          label="Tarif (Rp)"
          inputMode="numeric"
          required
          defaultValue={item ? String(item.rate) : ""}
          hint="CPM: per 1.000 tayangan · CPC: per klik · Flat: total periode."
        />
        <Field
          scope={scope}
          name="target_quantity"
          label="Target tayangan/klik"
          inputMode="numeric"
          defaultValue={item?.target_quantity ? String(item.target_quantity) : ""}
          hint="Wajib untuk CPM/CPC. Tagihan tidak melebihi target."
        />
        <Field
          scope={scope}
          name="target_brands"
          label="Target merek halaman (opsional)"
          defaultValue={item?.target_brands.join(", ") ?? ""}
          hint="Mis. Samsung, iQOO. Kosong = semua halaman."
        />
        <Field scope={scope} name="start_at" label="Mulai (WIB)" type="datetime-local" required defaultValue={toJakartaLocalInput(item?.start_at ?? null)} />
        <Field scope={scope} name="end_at" label="Selesai (WIB)" type="datetime-local" required defaultValue={toJakartaLocalInput(item?.end_at ?? null)} />
        <div className="grid grid-cols-2 gap-4">
          <Field scope={scope} name="priority" label="Prioritas" type="number" min={1} max={100} defaultValue={String(item?.priority ?? 10)} hint="1 = tertinggi" />
          <Field scope={scope} name="weight" label="Bobot" type="number" min={1} max={100} defaultValue={String(item?.weight ?? 1)} />
        </div>
      </div>
    </>
  );
}

export default async function IoDetailPage(props: PageProps<"/admin/iklan/io/[id]">) {
  const staff = await requireStaff(["sales", "legal", "finance", "adops"]);
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const io = await getIo(id);
  if (!io) notFound();

  const contract = await getContract(io.contract_id);
  const [advertiser, slots, items, invoices, rateCard, pending] = await Promise.all([
    contract ? getAdvertiser(contract.advertiser_id) : null,
    listSlots(),
    listLineItems({ ioId: io.id }),
    listInvoices(io.id),
    listRateCard(),
    countPendingCreatives(),
  ]);
  const [creatives, report] = await Promise.all([
    listCreatives({ lineItemIds: items.map((item) => item.id) }),
    readDailyReport({ lineItemIds: items.map((item) => item.id) }),
  ]);
  const delivered = sumDelivery(report);
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const closed = io.status === "completed" || io.status === "cancelled";
  const transitions = (Object.keys(IO_TRANSITIONS[io.status]) as IoStatus[]).filter((to) =>
    canTransitionIo(staff.role, io.status, to)
  );
  const billedTotal = items.reduce((sum, item) => sum + billingFor(item, delivered.get(item.id)).amountIdr, 0);

  return (
    <Container className="space-y-6 py-10">
      <PageHeader
        title={`${io.io_number} · ${io.campaign_name}`}
        description={
          <>
            {advertiser ? (
              <Link href={`/admin/iklan/advertiser/${advertiser.id}`} className="font-semibold underline underline-offset-2">
                {advertiser.company_name}
              </Link>
            ) : null}
            {contract ? ` · PKS ${contract.contract_number}` : null}
          </>
        }
      >
        <Pill tone={io.status === "live" ? "good" : io.status === "cancelled" ? "bad" : "neutral"}>{IO_LABEL[io.status]}</Pill>
      </PageHeader>
      <AdsNav current="/admin/iklan/advertiser" pendingReview={pending} />

      <Panel
        title="Alur IO"
        description="Draft → Negosiasi → Disetujui (Legal, PKS harus ditandatangani) → Menunggu pembayaran → Siap tayang (Finance) → Tayang → Selesai (Ad Ops)."
      >
        {transitions.length === 0 ? (
          <Notice>Tidak ada langkah berikutnya untuk peran Anda pada status ini.</Notice>
        ) : (
          <div className="flex flex-wrap gap-3">
            {transitions.map((to) => (
              <ActionForm
                key={to}
                action={transitionIoAction}
                submitLabel={`Ubah ke ${IO_LABEL[to]}`}
                submitVariant={to === "cancelled" ? "destructive" : "default"}
                confirmMessage={to === "cancelled" ? "Batalkan IO ini? Semua line item akan diakhiri." : undefined}
              >
                <input type="hidden" name="id" value={io.id} />
                <input type="hidden" name="to" value={to} />
              </ActionForm>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Rincian IO" description={`Nilai tertagih berjalan: ${formatIdr(billedTotal)} dari nilai IO ${formatIdr(io.total_amount)}.`}>
        {closed ? (
          <Notice>IO sudah {IO_LABEL[io.status].toLowerCase()} sehingga tidak bisa diubah.</Notice>
        ) : (
          <ActionForm action={updateIoAction} submitLabel="Simpan IO">
            <input type="hidden" name="id" value={io.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="campaign_name" label="Nama kampanye" required defaultValue={io.campaign_name} />
              <Field name="total_amount" label="Nilai IO (Rp)" inputMode="numeric" defaultValue={String(io.total_amount)} />
            </div>
            <Checkbox name="tax_included" label="Nilai sudah termasuk PPN" defaultChecked={io.tax_included} />
            <TextArea name="notes" label="Catatan" defaultValue={io.notes} maxLength={2000} />
          </ActionForm>
        )}
      </Panel>

      <Panel
        title="Line item"
        description="Setiap line item = satu slot dengan model harga, jadwal, dan target. Iklan tayang bila IO Siap tayang/Tayang, line item Aktif, dan materinya disetujui."
      >
        <div className="space-y-4">
          {items.length === 0 ? <Notice>Belum ada line item.</Notice> : null}
          {items.map((item) => {
            const slot = slotById.get(item.slot_id);
            const delivery = delivered.get(item.id);
            const billing = billingFor(item, delivery);
            const itemCreatives = creatives.filter((creative) => creative.line_item_id === item.id);
            return (
              <article key={item.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-foreground">
                      {item.name || slot?.label} <span className="font-normal text-muted-foreground">· {slot?.code}</span>
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {PRICING_LABEL[item.pricing_model]} · {formatIdr(item.rate)}
                      {item.target_quantity ? ` · target ${nf.format(item.target_quantity)}` : ""} ·{" "}
                      {formatJakarta(item.start_at)} – {formatJakarta(item.end_at)}
                      {item.target_brands.length ? ` · merek: ${item.target_brands.join(", ")}` : ""}
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-foreground">
                      {nf.format(delivery?.impressions ?? 0)} tayangan · {nf.format(delivery?.clicks ?? 0)} klik · CTR{" "}
                      {formatPercent(billing.ctr)} · progres {formatPercent(billing.delivery, 0)} · tertagih{" "}
                      {formatIdr(billing.amountIdr)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={item.status === "active" ? "good" : item.status === "paused" ? "warn" : "neutral"}>
                      {LINE_ITEM_LABEL[item.status]}
                    </Pill>
                    {!closed && item.status !== "ended"
                      ? (["active", "paused", "ended"] as const)
                          .filter((status) => status !== item.status)
                          .map((status) => (
                            <ActionForm
                              key={status}
                              action={setLineItemStatusAction}
                              submitLabel={status === "active" ? "Aktifkan" : status === "paused" ? "Jeda" : "Akhiri"}
                              submitVariant={status === "ended" ? "destructive" : "outline"}
                              confirmMessage={status === "ended" ? "Akhiri line item ini? Iklannya berhenti tayang." : undefined}
                            >
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="status" value={status} />
                            </ActionForm>
                          ))
                      : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {itemCreatives.map((creative) => (
                    <div key={creative.id} className="rounded-lg border border-border p-3">
                      <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-muted">
                        {creative.image_url ? (
                          <Image src={creative.image_url} alt={creative.alt_text} fill sizes="320px" className="object-contain" />
                        ) : (
                          <p className="p-3 text-sm font-semibold">{creative.headline}</p>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Pill tone={REVIEW_TONE[creative.review_status]}>{REVIEW_LABEL[creative.review_status]}</Pill>
                        <span className="text-xs text-muted-foreground">{creative.format}</span>
                      </div>
                      {creative.review_note ? <p className="mt-1 text-xs text-muted-foreground">Catatan: {creative.review_note}</p> : null}
                      <p className="mt-1 truncate text-xs text-muted-foreground" title={creative.destination_url}>
                        {creative.destination_url}
                      </p>
                      <ActionForm
                        action={deleteCreativeAction}
                        submitLabel="Hapus"
                        submitVariant="ghost"
                        confirmMessage="Hapus materi ini?"
                        className="mt-2 space-y-2"
                      >
                        <input type="hidden" name="id" value={creative.id} />
                      </ActionForm>
                    </div>
                  ))}
                </div>

                {!closed && item.status !== "ended" ? (
                  <details className="mt-4 rounded-lg bg-muted/30 p-3">
                    <summary className="min-h-11 cursor-pointer content-center font-semibold text-foreground">Unggah materi</summary>
                    <ActionForm action={createCreativeAction} submitLabel="Unggah ke antrean review" resetOnSuccess className="mt-3 space-y-4">
                      <input type="hidden" name="line_item_id" value={item.id} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                          scope={`c-${item.id}`}
                          name="format"
                          label="Format"
                          options={[
                            { value: "display", label: "Display (gambar banner)" },
                            ...(slot?.allows_native ? [{ value: "native", label: "Native (judul + gambar + logo)" }] : []),
                          ]}
                        />
                        <Field
                          scope={`c-${item.id}`}
                          name="destination_url"
                          label="URL tujuan (https, sudah dengan UTM)"
                          type="url"
                          required
                          placeholder="https://brand.co.id/promo?utm_source=cekharga"
                        />
                        <Field
                          scope={`c-${item.id}`}
                          name="image"
                          label={`Gambar utama ${slot?.desktop_size ? `(${slot.desktop_size.replace("x", "×")})` : ""}`}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          hint="PNG/JPG/WebP/GIF ≤500 KB. Boleh ukuran 2× untuk retina."
                        />
                        {slot?.mobile_size ? (
                          <Field
                            scope={`c-${item.id}`}
                            name="image_mobile"
                            label={`Gambar mobile (${slot.mobile_size.replace("x", "×")}, opsional)`}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                          />
                        ) : null}
                        <Field scope={`c-${item.id}`} name="alt_text" label="Teks alternatif gambar" required maxLength={200} />
                        {slot?.allows_native ? (
                          <>
                            <Field scope={`c-${item.id}`} name="headline" label="Judul (native)" maxLength={90} />
                            <Field scope={`c-${item.id}`} name="body" label="Deskripsi singkat (native)" maxLength={200} />
                            <Field scope={`c-${item.id}`} name="cta_label" label="Teks tombol (native)" maxLength={30} placeholder="Lihat promo" />
                            <Field scope={`c-${item.id}`} name="logo" label="Logo (native, opsional)" type="file" accept="image/png,image/jpeg,image/webp" />
                          </>
                        ) : null}
                      </div>
                    </ActionForm>
                  </details>
                ) : null}

                {!closed ? (
                  <details className="mt-3 rounded-lg bg-muted/30 p-3">
                    <summary className="min-h-11 cursor-pointer content-center font-semibold text-foreground">Ubah line item</summary>
                    <ActionForm action={saveLineItemAction} submitLabel="Simpan line item" className="mt-3 space-y-4">
                      <input type="hidden" name="io_id" value={io.id} />
                      <input type="hidden" name="id" value={item.id} />
                      <LineItemFields slots={slots} item={item} scope={item.id} />
                    </ActionForm>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>

        {!closed ? (
          <div className="mt-6 border-t border-border pt-6">
            <h3 className="mb-1 font-bold text-foreground">Tambah line item</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Rate card acuan:{" "}
              {rateCard
                .filter((row) => row.rate > 0)
                .map((row) => `${slotById.get(row.slot_id)?.code ?? "?"} ${row.pricing_model.toUpperCase()} ${formatIdr(row.rate)}`)
                .join(" · ") || "belum diisi (Slot & rate card)."}
            </p>
            <ActionForm action={saveLineItemAction} submitLabel="Tambah line item" resetOnSuccess>
              <input type="hidden" name="io_id" value={io.id} />
              <LineItemFields slots={slots} scope="new" />
            </ActionForm>
          </div>
        ) : null}
      </Panel>

      <Panel title="Invoice" description="Uang muka dan pelunasan. PPN dihitung otomatis hanya bila tarif PPN diisi di Pengaturan dan IO belum termasuk pajak.">
        <Table head={["Nomor", "Jenis", "Jumlah", "PPN", "Jatuh tempo", "Status"]} empty={invoices.length === 0 ? "Belum ada invoice." : undefined}>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className={`${td} font-semibold`}>{invoice.invoice_number}</td>
              <td className={td}>{invoice.kind === "down_payment" ? "Uang muka" : "Pelunasan"}</td>
              <td className={`${td} tabular-nums`}>{formatIdr(invoice.amount)}</td>
              <td className={`${td} tabular-nums`}>{formatIdr(invoice.ppn_amount)}</td>
              <td className={td}>{formatJakarta(invoice.due_date, false)}</td>
              <td className={td}>
                <ActionForm action={updateInvoiceAction} submitLabel="Simpan" submitVariant="outline" className="space-y-2">
                  <input type="hidden" name="id" value={invoice.id} />
                  <input type="hidden" name="io_id" value={io.id} />
                  <SelectField
                    scope={invoice.id}
                    name="status"
                    label={INVOICE_LABEL[invoice.status]}
                    defaultValue={invoice.status}
                    options={(["unpaid", "paid", "overdue"] as const).map((value) => ({ value, label: INVOICE_LABEL[value] }))}
                  />
                  <Field
                    scope={invoice.id}
                    name="pph23_proof_url"
                    label="Tautan bukti potong PPh 23"
                    type="url"
                    defaultValue={invoice.pph23_proof_url ?? ""}
                  />
                </ActionForm>
              </td>
            </tr>
          ))}
        </Table>
        <div className="mt-6 border-t border-border pt-6">
          <h3 className="mb-3 font-bold text-foreground">Buat invoice</h3>
          <ActionForm action={createInvoiceAction} submitLabel="Buat invoice" resetOnSuccess>
            <input type="hidden" name="io_id" value={io.id} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field scope="inv" name="invoice_number" label="Nomor invoice" required />
              <SelectField
                scope="inv"
                name="kind"
                label="Jenis"
                options={[
                  { value: "down_payment", label: "Uang muka" },
                  { value: "final", label: "Pelunasan" },
                ]}
              />
              <Field scope="inv" name="amount" label="Jumlah (Rp, sebelum PPN)" inputMode="numeric" required />
              <Field scope="inv" name="due_date" label="Jatuh tempo" type="date" required />
            </div>
            <TextArea scope="inv" name="notes" label="Catatan" maxLength={2000} />
          </ActionForm>
        </div>
      </Panel>

      <Button asChild variant="outline">
        <Link href={`/admin/iklan/laporan?io=${io.id}`}>Lihat laporan harian IO ini</Link>
      </Button>
    </Container>
  );
}
