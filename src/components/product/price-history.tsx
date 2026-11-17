import { Marker, seriesStyle } from "@/components/product/price-history-marks";
import { PriceHistoryChart } from "@/components/product/price-history-chart";
import { formatIdr } from "@/lib/catalog/pricing";
import { loadPriceHistory } from "@/lib/catalog/price-history";
import {
  chartGeometry,
  GAP_HOURS,
  HISTORY_WINDOW_DAYS,
  MIN_CHART_POINTS,
  MIN_CHART_SPAN_DAYS,
  type PriceHistory,
} from "@/lib/catalog/price-history-rules";

/**
 * Riwayat harga varian terpilih (PB-36). Grafik SVG lengkap sudah ada di
 * HTML server (tanpa pergeseran tata letak); komponen klien hanya membukanya
 * sekali saat terlihat (VD-06). Bila data belum memenuhi ambang PRD §3, yang
 * tampil Recent Checks, bukan garis tren. Tidak ada klaim "harga terendah"
 * atau prediksi.
 */

function wibDateTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function wibParts(iso: string): { day: string; month: string; time: string } {
  const date = new Date(iso);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("id-ID", { ...options, timeZone: "Asia/Jakarta" }).format(date);
  return {
    day: part({ day: "numeric" }),
    month: part({ month: "short" }).replace(".", ""),
    time: part({ hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", "."),
  };
}

/** Jumlah catatan di Recent Checks; sama dengan ambang grafik (PRD §3). */
const RECENT_LIMIT = MIN_CHART_POINTS;

/**
 * Recent Checks (DESIGN.md §7): dipakai selama data belum cukup untuk grafik.
 * Date tile berisi tanggal besar dan bulan kecil (WIB), lalu toko, jam, dan
 * harga. Ini catatan pemeriksaan nyata, bukan tren.
 */
function RecentChecks({ history }: { history: PriceHistory }) {
  return (
    <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {history.records.slice(0, RECENT_LIMIT).map((record) => {
        const parts = wibParts(record.at);
        return (
          <li key={`${record.label}-${record.at}`} className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5">
            <time
              dateTime={record.at}
              className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-foreground"
            >
              <span className="text-lg leading-none font-extrabold tabular-nums">{parts.day}</span>
              <span className="mt-0.5 text-xs leading-none text-muted-foreground">{parts.month}</span>
            </time>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{record.label}</p>
              <p className="text-xs text-muted-foreground">Diperiksa pukul {parts.time} WIB</p>
            </div>
            <p className="tabular shrink-0 text-base font-extrabold tracking-tight text-foreground">{formatIdr(record.priceIdr)}</p>
          </li>
        );
      })}
    </ul>
  );
}

function RecordsTable({ history }: { history: PriceHistory }) {
  return (
    <table className="mt-3 w-full text-left text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="py-2 pr-3 font-medium">Waktu (WIB)</th>
          <th scope="col" className="py-2 pr-3 font-medium">Toko</th>
          <th scope="col" className="py-2 text-right font-medium">Harga</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {history.records.map((record) => (
          <tr key={`${record.label}-${record.at}`}>
            <td className="py-2 pr-3 text-muted-foreground">{wibDateTime(record.at)}</td>
            <td className="py-2 pr-3 text-foreground">{record.label}</td>
            <td className="tabular py-2 text-right text-foreground">{formatIdr(record.priceIdr)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export async function PriceHistorySection({
  variantId,
  variantLabel,
  now,
}: {
  variantId: string;
  variantLabel: string;
  now: Date;
}) {
  const history = await loadPriceHistory(variantId, now).catch(() => null);
  if (!history || history.totalPoints === 0) return null;

  return (
    <section aria-labelledby="riwayat-harga" className="mt-12">
      <h2 id="riwayat-harga" className="heading-section text-foreground">
        Riwayat harga · {variantLabel}
      </h2>

      {history.qualifies ? (
        <>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Dalam {HISTORY_WINDOW_DAYS} hari terakhir, harga varian ini{" "}
            {history.minPriceIdr === history.maxPriceIdr
              ? `tercatat tetap ${formatIdr(history.minPriceIdr ?? 0)}`
              : `tercatat antara ${formatIdr(history.minPriceIdr ?? 0)} dan ${formatIdr(history.maxPriceIdr ?? 0)}`}{" "}
            dari {history.totalPoints} pemeriksaan berhasil. Perubahan harga bukan bukti promo, dan grafik ini tidak memprediksi
            harga.
          </p>
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            {/* Dua ukuran geometri supaya teks dan penanda tidak gepeng: ponsel dan layar lebar. */}
            <PriceHistoryChart
              mobile={chartGeometry(history, { width: 360, height: 220 })}
              desktop={chartGeometry(history, { width: 960, height: 260 })}
            />
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              {history.series.map((series, index) => {
                const style = seriesStyle(index);
                return (
                  <li key={series.offerId} className="flex items-center gap-1.5">
                    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
                      <Marker x={5} y={5} shape={style.shape} color={style.stroke} />
                    </svg>
                    {series.label}
                  </li>
                );
              })}
              <li className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 4" className="h-1 w-4" aria-hidden>
                  <line x1={0} x2={16} y1={2} y2={2} stroke="currentColor" strokeWidth={2} strokeDasharray="4 4" />
                </svg>
                Putus-putus: tidak diperiksa lebih dari {GAP_HOURS} jam
              </li>
            </ul>
          </div>
          <details className="mt-4 rounded-2xl border border-border bg-card p-4">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-foreground">
              Lihat sebagai tabel
            </summary>
            <RecordsTable history={history} />
          </details>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Grafik tampil setelah varian ini punya minimal {MIN_CHART_POINTS} pemeriksaan berhasil dalam rentang{" "}
            {MIN_CHART_SPAN_DAYS} hari. Sampai saat itu, berikut {Math.min(history.records.length, RECENT_LIMIT)} pemeriksaan
            terbaru.
          </p>
          <RecentChecks history={history} />
        </>
      )}
    </section>
  );
}
