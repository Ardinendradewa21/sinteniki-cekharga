import type { RefreshAlert } from "@/lib/import/price-refresh-rules";
import { SCRAPE_BRAND_LABELS, type ScrapeBrand } from "@/lib/scrape/types";

/**
 * Peringatan pemeriksaan harga harian (PB-05). Tidak tampil bila semua merek
 * berjalan normal, supaya dasbor tidak dipenuhi kabar baik yang tidak perlu
 * ditindaklanjuti.
 */

const STATUS_TEXT = {
  "source-error": "situs resmi tidak bisa dibaca",
  blocked: "situs resmi meminta verifikasi anti-bot (tidak ditembus)",
  error: "pemrosesan gagal",
} as const;

function brandLabel(brand: string): string {
  const label = SCRAPE_BRAND_LABELS[brand as ScrapeBrand];
  return label ? label.split(" (")[0]! : brand;
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function alertText(alert: RefreshAlert): string {
  switch (alert.kind) {
    case "belum-jalan":
      return `Pemeriksaan harga harian belum berjalan hari ini (${dayLabel(alert.runDate)}). Cek Vercel → Settings → Cron Jobs dan variabel CRON_SECRET.`;
    case "gagal":
      return `${brandLabel(alert.brand)}: ${STATUS_TEXT[alert.status]} hari ini.${alert.message ? ` Pesan: ${alert.message}` : ""}`;
    case "lama-tidak-berhasil":
      return alert.lastSuccess
        ? `${brandLabel(alert.brand)}: belum berhasil diperiksa sejak ${dayLabel(alert.lastSuccess)}, harganya ikut menua.`
        : `${brandLabel(alert.brand)}: belum pernah berhasil diperiksa dalam 14 hari terakhir.`;
  }
}

export function PriceRefreshAlerts({ alerts }: { alerts: readonly RefreshAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <section
      aria-labelledby="peringatan-harga-harian"
      role="alert"
      className="mt-4 rounded-xl border border-warning/40 bg-warning-muted p-4 text-sm text-foreground"
    >
      <h2 id="peringatan-harga-harian" className="font-bold">
        Pemeriksaan harga harian perlu dicek
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {alerts.map((alert) => (
          <li key={`${alert.kind}-${"brand" in alert ? alert.brand : alert.runDate}`}>{alertText(alert)}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Harga merek yang gagal tidak dihapus; labelnya otomatis menjadi &quot;harga terakhir tercatat&quot; setelah 30 jam.
      </p>
    </section>
  );
}
