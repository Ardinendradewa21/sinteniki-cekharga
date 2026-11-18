import { chipsetShortName } from "@/lib/assistant/chipset-tiers";
import type { ProductSpecRow } from "@/lib/catalog/queries";

type Tile = { label: string; value: string | null; unit?: string; note?: string };

/** "6300 mAh" -> angka "6.300" + satuan "mAh"; "6.9 inci, IPS LCD" -> "6,9" + "inci" + catatan. */
function splitNumber(value: string): { value: string; unit?: string; note?: string } {
  const [main, ...rest] = value.split(",").map((part) => part.trim());
  const match = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(main ?? "");
  if (!match) return { value };
  const number = Number(match[1]);
  return {
    value: number.toLocaleString("id-ID", { maximumFractionDigits: 2 }),
    unit: match[2] || undefined,
    note: rest.join(", ") || undefined,
  };
}

/**
 * Ringkasan spesifikasi kunci di bawah galeri (CD-02, pola "stat bar" Calda:
 * angka besar, satuan kecil). Murni ringkasan dari tabel spesifikasi yang sama
 * (`detail.specs`), tanpa penilaian atau kelas; nilai yang belum diketahui
 * ditulis terbuka, bukan disembunyikan. Permukaan solid, bukan kaca (data).
 */
export function KeySpecTiles({ specs }: { specs: ProductSpecRow[] }) {
  const find = (label: string) => specs.find((spec) => spec.label === label)?.value ?? null;
  const screen = find("Layar");
  const battery = find("Baterai");
  const camera = find("Kamera utama");
  const chipset = find("Chipset");

  const tiles: Tile[] = [
    screen ? { label: "Layar", ...splitNumber(screen) } : { label: "Layar", value: null },
    battery ? { label: "Baterai", ...splitNumber(battery) } : { label: "Baterai", value: null },
    camera ? { label: "Kamera utama", ...splitNumber(camera) } : { label: "Kamera utama", value: null },
    { label: "Chipset", value: chipset ? chipsetShortName(chipset) : null },
  ];

  if (tiles.every((tile) => tile.value === null)) return null;

  return (
    <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="min-w-0 bg-card px-4 py-3">
          <dt className="text-xs font-semibold text-muted-foreground">{tile.label}</dt>
          <dd className="mt-1 min-w-0">
            {tile.value === null ? (
              <span className="text-sm font-normal text-muted-foreground italic">Belum diketahui</span>
            ) : (
              <>
                <span className={tile.unit ? "text-xl font-semibold tracking-tight text-foreground" : "block truncate text-base font-semibold text-foreground"} title={tile.unit ? undefined : tile.value}>
                  {tile.value}
                </span>
                {tile.unit ? <span className="ml-1 text-sm font-semibold text-muted-foreground">{tile.unit}</span> : null}
                {tile.note ? <span className="block truncate text-xs text-muted-foreground">{tile.note}</span> : null}
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
