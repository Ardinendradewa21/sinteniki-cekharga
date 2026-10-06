import Link from "next/link";
import type { Metadata } from "next";

import { ActionForm } from "@/components/admin/ads/action-form";
import { AdsNav, Field, PageHeader, Panel, Pill, SelectField, Table, td, TextArea } from "@/components/admin/ads/fields";
import { Container } from "@/components/layout/container";
import { saveAdvertiserAction } from "@/lib/ads/admin-actions";
import { PROSPECT_LABEL, PROSPECT_STATUS } from "@/lib/ads/admin-schema";
import { countPendingCreatives, listAdvertisers, listContracts } from "@/lib/ads/admin-queries";
import { formatJakarta } from "@/lib/ads/time";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Advertiser", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PROSPECT_TONE = { lead: "warn", proposal: "neutral", active: "good", inactive: "neutral" } as const;

export default async function AdvertiserListPage() {
  await requireStaff(["sales", "legal", "finance", "adops"]);
  const [advertisers, contracts, pending] = await Promise.all([
    listAdvertisers(),
    listContracts(),
    countPendingCreatives(),
  ]);
  const contractCount = new Map<string, number>();
  for (const contract of contracts) {
    contractCount.set(contract.advertiser_id, (contractCount.get(contract.advertiser_id) ?? 0) + 1);
  }

  return (
    <Container className="space-y-6 py-10">
      <PageHeader
        title="Advertiser & PKS"
        description="CRM ringan: prospek dari form /iklan masuk otomatis berstatus Prospek. Buka advertiser untuk mengelola PKS dan insertion order."
      />
      <AdsNav current="/admin/iklan/advertiser" pendingReview={pending} />

      <Panel title="Daftar advertiser">
        <Table
          head={["Perusahaan", "Merek di label", "Kontak", "Status", "PKS", "Masuk"]}
          empty={advertisers.length === 0 ? "Belum ada advertiser." : undefined}
        >
          {advertisers.map((row) => (
            <tr key={row.id}>
              <td className={td}>
                <Link href={`/admin/iklan/advertiser/${row.id}`} className="font-semibold text-foreground hover:underline">
                  {row.company_name}
                </Link>
                {row.source === "form" ? <div className="text-xs text-muted-foreground">dari form /iklan</div> : null}
              </td>
              <td className={td}>{row.display_name}</td>
              <td className={td}>
                <div>{row.contact_name ?? "–"}</div>
                <div className="text-xs text-muted-foreground">{row.contact_email ?? row.contact_phone ?? ""}</div>
              </td>
              <td className={td}>
                <Pill tone={PROSPECT_TONE[row.prospect_status]}>{PROSPECT_LABEL[row.prospect_status]}</Pill>
              </td>
              <td className={`${td} tabular-nums`}>{contractCount.get(row.id) ?? 0}</td>
              <td className={td}>{formatJakarta(row.created_at, false)}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="Tambah advertiser" description="Untuk prospek yang masuk lewat email, telepon, atau pertemuan langsung.">
        <ActionForm action={saveAdvertiserAction} submitLabel="Simpan advertiser" resetOnSuccess>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="company_name" label="Nama perusahaan (sesuai NPWP)" required maxLength={200} />
            <Field
              name="display_name"
              label="Nama merek di label iklan"
              hint='Tampil sebagai "Iklan dari …". Kosong = nama perusahaan.'
              maxLength={80}
            />
            <Field name="npwp" label="NPWP" inputMode="numeric" hint="Dibutuhkan Finance untuk invoice dan PPh 23." />
            <SelectField
              name="prospect_status"
              label="Status prospek"
              options={PROSPECT_STATUS.map((value) => ({ value, label: PROSPECT_LABEL[value] }))}
              defaultValue="lead"
            />
            <Field name="contact_name" label="Nama kontak" maxLength={120} />
            <Field name="contact_email" label="Email kontak" type="email" maxLength={200} />
            <Field name="contact_phone" label="Telepon/WhatsApp kontak" type="tel" maxLength={20} />
          </div>
          <TextArea name="notes" label="Catatan" maxLength={2000} />
        </ActionForm>
      </Panel>
    </Container>
  );
}
