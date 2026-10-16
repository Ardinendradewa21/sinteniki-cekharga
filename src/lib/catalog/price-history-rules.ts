/**
 * Riwayat harga per varian (PB-36, PRD §3 keputusan 16 Oktober 2026).
 * Modul murni: tanpa jaringan, tanpa database.
 *
 * Titik riwayat adalah pemeriksaan BERHASIL yang nyata:
 * - pengamatan harga (`price_observations`), dan
 * - pemeriksaan berhasil (`price_checks` outcome `success`) yang
 *   memastikan harga terakhir masih berlaku, dengan harga pengamatan
 *   terakhir pada atau sebelum waktu itu.
 * Pemeriksaan gagal tidak pernah menjadi titik (PRD §7 butir 6).
 *
 * Grafik hanya boleh tampil bila varian punya minimal 5 titik dalam rentang
 * minimal 7 hari. Di bawah ambang itu yang ditampilkan daftar catatan.
 */

export const HISTORY_WINDOW_DAYS = 90;
export const MIN_CHART_POINTS = 5;
export const MIN_CHART_SPAN_DAYS = 7;
/** Jarak antar titik melebihi batas freshness = "tidak diperiksa". */
export const GAP_HOURS = 30;
/** Garis per toko yang digambar; toko lain tetap ada di tabel. */
const MAX_SERIES = 3;

const DAY_MS = 86_400_000;

type HistoryInput = {
  offers: readonly { id: string; label: string }[];
  observations: readonly { offerId: string; priceIdr: number; observedAt: string }[];
  checks: readonly { offerId: string; attemptedAt: string; outcome: string }[];
  now: Date;
};

export type HistoryPoint = { at: string; priceIdr: number };

export type HistorySeries = {
  offerId: string;
  label: string;
  points: HistoryPoint[];
  /** Pasangan titik berurutan yang jaraknya melebihi GAP_HOURS. */
  gaps: { from: string; to: string }[];
};

export type PriceHistory = {
  /** Paling banyak MAX_SERIES toko dengan titik terbanyak. */
  series: HistorySeries[];
  /** Semua catatan semua toko, terbaru dulu (untuk tabel dan daftar catatan). */
  records: (HistoryPoint & { label: string })[];
  totalPoints: number;
  spanDays: number;
  qualifies: boolean;
  minPriceIdr: number | null;
  maxPriceIdr: number | null;
};

export function buildPriceHistory({ offers, observations, checks, now }: HistoryInput): PriceHistory {
  const since = now.getTime() - HISTORY_WINDOW_DAYS * DAY_MS;
  const all: HistorySeries[] = [];

  for (const offer of offers) {
    const own = observations
      .filter((row) => row.offerId === offer.id)
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    if (own.length === 0) continue;

    const byTime = new Map<string, number>();
    for (const row of own) byTime.set(row.observedAt, row.priceIdr);
    for (const check of checks) {
      if (check.offerId !== offer.id || check.outcome !== "success" || byTime.has(check.attemptedAt)) continue;
      // Harga yang berlaku saat pemeriksaan = pengamatan terakhir pada atau sebelum waktu itu.
      const prior = own.filter((row) => row.observedAt <= check.attemptedAt).at(-1);
      if (prior) byTime.set(check.attemptedAt, prior.priceIdr);
    }

    const points = [...byTime]
      .map(([at, priceIdr]) => ({ at, priceIdr }))
      .filter((point) => new Date(point.at).getTime() >= since && new Date(point.at).getTime() <= now.getTime())
      .sort((a, b) => a.at.localeCompare(b.at));
    if (points.length === 0) continue;

    const gaps: HistorySeries["gaps"] = [];
    for (let i = 1; i < points.length; i += 1) {
      const hours = (new Date(points[i]!.at).getTime() - new Date(points[i - 1]!.at).getTime()) / 3_600_000;
      if (hours > GAP_HOURS) gaps.push({ from: points[i - 1]!.at, to: points[i]!.at });
    }
    all.push({ offerId: offer.id, label: offer.label, points, gaps });
  }

  // Dua listing dari toko yang sama dibedakan nomornya supaya legenda tidak kembar.
  const seen = new Map<string, number>();
  for (const series of all) {
    const count = (seen.get(series.label) ?? 0) + 1;
    seen.set(series.label, count);
    if (count > 1) series.label = `${series.label} (listing ${count})`;
  }

  const records = all
    .flatMap((series) => series.points.map((point) => ({ ...point, label: series.label })))
    .sort((a, b) => b.at.localeCompare(a.at) || a.label.localeCompare(b.label));
  const times = records.map((record) => new Date(record.at).getTime());
  const spanDays = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / DAY_MS : 0;
  const prices = records.map((record) => record.priceIdr);

  return {
    series: [...all].sort((a, b) => b.points.length - a.points.length || a.label.localeCompare(b.label)).slice(0, MAX_SERIES),
    records,
    totalPoints: records.length,
    spanDays,
    qualifies: records.length >= MIN_CHART_POINTS && spanDays >= MIN_CHART_SPAN_DAYS,
    minPriceIdr: prices.length ? Math.min(...prices) : null,
    maxPriceIdr: prices.length ? Math.max(...prices) : null,
  };
}

/* ------------------------------------------------------------ geometri SVG */

type ChartGeometry = {
  width: number;
  height: number;
  series: { offerId: string; label: string; solid: string; dashed: string; markers: { x: number; y: number; at: string; priceIdr: number }[] }[];
  yTicks: { y: number; priceIdr: number }[];
  xTicks: { x: number; at: string }[];
};

/**
 * Garis tangga per toko: harga berlaku sampai pemeriksaan berikutnya.
 * Segmen yang melintasi celah "tidak diperiksa" digambar putus-putus.
 */
export function chartGeometry(
  history: Pick<PriceHistory, "series" | "minPriceIdr" | "maxPriceIdr">,
  { width = 640, height = 220, padLeft = 76, padRight = 16, padTop = 12, padBottom = 28 } = {}
): ChartGeometry {
  const points = history.series.flatMap((series) => series.points);
  const times = points.map((point) => new Date(point.at).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const low = history.minPriceIdr ?? 0;
  const high = history.maxPriceIdr ?? 0;
  // Ruang 5% di atas dan bawah; garis datar tetap punya rentang tampilan.
  const pad = Math.max((high - low) * 0.05, high * 0.02, 1);
  const yLow = low - pad;
  const yHigh = high + pad;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const x = (at: string) => padLeft + (tMax === tMin ? plotW / 2 : ((new Date(at).getTime() - tMin) / (tMax - tMin)) * plotW);
  const y = (price: number) => padTop + (1 - (price - yLow) / (yHigh - yLow)) * plotH;
  const r = (value: number) => Math.round(value * 10) / 10;

  const series = history.series.map((item) => {
    const gapStarts = new Set(item.gaps.map((gap) => gap.from));
    let solid = "";
    let dashed = "";
    item.points.forEach((point, index) => {
      if (index === 0) {
        solid += `M${r(x(point.at))} ${r(y(point.priceIdr))}`;
        return;
      }
      const prev = item.points[index - 1]!;
      const step = ` M${r(x(prev.at))} ${r(y(prev.priceIdr))} H${r(x(point.at))} V${r(y(point.priceIdr))}`;
      if (gapStarts.has(prev.at)) dashed += step;
      else solid += step;
    });
    return {
      offerId: item.offerId,
      label: item.label,
      solid: solid.trim(),
      dashed: dashed.trim(),
      markers: item.points.map((point) => ({ x: r(x(point.at)), y: r(y(point.priceIdr)), at: point.at, priceIdr: point.priceIdr })),
    };
  });

  // Harga yang tidak berubah cukup satu garis bantu, bukan tiga label bertumpuk.
  const tickValues = high === low ? [high] : [high, (high + low) / 2, low];
  const yTicks = tickValues.map((priceIdr) => ({ y: r(y(priceIdr)), priceIdr: Math.round(priceIdr) }));
  const tickCount = 4;
  const xTicks = Array.from({ length: tickCount }, (_, index) => {
    const t = tMin + ((tMax - tMin) * index) / (tickCount - 1);
    const at = new Date(t).toISOString();
    return { x: r(x(at)), at };
  });

  return { width, height, series, yTicks, xTicks };
}
