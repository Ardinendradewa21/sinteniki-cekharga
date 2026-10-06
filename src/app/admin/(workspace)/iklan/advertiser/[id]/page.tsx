import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ActionForm } from "@/components/admin/ads/action-form";
import { AdsNav, Field, Notice, PageHeader, Panel, Pill, SelectField, Table, td, TextArea, Checkbox } from "@/components/admin/ads/fields";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import {
  createContractAction,
  createIoAction,
  saveAdvertiserAction,
  updateContractAction,
} from "@/lib/ads/admin-actions";
import { CONTRACT_LABEL, CONTRACT_STATUS, IO_LABEL, PROSPECT_LABEL, PROSPECT_STATUS } from "@/lib/ads/admin-schema";
import { countPendingCreatives, getAdvertiser, listContracts, listIos } from "@/lib/ads/admin-queries";
import { formatJakarta } from "@/lib/ads/time";
import { requireStaff } from "@/lib/auth/dal";
import { formatIdr } from "@/lib/catalog/pricing";

export const metadata: Metadata = { title: "Detail advertiser", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTRACT_TONE = { draft: "warn", signed: "good", ended: "neutral", terminated: "bad" } as const;

export default async function AdvertiserDetailPage(props: PageProps<"/admin/iklan/advertiser/[id]">) {
  await requireStaff(["sales", "legal", "finance", "adops"]);
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const advertiser = await getAdvertiser(id);
  if (!advertiser) notFound();
  const [contracts, pending] = await Promise.all([listContracts(id), countPendingCreatives()]);
  const ios = await listIos(contracts.map((row) => row.id));
  const openContracts = contracts.filter((row) => row.status === "draft" || row.status === "signed");

  return (
    <Container className="space-y-6 py-10">
      <PageHeader title={advertiser.company_name} description={`Label iklan: "Iklan dari ${advertiser.display_name}"`}>
        <Button asChild variant="outline">
          <Link href="/admin/iklan/advertiser">Kembali</Link>
        </Button>
      </PageHeader>
      <AdsNav current="/admin/iklan/advertiser" pendingReview={pending} />

      <Panel title="Profil advertiser">
        <ActionForm action={saveAdvertiserAction} submitLabel="Simpan perubahan">
          <input type="hidden" name="id" value={advertiser.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="company_name" label="Nama perusahaan" required defaultValue={advertiser.company_name} />
            <Field name="display_name" label="Nama merek di label iklan" required defaultValue={advertiser.display_name} />
            <Field name="npwp" label="NPWP" inputMode="numeric" defaultValue={advertiser.npwp ?? ""} />
            <SelectField
              name="prospect_status"
              label="Status prospek"
              options={PROSPECT_STATUS.map((value) => ({ value, label: PROSPECT_LABEL[value] }))}
              defaultValue={advertiser.prospect_status}
            />
            <Field name="contact_name" label="Nama kontak" defaultValue={advertiser.contact_name ?? ""} />
            <Field name="contact_email" label="Email kontak" type="email" defaultValue={advertiser.contact_email ?? ""} />
            <Field name="contact_phone" label="Telepon/WhatsApp" type="tel" defaultValue={advertiser.contact_phone ?? ""} />
          </div>
          <TextArea name="notes" label="Catatan" defaultValue={advertiser.notes} maxLength={2000} />
        </ActionForm>
      </Panel>

      <Panel
        title="Perjanjian Kerja Sama (PKS)"
        description="Kontrak payung dengan advertiser. Berkas PKS bertanda tangan disimpan privat dan hanya bisa dibuka staf."
      >
        <Table
          head={["Nomor", "Periode", "Status", "Berkas", "Perbarui (Legal)"]}
          empty={contracts.length === 0 ? "Belum ada PKS." : undefined}
        >
          {contracts.map((contract) => (
            <tr key={contract.id}>
              <td className={`${td} font-semibold`}>{contract.contract_number}</td>
              <td className={td}>
                {formatJakarta(contract.start_date, false)} – {formatJakarta(contract.end_date, false)}
              </td>
              <td className={td}>
                <Pill tone={CONTRACT_TONE[contract.status]}>{CONTRACT_LABEL[contract.status]}</Pill>
              </td>
              <td className={td}>
                {contract.signed_file_key ? (
                  <a
                    href={`/admin/iklan/pks/${contract.id}/berkas`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand underline underline-offset-2"
                  >
                    Buka PDF
                  </a>
                ) : (
                  <span className="text-muted-foreground">Belum ada</span>
                )}
              </td>
              <td className={td}>
                <ActionForm action={updateContractAction} submitLabel="Perbarui" submitVariant="outline" className="space-y-2">
                  <input type="hidden" name="id" value={contract.id} />
                  <SelectField
                    scope={contract.id}
                    name="status"
                    label="Status"
                    options={CONTRACT_STATUS.map((value) => ({ value, label: CONTRACT_LABEL[value] }))}
                    defaultValue={contract.status}
                  />
                  <Field scope={contract.id} name="signed_file" label="PKS bertanda tangan (PDF ≤10 MB)" type="file" accept="application/pdf" />
                </ActionForm>
              </td>
            </tr>
          ))}
        </Table>

        <div className="mt-6 border-t border-border pt-6">
          <h3 className="mb-3 font-bold text-foreground">Tambah PKS</h3>
          <ActionForm action={createContractAction} submitLabel="Simpan PKS" resetOnSuccess>
            <input type="hidden" name="advertiser_id" value={advertiser.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field scope="new" name="contract_number" label="Nomor PKS" required placeholder="001/PKS-IKL/CH/X/2026" />
              <Field scope="new" name="start_date" label="Mulai" type="date" required />
              <Field scope="new" name="end_date" label="Selesai" type="date" required />
            </div>
            <Field
              scope="new"
              name="signed_file"
              label="PKS bertanda tangan (opsional, PDF ≤10 MB)"
              type="file"
              accept="application/pdf"
              hint="Dengan berkas, PKS langsung berstatus Ditandatangani."
            />
            <TextArea scope="new" name="notes" label="Catatan" maxLength={2000} />
          </ActionForm>
        </div>
      </Panel>

      <Panel title="Insertion order (IO)" description="Rincian tiap kampanye di bawah PKS: slot, periode, nilai.">
        <Table head={["Nomor IO", "Kampanye", "Status", "Nilai", "Dibuat"]} empty={ios.length === 0 ? "Belum ada IO." : undefined}>
          {ios.map((io) => (
            <tr key={io.id}>
              <td className={td}>
                <Link href={`/admin/iklan/io/${io.id}`} className="font-semibold text-foreground hover:underline">
                  {io.io_number}
                </Link>
              </td>
              <td className={td}>{io.campaign_name}</td>
              <td className={td}>
                <Pill tone={io.status === "live" ? "good" : io.status === "cancelled" ? "bad" : "neutral"}>{IO_LABEL[io.status]}</Pill>
              </td>
              <td className={`${td} tabular-nums`}>{formatIdr(io.total_amount)}</td>
              <td className={td}>{formatJakarta(io.created_at, false)}</td>
            </tr>
          ))}
        </Table>

        <div className="mt-6 border-t border-border pt-6">
          <h3 className="mb-3 font-bold text-foreground">Buat IO</h3>
          {openContracts.length === 0 ? (
            <Notice>Buat PKS terlebih dahulu. IO selalu berada di bawah PKS yang masih berlaku.</Notice>
          ) : (
            <ActionForm action={createIoAction} submitLabel="Buat IO">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  scope="io"
                  name="contract_id"
                  label="PKS"
                  options={openContracts.map((row) => ({ value: row.id, label: `${row.contract_number} (${CONTRACT_LABEL[row.status]})` }))}
                />
                <Field scope="io" name="io_number" label="Nomor IO" required placeholder="IO-2026-001" />
                <Field scope="io" name="campaign_name" label="Nama kampanye" required />
                <Field scope="io" name="total_amount" label="Nilai IO (Rp)" inputMode="numeric" placeholder="25.000.000" />
              </div>
              <Checkbox name="tax_included" label="Nilai sudah termasuk PPN" hint="Biarkan kosong bila PPN ditambahkan di invoice." />
              <TextArea scope="io" name="notes" label="Catatan" maxLength={2000} />
            </ActionForm>
          )}
        </div>
      </Panel>
    </Container>
  );
}
