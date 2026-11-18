import { TileSweep } from "@/components/admin/tile-sweep";
import type { RefreshCell, RefreshGrid } from "@/lib/admin/refresh-grid";
import { officialBrandName } from "@/lib/catalog/brands";
import { cn } from "@/lib/utils";

/** Sudut tile mengikuti Veyla (sekitar 28% sisi), bukan lingkaran. */
const TILE_RADIUS = "rounded-[28%]";

const CELL_STYLE: Record<Exclude<RefreshCell, null>, string> = {
  berhasil: "bg-brand",
  // Grafis bermakna wajib >= 3:1 (WCAG 1.4.11): border-strong penuh 3.96:1 di kartu.
  "tanpa-penawaran": "bg-border-strong",
  gagal: "bg-destructive text-background",
};

const CELL_LABEL: Record<Exclude<RefreshCell, null>, string> = {
  berhasil: "berhasil diperiksa",
  "tanpa-penawaran": "tidak ada penawaran untuk diperiksa",
  gagal: "gagal",
};

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * "Pemeriksaan harga harian per merek" (CD-03, pola tile harian Veyla).
 *
 * Satu kotak = satu merek di satu tanggal WIB, dari `price_refresh_runs`.
 * Status tidak bergantung pada warna saja: kotak gagal memuat tanda "!", setiap
 * sel punya teks untuk pembaca layar dan tooltip, dan legenda bertulisan.
 * Tabel HTML asli supaya pembaca layar menyebut merek dan tanggalnya.
 * Permukaan solid (data, bukan kaca).
 */
export function RefreshHeatmap({ grid }: { grid: RefreshGrid }) {
  if (grid.rows.length === 0) return null;
  const totalFailures = grid.failuresPerDay.reduce((sum, value) => sum + value, 0);

  return (
    <section aria-labelledby="pemeriksaan-harian" className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="pemeriksaan-harian" className="text-lg font-semibold text-foreground">
            Pemeriksaan harga harian per merek
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {grid.dates.length} hari terakhir (WIB). Satu kotak = satu merek di satu hari.{" "}
            {totalFailures > 0 ? `${totalFailures} kali gagal dalam periode ini.` : "Tidak ada yang gagal dalam periode ini."}
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Keterangan warna">
          <li className="flex items-center gap-1.5"><span aria-hidden className={cn("size-3.5 bg-brand", TILE_RADIUS)} />Berhasil</li>
          <li className="flex items-center gap-1.5"><span aria-hidden className={cn("size-3.5 bg-border-strong", TILE_RADIUS)} />Tanpa penawaran</li>
          <li className="flex items-center gap-1.5"><span aria-hidden className={cn("flex size-3.5 items-center justify-center bg-destructive text-[9px] font-bold text-background", TILE_RADIUS)}>!</span>Gagal</li>
          <li className="flex items-center gap-1.5"><span aria-hidden className={cn("size-3.5 border border-dashed border-border-strong", TILE_RADIUS)} />Tidak berjalan</li>
        </ul>
      </div>

      {/* `relative`: label sr-only (position absolute) di dalam tabel harus ikut
          terpotong wadah gulir ini; tanpanya halaman ikut melebar di 375px. */}
      <TileSweep className="relative mt-5 overflow-x-auto">
        <table className="border-separate border-spacing-1 text-xs">
          <caption className="sr-only">Status pemeriksaan harga harian per merek dan tanggal</caption>
          <thead>
            <tr>
              <th scope="col" className="sr-only">Merek</th>
              {grid.dates.map((date, index) => (
                <th key={date} scope="col" className="px-0 pb-1 text-center font-medium text-muted-foreground">
                  <span className={cn(index % 2 === 1 && index !== grid.dates.length - 1 && "invisible")}>{shortDate(date).split(" ")[0]}</span>
                  <span className="sr-only">{shortDate(date)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.brand}>
                <th scope="row" className="pr-2 text-left font-semibold whitespace-nowrap text-foreground">
                  {officialBrandName(row.brand)}
                </th>
                {row.cells.map((cell, index) => {
                  const date = grid.dates[index]!;
                  const label = `${officialBrandName(row.brand)}, ${shortDate(date)}: ${cell ? CELL_LABEL[cell] : "tidak berjalan"}`;
                  return (
                    <td key={date} className="p-0">
                      <span
                        title={label}
                        data-tile-col={index}
                        className={cn(
                          "flex size-6 items-center justify-center text-[10px] font-bold sm:size-7",
                          TILE_RADIUS,
                          cell ? CELL_STYLE[cell] : "border border-dashed border-border-strong"
                        )}
                      >
                        <span aria-hidden>{cell === "gagal" ? "!" : ""}</span>
                        <span className="sr-only">{label}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TileSweep>
    </section>
  );
}
