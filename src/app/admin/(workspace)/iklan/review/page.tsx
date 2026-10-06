import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { ActionForm } from "@/components/admin/ads/action-form";
import { AdsNav, Checkbox, Notice, PageHeader, Panel, Pill, TextArea } from "@/components/admin/ads/fields";
import { Container } from "@/components/layout/container";
import { reviewCreativeAction } from "@/lib/ads/admin-actions";
import { REVIEW_CHECKLIST } from "@/lib/ads/admin-schema";
import {
  listAdvertisers,
  listContracts,
  listCreatives,
  listIos,
  listLineItems,
  listSlots,
} from "@/lib/ads/admin-queries";
import { formatJakarta } from "@/lib/ads/time";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Review materi iklan", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CreativeReviewPage() {
  const staff = await requireStaff(["adops"]);
  const [queue, items, ios, contracts, advertisers, slots] = await Promise.all([
    listCreatives({ reviewStatus: "pending" }),
    listLineItems(),
    listIos(),
    listContracts(),
    listAdvertisers(),
    listSlots(),
  ]);
  const itemById = new Map(items.map((row) => [row.id, row]));
  const ioById = new Map(ios.map((row) => [row.id, row]));
  const contractById = new Map(contracts.map((row) => [row.id, row]));
  const advertiserById = new Map(advertisers.map((row) => [row.id, row]));
  const slotById = new Map(slots.map((row) => [row.id, row]));
  const oldestFirst = [...queue].reverse();

  return (
    <Container className="space-y-6 py-10">
      <PageHeader
        title="Review materi"
        description="Setiap materi wajib lolos checklist sebelum tayang. Kategori sensitif (keuangan, kesehatan) dan materi pertama dari advertiser baru wajib disetujui peran admin."
      />
      <AdsNav current="/admin/iklan/review" pendingReview={queue.length} />

      {oldestFirst.length === 0 ? <Notice>Tidak ada materi yang menunggu review.</Notice> : null}

      {oldestFirst.map((creative) => {
        const item = itemById.get(creative.line_item_id);
        const io = item ? ioById.get(item.io_id) : undefined;
        const contract = io ? contractById.get(io.contract_id) : undefined;
        const advertiser = contract ? advertiserById.get(contract.advertiser_id) : undefined;
        const slot = item ? slotById.get(item.slot_id) : undefined;
        return (
          <Panel
            key={creative.id}
            title={`${advertiser?.display_name ?? "Advertiser"} · ${slot?.label ?? "slot"}`}
            description={
              <>
                {io ? (
                  <Link href={`/admin/iklan/io/${io.id}`} className="underline underline-offset-2">
                    {io.io_number} · {io.campaign_name}
                  </Link>
                ) : null}{" "}
                · diunggah {formatJakarta(creative.created_at)}
              </>
            }
            actions={<Pill tone="warn">{creative.format === "native" ? "Native" : "Display"}</Pill>}
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="space-y-3">
                {creative.image_url ? (
                  <div className="relative aspect-[16/7] overflow-hidden rounded-lg border border-border bg-muted">
                    <Image src={creative.image_url} alt={creative.alt_text} fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-contain" />
                  </div>
                ) : null}
                {creative.image_url_mobile ? (
                  <div className="relative mx-auto aspect-[16/5] max-w-[320px] overflow-hidden rounded-lg border border-border bg-muted">
                    <Image src={creative.image_url_mobile} alt="" fill sizes="320px" className="object-contain" />
                  </div>
                ) : null}
                <dl className="grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
                  <dt className="font-semibold text-muted-foreground">Teks alternatif</dt>
                  <dd>{creative.alt_text}</dd>
                  {creative.headline ? (
                    <>
                      <dt className="font-semibold text-muted-foreground">Judul</dt>
                      <dd>{creative.headline}</dd>
                    </>
                  ) : null}
                  {creative.body ? (
                    <>
                      <dt className="font-semibold text-muted-foreground">Deskripsi</dt>
                      <dd>{creative.body}</dd>
                    </>
                  ) : null}
                  {creative.cta_label ? (
                    <>
                      <dt className="font-semibold text-muted-foreground">Tombol</dt>
                      <dd>{creative.cta_label}</dd>
                    </>
                  ) : null}
                  <dt className="font-semibold text-muted-foreground">Tujuan</dt>
                  <dd className="break-all">
                    <a href={creative.destination_url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline underline-offset-2">
                      {creative.destination_url}
                    </a>
                  </dd>
                </dl>
              </div>

              <ActionForm
                action={reviewCreativeAction}
                submitLabel="Setujui"
                submitName="decision"
                submitValue="approve"
                extraSubmit={{ label: "Tolak", name: "decision", value: "reject", variant: "destructive" }}
              >
                <input type="hidden" name="id" value={creative.id} />
                <fieldset className="space-y-1">
                  <legend className="mb-1 text-sm font-bold text-foreground">Checklist</legend>
                  {REVIEW_CHECKLIST.map((check) => (
                    <Checkbox key={check.key} name={check.key} label={check.label} />
                  ))}
                  <Checkbox
                    name="sensitive"
                    label="Kategori sensitif (keuangan, kesehatan)"
                    hint={staff.role === "admin" ? undefined : "Bila dicentang, persetujuan harus oleh peran admin."}
                  />
                </fieldset>
                <TextArea scope={creative.id} name="review_note" label="Catatan review (wajib bila ditolak)" maxLength={1000} />
              </ActionForm>
            </div>
          </Panel>
        );
      })}
    </Container>
  );
}
