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
 * Riwayat harga varian terpilih (PB-36). Grafik berupa SVG yang dirender
 * server: tanpa JavaScript tambahan dan tanpa pergeseran tata letak. Bila
 * data belum memenuhi ambang PRD §3, yang tampil daftar catatan, bukan garis
 * tren. Tidak ada klaim "harga terendah" atau prediksi.
 */

// Warna dari token desain yang ada; bentuk penanda berbeda supaya tidak bergantung warna (PRD §8).
const STYLES = [
  { stroke: "var(--brand)", shape: "circle" },
  { stroke: "var(--primary)", shape: "square" },
  { stroke: "var(--muted-foreground)", shape: "diamond" },
] as const;

/** Label sumbu dibulatkan ke terdekat (Rp20 jt untuk Rp19.999.000), bukan dipotong ke bawah. */
function axisIdr(priceIdr: number): string {
  if (priceIdr >= 1_000_000) return `Rp${(Math.round(priceIdr / 100_000) / 10).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return `Rp${Math.round(priceIdr / 1000)} rb`;
}

function wibDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function wibDateTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function Marker({ x, y, shape, color }: { x: number; y: number; shape: (typeof STYLES)[number]["shape"]; color: string }) {
  if (shape === "square") return <rect x={x - 3.5} y={y - 3.5} width={7} height={7} fill={color} />;
  if (shape === "diamond") return <path d={`M${x} ${y - 4.5} L${x + 4.5} ${y} L${x} ${y + 4.5} L${x - 4.5} ${y} Z`} fill={color} />;
  return <circle cx={x} cy={y} r={3.5} fill={color} />;
}

function ChartSvg({ history, size, className }: { history: PriceHistory; size: { width: number; height: number }; className: string }) {
  const geometry = chartGeometry(history, size);
  return (
    <svg
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      className={className}
      role="img"
      aria-label="Grafik riwayat harga; data lengkapnya ada di tabel di bawah grafik."
    >
      {geometry.yTicks.map((tick) => (
        <g key={tick.y}>
          <line x1={76} x2={geometry.width - 16} y1={tick.y} y2={tick.y} className="stroke-border" strokeWidth={1} />
          <text x={66} y={tick.y + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            {axisIdr(tick.priceIdr)}
          </text>
        </g>
      ))}
      {geometry.xTicks.map((tick) => (
        <text key={tick.x} x={tick.x} y={geometry.height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          {wibDate(tick.at)}
        </text>
      ))}
      {geometry.series.map((series, index) => {
        const style = STYLES[index % STYLES.length]!;
        return (
          <g key={series.offerId}>
            {series.solid ? <path d={series.solid} fill="none" stroke={style.stroke} strokeWidth={2} /> : null}
            {series.dashed ? <path d={series.dashed} fill="none" stroke={style.stroke} strokeWidth={2} strokeDasharray="4 4" /> : null}
            {series.markers.map((marker) => (
              <Marker key={marker.at} x={marker.x} y={marker.y} shape={style.shape} color={style.stroke} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Dua ukuran geometri supaya teks dan penanda tidak gepeng: ponsel dan layar lebar. */
function Chart({ history }: { history: PriceHistory }) {
  return (
    <>
      <ChartSvg history={history} size={{ width: 360, height: 220 }} className="h-auto w-full sm:hidden" />
      <ChartSvg history={history} size={{ width: 960, height: 260 }} className="hidden h-auto w-full sm:block" />
    </>
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
            <Chart history={history} />
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              {history.series.map((series, index) => {
                const style = STYLES[index % STYLES.length]!;
                return (
                  <li key={series.offerId} className="flex items-center gap-1.5">
                    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
                      <Marker x={5} y={5} shape={style.shape} color={style.stroke} />
                    </svg>
                    {series.label}
                  </li>
                );
              })}
              <li>Garis putus-putus = tidak diperiksa lebih dari {GAP_HOURS} jam</li>
            </ul>
          </div>
        </>
      ) : (
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Grafik tampil setelah varian ini punya minimal {MIN_CHART_POINTS} pemeriksaan berhasil dalam rentang{" "}
          {MIN_CHART_SPAN_DAYS} hari. Sampai saat itu, berikut catatan harganya.
        </p>
      )}

      <details className="mt-4 rounded-2xl border border-border bg-card p-4" open={!history.qualifies}>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-foreground">
          {history.qualifies ? "Lihat sebagai tabel" : `Catatan harga (${Math.min(history.records.length, 5)} terbaru)`}
        </summary>
        <RecordsTable history={history.qualifies ? history : { ...history, records: history.records.slice(0, 5) }} />
      </details>
    </section>
  );
}
