import Link from "next/link";
import type { Metadata } from "next";

import { AdsNav, Notice, PageHeader, Panel, Pill, Table, td } from "@/components/admin/ads/fields";
import { Container } from "@/components/layout/container";
import { LINE_ITEM_LABEL } from "@/lib/ads/admin-schema";
import {
  billingFor,
  countPendingCreatives,
  listIos,
  listLineItems,
  listSlots,
  readDailyReport,
  sumDelivery,
} from "@/lib/ads/admin-queries";
import { formatPercent, PRICING_LABEL } from "@/lib/ads/billing";
import { jakartaDay, shiftDay } from "@/lib/ads/dates";
import { formatJakarta } from "@/lib/ads/time";
import { requireStaff } from "@/lib/auth/dal";
import { formatIdr } from "@/lib/catalog/pricing";

export const metadata: Metadata = { title: "Iklan", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("id-ID");

export default async function AdsDashboardPage() {
  await requireStaff(["sales", "adops", "finance", "legal"]);

  const today = jakartaDay();
  const from = shiftDay(today, -6);
  const [items, ios, slots, pending, week] = await Promise.all([
    listLineItems(),
    listIos(),
    listSlots(),
    countPendingCreatives(),
    readDailyReport({ from, to: today }),
  ]);
  const running = items.filter((item) => item.status === "active" || item.status === "paused");
  const lifetime = await readDailyReport({ lineItemIds: running.map((item) => item.id) });
  const delivered = sumDelivery(lifetime);
  const ioById = new Map(ios.map((io) => [io.id, io]));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  const weekTotals = week.reduce(
    (sum, row) => ({
      impressions: sum.impressions + row.impressions,
      clicks: sum.clicks + row.clicks,
      bot: sum.bot + row.bot_impressions + row.bot_clicks,
    }),
    { impressions: 0, clicks: 0, bot: 0 }
  );
  const now = new Date().getTime();
  const liveNow = items.filter(
    (item) => item.status === "active" && Date.parse(item.start_at) <= now && Date.parse(item.end_at) > now
  ).length;

  const stats = [
    { label: "Line item tayang sekarang", value: nf.format(liveNow) },
    { label: "Tayangan 7 hari", value: nf.format(weekTotals.impressions) },
    { label: "Klik 7 hari", value: nf.format(weekTotals.clicks) },
    {
      label: "CTR 7 hari",
      value: formatPercent(weekTotals.impressions ? weekTotals.clicks / weekTotals.impressions : null),
    },
  ];

  return (
    <Container className="space-y-6 py-10">
      <PageHeader
        title="Iklan"
        description="Kelola advertiser, PKS, insertion order, materi, dan laporan tayang. Angka tayangan hanya menghitung viewable impression (≥50% terlihat ≥1 detik) dan tidak termasuk lalu lintas bot."
      />
      <AdsNav current="/admin/iklan" pendingReview={pending} />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-card p-4">
            <dt className="text-xs font-semibold text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{stat.value}</dd>
          </div>
        ))}
      </dl>
      {weekTotals.bot > 0 ? (
        <Notice>
          {nf.format(weekTotals.bot)} event bot/tidak wajar dalam 7 hari terakhir ditandai dan tidak ikut dihitung.
        </Notice>
      ) : null}
      {pending > 0 ? (
        <Notice tone="warn">
          {pending} materi menunggu review.{" "}
          <Link href="/admin/iklan/review" className="font-semibold underline underline-offset-2">
            Buka antrean review
          </Link>
        </Notice>
      ) : null}

      <Panel title="Line item berjalan" description="Line item aktif atau dijeda, beserta progres terhadap target IO.">
        <Table
          head={["Kampanye", "Slot", "Model", "Jadwal", "Tayang / klik", "Progres", "Nilai tertagih"]}
          empty={running.length === 0 ? "Belum ada line item yang berjalan." : undefined}
        >
          {running.map((item) => {
            const io = ioById.get(item.io_id);
            const delivery = delivered.get(item.id);
            const billing = billingFor(item, delivery);
            return (
              <tr key={item.id}>
                <td className={td}>
                  <Link href={`/admin/iklan/io/${item.io_id}`} className="font-semibold text-foreground hover:underline">
                    {io?.campaign_name ?? "IO"}
                  </Link>
                  <div className="text-xs text-muted-foreground">{item.name || io?.io_number}</div>
                  <div className="mt-1">
                    <Pill tone={item.status === "active" ? "good" : "warn"}>{LINE_ITEM_LABEL[item.status]}</Pill>
                  </div>
                </td>
                <td className={td}>{slotById.get(item.slot_id)?.label ?? "–"}</td>
                <td className={td}>{PRICING_LABEL[item.pricing_model]}</td>
                <td className={td}>
                  {formatJakarta(item.start_at, false)} – {formatJakarta(item.end_at, false)}
                </td>
                <td className={`${td} tabular-nums`}>
                  {nf.format(delivery?.impressions ?? 0)} / {nf.format(delivery?.clicks ?? 0)}
                </td>
                <td className={`${td} tabular-nums`}>{formatPercent(billing.delivery, 0)}</td>
                <td className={`${td} tabular-nums`}>{formatIdr(billing.amountIdr)}</td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </Container>
  );
}
