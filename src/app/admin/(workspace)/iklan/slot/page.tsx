import type { Metadata } from "next";

import { ActionForm } from "@/components/admin/ads/action-form";
import { AdsNav, Checkbox, Field, Notice, PageHeader, Panel, Pill, SelectField } from "@/components/admin/ads/fields";
import { Container } from "@/components/layout/container";
import { saveRateCardAction, saveSlotAction } from "@/lib/ads/admin-actions";
import { countPendingCreatives, listRateCard, listSlots } from "@/lib/ads/admin-queries";
import { PRICING_LABEL } from "@/lib/ads/billing";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Slot & rate card", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const FALLBACK_OPTIONS = [
  { value: "none", label: "Kosongkan (tidak tampil)" },
  { value: "adsense", label: "AdSense (perlu ID penerbit + persetujuan pengunjung)" },
] as const;

export default async function SlotPage() {
  await requireStaff(["adops", "sales"]);
  const [slots, rateCard, pending] = await Promise.all([listSlots(), listRateCard(), countPendingCreatives()]);

  return (
    <Container className="space-y-6 py-10">
      <PageHeader
        title="Slot & rate card"
        description="Inventaris slot disimpan di database. Menonaktifkan slot langsung menghentikan iklan di slot itu tanpa deploy. Rate card tampil di media kit /iklan."
      />
      <AdsNav current="/admin/iklan/slot" pendingReview={pending} />
      <Notice>
        Perubahan slot oleh Ad Ops; perubahan tarif oleh Sales. Ukuran slot mengikuti standar IAB dan diubah lewat
        migrasi, karena materi yang sudah disetujui bergantung pada ukurannya.
      </Notice>

      <div className="grid gap-4 lg:grid-cols-2">
        {slots.map((slot) => {
          const rates = rateCard.filter((row) => row.slot_id === slot.id);
          return (
            <Panel
              key={slot.id}
              title={slot.label}
              description={`${slot.code} · ${slot.page} · desktop ${slot.desktop_size ?? "–"} · mobile ${slot.mobile_size ?? "–"}${slot.allows_native ? " · native" : ""}`}
              actions={<Pill tone={slot.is_active ? "good" : "neutral"}>{slot.is_active ? "Aktif" : "Nonaktif"}</Pill>}
            >
              {slot.kind !== "banner" ? (
                <Notice>Sponsored listing direncanakan untuk Fase 4 dan belum bisa dijual.</Notice>
              ) : (
                <div className="space-y-5">
                  <ActionForm action={saveSlotAction} submitLabel="Simpan slot" submitVariant="outline">
                    <input type="hidden" name="id" value={slot.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field scope={slot.id} name="label" label="Label" defaultValue={slot.label} maxLength={80} />
                      <Field scope={slot.id} name="sort_order" label="Urutan" type="number" defaultValue={String(slot.sort_order)} />
                      <SelectField
                        scope={slot.id}
                        name="fallback"
                        label="Bila tidak terjual"
                        defaultValue={slot.fallback === "adsense" ? "adsense" : "none"}
                        options={FALLBACK_OPTIONS}
                        className="sm:col-span-2"
                      />
                    </div>
                    <Checkbox name="is_active" label="Slot aktif" defaultChecked={slot.is_active} />
                  </ActionForm>

                  <div className="space-y-3 border-t border-border pt-4">
                    <h3 className="text-sm font-bold text-foreground">Rate card</h3>
                    {(["cpm", "flat", "cpc"] as const).map((model) => {
                      const row = rates.find((rate) => rate.pricing_model === model);
                      return (
                        <ActionForm key={model} action={saveRateCardAction} submitLabel={`Simpan ${model.toUpperCase()}`} submitVariant="outline" className="space-y-2">
                          <input type="hidden" name="slot_id" value={slot.id} />
                          <input type="hidden" name="pricing_model" value={model} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field
                              scope={`${slot.id}-${model}`}
                              name="rate"
                              label={PRICING_LABEL[model]}
                              inputMode="numeric"
                              defaultValue={row && row.rate > 0 ? String(row.rate) : ""}
                              placeholder="Rp"
                            />
                            <Field
                              scope={`${slot.id}-${model}`}
                              name="min_order"
                              label="Minimum order"
                              defaultValue={row?.min_order ?? ""}
                              placeholder={model === "flat" ? "1 minggu" : "100.000 tayangan"}
                            />
                          </div>
                        </ActionForm>
                      );
                    })}
                  </div>
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </Container>
  );
}
