import type { Metadata } from "next";

import { ActionForm } from "@/components/admin/ads/action-form";
import { AdsNav, Field, Notice, PageHeader, Panel, Pill, SelectField, Table, td } from "@/components/admin/ads/fields";
import { Container } from "@/components/layout/container";
import { addAdsTxtAction, saveSettingsAction, toggleAdsTxtAction } from "@/lib/ads/admin-actions";
import { countPendingCreatives, listAdsTxt, listSettings } from "@/lib/ads/admin-queries";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Pengaturan iklan", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdsSettingsPage() {
  await requireStaff([]);
  const [settings, adsTxt, pending] = await Promise.all([listSettings(), listAdsTxt(), countPendingCreatives()]);

  return (
    <Container className="space-y-6 py-10">
      <PageHeader title="Pengaturan iklan" description="Hanya peran admin. Nilai kosong berarti fitur terkait nonaktif." />
      <AdsNav current="/admin/iklan/pengaturan" pendingReview={pending} />

      <Panel title="Umum">
        <ActionForm action={saveSettingsAction} submitLabel="Simpan pengaturan">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="ppn_rate_percent"
              label="Tarif PPN (%)"
              inputMode="decimal"
              defaultValue={settings.ppn_rate_percent ?? ""}
              hint="Isi hanya setelah Finance memastikan status PKP. Kosong = invoice tanpa PPN."
            />
            <Field
              name="adsense_client"
              label="ID penerbit AdSense"
              defaultValue={settings.adsense_client ?? ""}
              placeholder="ca-pub-0000000000000000"
              hint="Mengaktifkan banner persetujuan dan cadangan AdSense di slot ber-fallback AdSense. ID unit per slot diatur lewat env ADSENSE_SLOT_<KODE>."
            />
            <Field
              name="sales_email"
              label="Email tim sales"
              type="email"
              defaultValue={settings.sales_email ?? ""}
              hint="Tampil di halaman /iklan."
            />
            <Field
              name="sales_whatsapp"
              label="WhatsApp tim sales"
              inputMode="tel"
              defaultValue={settings.sales_whatsapp ?? ""}
              placeholder="6281234567890"
              hint="Tampil di halaman /iklan sebagai tautan wa.me."
            />
          </div>
        </ActionForm>
      </Panel>

      <Panel
        title="ads.txt"
        description={
          <>
            Daftar penjual iklan resmi untuk domain ini, disajikan di{" "}
            <a href="/ads.txt" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
              /ads.txt
            </a>
            . Salin persis baris yang diberikan jaringan iklan (mis. AdSense: google.com, pub-…, DIRECT, f08c47fec0942fa0).
          </>
        }
      >
        <Table head={["Domain", "ID penerbit", "Hubungan", "Otoritas", "Status", "Aksi"]} empty={adsTxt.length === 0 ? "Belum ada entri." : undefined}>
          {adsTxt.map((entry) => (
            <tr key={entry.id}>
              <td className={td}>{entry.ad_system_domain}</td>
              <td className={`${td} font-mono text-xs`}>{entry.publisher_id}</td>
              <td className={td}>{entry.relationship}</td>
              <td className={`${td} font-mono text-xs`}>{entry.cert_authority_id ?? "–"}</td>
              <td className={td}>
                <Pill tone={entry.is_active ? "good" : "neutral"}>{entry.is_active ? "Aktif" : "Nonaktif"}</Pill>
              </td>
              <td className={td}>
                <div className="flex flex-wrap gap-2">
                  <ActionForm action={toggleAdsTxtAction} submitLabel={entry.is_active ? "Nonaktifkan" : "Aktifkan"} submitVariant="outline">
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="op" value="toggle" />
                    <input type="hidden" name="is_active" value={String(entry.is_active)} />
                  </ActionForm>
                  <ActionForm action={toggleAdsTxtAction} submitLabel="Hapus" submitVariant="destructive" confirmMessage="Hapus entri ads.txt ini?">
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="op" value="delete" />
                  </ActionForm>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <div className="mt-6 border-t border-border pt-6">
          <h3 className="mb-3 font-bold text-foreground">Tambah entri</h3>
          <ActionForm action={addAdsTxtAction} submitLabel="Tambah" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field scope="ads" name="ad_system_domain" label="Domain sistem iklan" required placeholder="google.com" />
              <Field scope="ads" name="publisher_id" label="ID penerbit" required placeholder="pub-0000000000000000" />
              <SelectField
                scope="ads"
                name="relationship"
                label="Hubungan"
                options={[
                  { value: "DIRECT", label: "DIRECT" },
                  { value: "RESELLER", label: "RESELLER" },
                ]}
              />
              <Field scope="ads" name="cert_authority_id" label="ID otoritas (opsional)" placeholder="f08c47fec0942fa0" />
            </div>
          </ActionForm>
        </div>
        <Notice>Tanpa entri, /ads.txt hanya berisi komentar. Itu sah dan menandakan belum ada penjual pihak ketiga.</Notice>
      </Panel>
    </Container>
  );
}
