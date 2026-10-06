import Link from "next/link";
import type { Metadata } from "next";

import { AdsNav, Field, Notice, PageHeader, Panel, SelectField, Table, td } from "@/components/admin/ads/fields";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { billingFor, countPendingCreatives, sumDelivery } from "@/lib/ads/admin-queries";
import { formatPercent, PRICING_LABEL } from "@/lib/ads/billing";
import { loadReport, parseReportFilter } from "@/lib/ads/report";
import { requireStaff } from "@/lib/auth/dal";
import { formatIdr } from "@/lib/catalog/pricing";

export const metadata: Metadata = { title: "Laporan iklan", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("id-ID");

export default async function AdsReportPage(props: PageProps<"/admin/iklan/laporan">) {
  await requireStaff(["adops", "sales", "finance"]);
  const filter = parseReportFilter(await props.searchParams);
  const [{ rows, items, ios, io }, pending] = await Promise.all([loadReport(filter), countPendingCreatives()]);

  const perItem = sumDelivery(rows);
  const reportedItems = items.filter((item) => perItem.has(item.id));
  const byDay = new Map<string, { impressions: number; clicks: number; bot: number }>();
  for (const row of rows) {
    const day = byDay.get(row.day) ?? { impressions: 0, clicks: 0, bot: 0 };
    day.impressions += row.impressions;
    day.clicks += row.clicks;
    day.bot += row.bot_impressions + row.bot_clicks;
    byDay.set(row.day, day);
  }
  const query = new URLSearchParams({ dari: filter.from, sampai: filter.to, ...(filter.ioId ? { io: filter.ioId } : {}) });

  return (
    <Container className="space-y-6 py-10">
      <PageHeader
        title="Laporan"
        description="Hari dihitung dalam WIB. Tayangan = viewable impression; event bot ditandai dan tidak ikut tagihan. Tagihan CPM/CPC tidak melebihi target line item."
      >
        <Button asChild variant="outline">
          <a href={`/admin/iklan/laporan/csv?${query.toString()}`}>Unduh CSV</a>
        </Button>
      </PageHeader>
      <AdsNav current="/admin/iklan/laporan" pendingReview={pending} />

      <Panel title="Filter">
        <form method="get" className="grid items-end gap-4 sm:grid-cols-4">
          <Field name="dari" label="Dari" type="date" defaultValue={filter.from} />
          <Field name="sampai" label="Sampai" type="date" defaultValue={filter.to} />
          <SelectField
            name="io"
            label="Insertion order"
            defaultValue={filter.ioId ?? ""}
            options={[{ value: "", label: "Semua IO" }, ...ios.map((row) => ({ value: row.id, label: `${row.io_number} · ${row.campaign_name}` }))]}
          />
          <Button type="submit" className="min-h-11">
            Terapkan
          </Button>
        </form>
      </Panel>

      {io ? (
        <Notice>
          Menampilkan IO{" "}
          <Link href={`/admin/iklan/io/${io.id}`} className="font-semibold underline underline-offset-2">
            {io.io_number} · {io.campaign_name}
          </Link>
          .
        </Notice>
      ) : null}

      <Panel title="Per line item" description="Nilai tertagih dihitung dari data pada rentang tanggal ini saja.">
        <Table
          head={["Line item", "Model", "Tayangan", "Klik", "CTR", "Bot (ditandai)", "Unit tertagih", "Nilai"]}
          empty={reportedItems.length === 0 ? "Belum ada data tayang pada rentang ini." : undefined}
        >
          {reportedItems.map((item) => {
            const delivery = perItem.get(item.id);
            const billing = billingFor(item, delivery);
            return (
              <tr key={item.id}>
                <td className={td}>
                  <Link href={`/admin/iklan/io/${item.io_id}`} className="font-semibold text-foreground hover:underline">
                    {item.name || "Line item"}
                  </Link>
                </td>
                <td className={td}>{PRICING_LABEL[item.pricing_model]}</td>
                <td className={`${td} tabular-nums`}>{nf.format(delivery?.impressions ?? 0)}</td>
                <td className={`${td} tabular-nums`}>{nf.format(delivery?.clicks ?? 0)}</td>
                <td className={`${td} tabular-nums`}>{formatPercent(billing.ctr)}</td>
                <td className={`${td} tabular-nums`}>{nf.format((delivery?.botImpressions ?? 0) + (delivery?.botClicks ?? 0))}</td>
                <td className={`${td} tabular-nums`}>{billing.billableUnits === null ? "Flat" : nf.format(billing.billableUnits)}</td>
                <td className={`${td} tabular-nums`}>{formatIdr(billing.amountIdr)}</td>
              </tr>
            );
          })}
        </Table>
      </Panel>

      <Panel title="Harian">
        <Table head={["Tanggal", "Tayangan", "Klik", "CTR", "Bot (ditandai)"]} empty={byDay.size === 0 ? "Belum ada data." : undefined}>
          {[...byDay.entries()].map(([day, total]) => (
            <tr key={day}>
              <td className={td}>{day}</td>
              <td className={`${td} tabular-nums`}>{nf.format(total.impressions)}</td>
              <td className={`${td} tabular-nums`}>{nf.format(total.clicks)}</td>
              <td className={`${td} tabular-nums`}>{formatPercent(total.impressions ? total.clicks / total.impressions : null)}</td>
              <td className={`${td} tabular-nums`}>{nf.format(total.bot)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </Container>
  );
}
