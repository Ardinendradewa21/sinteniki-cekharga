/**
 * Gaya seri riwayat harga, dipakai grafik (klien) dan legenda (server).
 * Modul tanpa direktif supaya bisa diimpor dari kedua sisi.
 *
 * Seri pertama memakai aksen tunggal --brand (DESIGN.md §7 Price History);
 * seri berikutnya netral. Bentuk penanda berbeda per seri, jadi seri tidak
 * dibedakan oleh warna saja (PRD §8).
 */
export const SERIES_STYLES = [
  { stroke: "var(--brand)", shape: "circle" },
  { stroke: "var(--foreground)", shape: "square" },
  { stroke: "var(--muted-foreground)", shape: "diamond" },
] as const;

export type SeriesShape = (typeof SERIES_STYLES)[number]["shape"];

export function seriesStyle(index: number) {
  return SERIES_STYLES[index % SERIES_STYLES.length]!;
}

export function Marker({ x, y, shape, color }: { x: number; y: number; shape: SeriesShape; color: string }) {
  if (shape === "square") return <rect x={x - 3.5} y={y - 3.5} width={7} height={7} fill={color} />;
  if (shape === "diamond") return <path d={`M${x} ${y - 4.5} L${x + 4.5} ${y} L${x} ${y + 4.5} L${x - 4.5} ${y} Z`} fill={color} />;
  return <circle cx={x} cy={y} r={3.5} fill={color} />;
}
