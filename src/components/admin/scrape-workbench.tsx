"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIdr } from "@/lib/catalog/pricing";
import {
  IMAGE_BASIS_NEEDS_NOTE,
  IMAGE_USAGE_BASES,
  IMAGE_USAGE_BASIS_LABELS,
  isImageUsageBasis,
} from "@/lib/import/image-rights";
import {
  commitScrapeAction,
  loadLineupAction,
  resolveModelAction,
} from "@/lib/scrape/actions";
import { SPEC_COLUMNS, toCsv } from "@/lib/scrape/parsers";
import {
  BRANDS_WITH_OFFICIAL_PRICES,
  SCRAPE_BRAND_LABELS,
  SCRAPE_BRANDS,
  type CommitSummary,
  type LineupItem,
  type OfficialVariantPrice,
  type PreviewItem,
  type ScrapeBrand,
} from "@/lib/scrape/types";

/**
 * Meja kerja tarik data otomatis (admin).
 *
 * Alurnya sengaja bertahap dan terlihat, karena data dari situs orang lain
 * selalu bisa berubah bentuk tanpa pemberitahuan:
 *
 *   1. Muat daftar model + harga dari situs resmi merek.
 *   2. Admin memilih model, lalu spesifikasinya diambil SATU PER SATU dari
 *      GSMArena dengan progres yang bisa dihentikan.
 *   3. Pratinjau menampilkan setiap temuan (varian tak cocok, pasangan nama
 *      ragu, harga tak terbaca, model lama) sebelum apa pun disimpan.
 *   4. Yang dicentang disimpan sebagai DRAFT lewat jalur impor yang sama
 *      dengan unggahan CSV. Penerbitan tetap keputusan manual.
 */

type ResolveState =
  | { status: "ok"; item: PreviewItem }
  | { status: "error"; error: string };

const CURRENT_YEAR = new Date().getFullYear();

function variantLabel(ramGb: number, storageGb: number) {
  const storage = storageGb >= 1024 ? `${storageGb / 1024} TB` : `${storageGb} GB`;
  return `${ramGb}/${storage}`;
}

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ScrapeWorkbench() {
  const [brand, setBrand] = useState<ScrapeBrand>("vivo");
  const [lineup, setLineup] = useState<LineupItem[] | null>(null);
  const [lineupError, setLineupError] = useState<string | null>(null);
  const [loadingLineup, setLoadingLineup] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [results, setResults] = useState<Map<string, ResolveState>>(new Map());
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const stopRef = useRef(false);

  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [minYear, setMinYear] = useState(CURRENT_YEAR - 1);
  const [usageRights, setUsageRights] = useState("");
  const [usageBasis, setUsageBasis] = useState("");
  const [assignments, setAssignments] = useState<Map<string, Record<number, string>>>(new Map());
  const router = useRouter();
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitSummary | null>(null);

  const running = progress !== null;

  const visibleLineup = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (lineup ?? []).filter((item) => !needle || item.officialName.toLowerCase().includes(needle));
  }, [lineup, filter]);

  const previews = useMemo(
    () =>
      [...results.entries()]
        .map(([id, state]) => ({ id, state }))
        .sort((a, b) => (lineup ?? []).findIndex((l) => l.officialId === a.id) - (lineup ?? []).findIndex((l) => l.officialId === b.id)),
    [results, lineup]
  );

  // Dua model resmi yang dipasangkan ke halaman GSMArena yang sama hampir
  // pasti salah pasang, jadi ditandai.
  const duplicatePaths = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { state } of previews) {
      if (state.status === "ok" && state.item.gsmarena) {
        counts.set(state.item.gsmarena.path, (counts.get(state.item.gsmarena.path) ?? 0) + 1);
      }
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([path]) => path));
  }, [previews]);

  function canInclude(state: ResolveState | undefined): state is { status: "ok"; item: PreviewItem } {
    return (
      state?.status === "ok" &&
      state.item.specRow !== null &&
      !state.item.issues.some((issue) => issue.level === "error")
    );
  }

  async function loadLineup() {
    setLoadingLineup(true);
    setLineupError(null);
    setLineup(null);
    setSelected(new Set());
    setResults(new Map());
    setAssignments(new Map());
    setIncluded(new Set());
    setCommitResult(null);
    setBlockedMessage(null);
    const result = await loadLineupAction(brand);
    setLoadingLineup(false);
    if (result.ok) setLineup(result.items);
    else setLineupError(result.error);
  }

  async function resolveOne(item: LineupItem, pathOverride?: string) {
    const result = await resolveModelAction({ lineup: item, pathOverride });
    setResults((previous) => {
      const next = new Map(previous);
      next.set(item.officialId, result.ok ? { status: "ok", item: result.item } : { status: "error", error: result.error });
      return next;
    });
    if (result.ok) {
      const state: ResolveState = { status: "ok", item: result.item };
      const year = result.item.summary?.releaseYear ?? null;
      setIncluded((previous) => {
        const next = new Set(previous);
        if (canInclude(state) && (year === null || year >= minYear)) next.add(item.officialId);
        else next.delete(item.officialId);
        return next;
      });
    }
    return result;
  }

  async function resolveSelected() {
    const queue = (lineup ?? []).filter((item) => selected.has(item.officialId));
    if (queue.length === 0) return;
    stopRef.current = false;
    setBlockedMessage(null);
    setCommitResult(null);

    for (let index = 0; index < queue.length; index += 1) {
      if (stopRef.current) break;
      const item = queue[index];
      setProgress({ done: index, total: queue.length, current: item.officialName });
      const result = await resolveOne(item);
      if (!result.ok && result.blocked) {
        // Situs sumber meminta verifikasi anti-bot: berhenti, jangan dipaksa.
        setBlockedMessage(result.error);
        break;
      }
    }
    setProgress(null);
  }

  /**
   * Situs Infinix hanya menyebut "harga mulai" tanpa varian. Variannya
   * ditentukan admin, bukan ditebak sistem: selama belum dipilih, harga itu
   * tidak ikut disimpan. Pilihan disimpan terpisah supaya tetap bisa diubah.
   */
  function setAssignment(id: string, priceIndex: number, variantKey: string) {
    setAssignments((previous) => {
      const next = new Map(previous);
      next.set(id, { ...(next.get(id) ?? {}), [priceIndex]: variantKey });
      return next;
    });
  }

  /** Daftar harga final satu model: harga per varian + harga mulai yang sudah dipilih variannya. */
  function assignedPrices(id: string, item: PreviewItem): OfficialVariantPrice[] {
    const chosen = assignments.get(id) ?? {};
    const extra = item.lineup.unassignedPrices.flatMap((price, index) => {
      const key = chosen[index];
      if (!key) return [];
      const [ramGb, storageGb] = key.split("+").map(Number);
      return [{ ...price, ramGb, storageGb }];
    });
    return [...item.lineup.prices, ...extra];
  }

  function applyYearFilter(year: number) {
    setMinYear(year);
    setIncluded(() => {
      const next = new Set<string>();
      for (const { id, state } of previews) {
        if (!canInclude(state)) continue;
        const release = state.item.summary?.releaseYear ?? null;
        if (release === null || release >= year) next.add(id);
      }
      return next;
    });
  }

  async function commit() {
    const items = previews
      .filter(({ id, state }) => included.has(id) && canInclude(state))
      .map(({ id, state }) => {
        const item = (state as { status: "ok"; item: PreviewItem }).item;
        return {
          lineup: { ...item.lineup, prices: assignedPrices(id, item), unassignedPrices: [] },
          specRow: item.specRow!,
        };
      });
    if (items.length === 0) return;
    setCommitting(true);
    setCommitResult(null);
    const summary = await commitScrapeAction({ items, imageUsageRights: usageRights, imageUsageBasis: usageBasis });
    if (summary.batchId) {
      // Hasil tarik otomatis ditinjau di Pusat Impor sebelum menyentuh katalog.
      router.push(`/admin/import/batch/${summary.batchId}`);
      return;
    }
    setCommitting(false);
    setCommitResult(summary);
  }

  function exportCsv() {
    const rows = previews
      .filter(({ id, state }) => included.has(id) && canInclude(state))
      .map(({ state }) => (state as { status: "ok"; item: PreviewItem }).item.specRow!);
    if (rows.length > 0) downloadCsv(`gsmarena-${brand}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(SPEC_COLUMNS, rows));
  }

  const includedCount = previews.filter(({ id, state }) => included.has(id) && canInclude(state)).length;
  const includedPriceCount = previews
    .filter(({ id, state }) => included.has(id) && canInclude(state))
    .reduce((sum, { id, state }) => sum + assignedPrices(id, (state as { status: "ok"; item: PreviewItem }).item).length, 0);

  return (
    <div className="space-y-6">
      {/* Tahap 1 */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-bold text-foreground">1. Muat daftar model</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          vivo, iQOO, OPPO, Samsung, dan Xiaomi: daftar dan harga per varian dari situs resmi. Apple: daftar dan harga dari Digimap (dicatat sebagai penjual Digimap). Infinix: situs resminya hanya menyebut harga mulai tanpa varian, jadi variannya dipilih di pratinjau. itel dan Motorola tidak menampilkan harga online, jadi daftarnya diambil dari model terbaru di GSMArena dan harganya diisi lewat impor CSV penawaran.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-72">
            <Label htmlFor="scrape-brand">Merek</Label>
            <select
              id="scrape-brand"
              value={brand}
              onChange={(event) => setBrand(event.target.value as ScrapeBrand)}
              disabled={loadingLineup || running}
              className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-4 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {SCRAPE_BRANDS.map((option) => (
                <option key={option} value={option}>
                  {SCRAPE_BRAND_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={loadLineup} disabled={loadingLineup || running}>
            {loadingLineup ? "Memuat daftar..." : "Muat daftar model"}
          </Button>
        </div>
        {lineupError ? (
          <p role="alert" className="mt-4 text-sm font-medium text-destructive">{lineupError}</p>
        ) : null}
      </section>

      {/* Tahap 2 */}
      {lineup ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">2. Pilih model yang diambil spesifikasinya</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {BRANDS_WITH_OFFICIAL_PRICES.includes(lineup[0]?.brand ?? brand)
              ? `${lineup.length} model ponsel di situs resmi (aksesori tidak ditampilkan). Situs resmi bisa memuat model lama; tahun rilis baru diketahui setelah spesifikasi diambil.`
              : `${lineup.length} model terbaru di GSMArena (tablet dan jam tangan tidak ditampilkan). Tahun rilis baru diketahui setelah spesifikasi diambil.`}
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="scrape-filter">Saring nama</Label>
              <Input id="scrape-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Contoh: Y, X300, iQOO 15" className="mt-2" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelected(new Set([...selected, ...visibleLineup.map((item) => item.officialId)]))}
              disabled={running}
            >
              Pilih yang tampil
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSelected(new Set())} disabled={running}>
              Kosongkan
            </Button>
          </div>

          <ul className="mt-4 grid max-h-96 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleLineup.map((item) => (
              <li key={item.officialId}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-foreground hover:bg-muted/40">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-brand"
                    checked={selected.has(item.officialId)}
                    disabled={running}
                    onChange={(event) => {
                      const next = new Set(selected);
                      if (event.target.checked) next.add(item.officialId);
                      else next.delete(item.officialId);
                      setSelected(next);
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.officialName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <LineupPriceLabel item={item} />
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={resolveSelected} disabled={running || selected.size === 0}>
              {`Ambil spesifikasi ${selected.size} model`}
            </Button>
            {running ? (
              <Button type="button" variant="outline" onClick={() => (stopRef.current = true)}>
                Hentikan
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">
              GSMArena diakses pelan (jeda 3 detik per halaman) supaya tidak membebani situsnya.
            </p>
          </div>

          <div role="status" aria-live="polite" className="mt-3 text-sm">
            {progress ? (
              <p className="text-foreground">
                Mengambil {progress.done + 1} dari {progress.total}: {progress.current}
              </p>
            ) : null}
            {blockedMessage ? <p className="font-medium text-destructive">{blockedMessage}</p> : null}
          </div>
        </section>
      ) : null}

      {/* Tahap 3 */}
      {previews.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">3. Pratinjau dan temuan</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-56">
              <Label htmlFor="scrape-year">Centang otomatis rilis sejak</Label>
              <Input
                id="scrape-year"
                type="number"
                min={2015}
                max={CURRENT_YEAR + 1}
                value={minYear}
                onChange={(event) => applyYearFilter(Number(event.target.value) || CURRENT_YEAR - 1)}
                className="mt-2"
              />
            </div>
            <p className="text-xs text-muted-foreground sm:pb-3">
              Model dengan temuan merah tidak bisa disimpan. Temuan kuning boleh disimpan setelah dicek.
            </p>
          </div>

          <ul className="mt-5 space-y-3">
            {previews.map(({ id, state }) => {
              const lineupItem = (lineup ?? []).find((item) => item.officialId === id);
              if (state.status === "error") {
                return (
                  <li key={id} className="rounded-lg border border-destructive/40 p-4 text-sm">
                    <p className="font-semibold text-foreground">{lineupItem?.officialName}</p>
                    <p className="mt-1 text-destructive">{state.error}</p>
                    {lineupItem ? (
                      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => resolveOne(lineupItem)} disabled={running}>
                        Coba lagi
                      </Button>
                    ) : null}
                  </li>
                );
              }

              const { item } = state;
              const includable = canInclude(state);
              const duplicate = item.gsmarena ? duplicatePaths.has(item.gsmarena.path) : false;
              return (
                <li key={id} className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <label className="flex min-h-11 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-brand"
                        checked={included.has(id) && includable}
                        disabled={!includable || committing}
                        onChange={(event) => {
                          const next = new Set(included);
                          if (event.target.checked) next.add(id);
                          else next.delete(id);
                          setIncluded(next);
                        }}
                      />
                      <span>
                        <span className="block font-semibold text-foreground">
                          {item.lineup.officialName}
                          {item.summary ? <span className="font-normal text-muted-foreground">{` → ${item.summary.brand} ${item.summary.model}`}</span> : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {item.summary
                            ? [
                                item.summary.releaseYear ? `Rilis ${item.summary.releaseYear}` : "Tahun rilis tidak diketahui",
                                /5G/.test(item.summary.network) ? "5G" : "4G",
                                item.summary.chipset,
                                item.summary.displayInches ? `${item.summary.displayInches}"` : null,
                                item.summary.batteryMah ? `${item.summary.batteryMah} mAh` : null,
                              ]
                                .filter(Boolean)
                                .join(", ")
                            : "Spesifikasi tidak tersedia"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {item.catalog.status === "new"
                            ? "Produk baru, akan dibuat sebagai draft"
                            : `Sudah ada di katalog (${item.catalog.status === "published" ? "terbit" : "draft"}, ${item.catalog.slug}); data spesifikasi diperbarui, status tidak diubah`}
                        </span>
                      </span>
                    </label>

                    {item.gsmarena && lineupItem && item.alternatives.length > 0 ? (
                      <div className="w-full sm:w-64">
                        <Label htmlFor={`alt-${id}`} className="text-xs font-normal text-muted-foreground">Halaman GSMArena</Label>
                        <select
                          id={`alt-${id}`}
                          value={item.gsmarena.path}
                          disabled={running}
                          onChange={(event) => resolveOne(lineupItem, event.target.value)}
                          className="mt-1 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground"
                        >
                          {[item.gsmarena, ...item.alternatives].map((candidate) => (
                            <option key={candidate.path} value={candidate.path}>{candidate.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>

                  {item.summary ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.summary.variants.map((variant) => {
                        const price = assignedPrices(id, item).find((p) => p.ramGb === variant.ramGb && p.storageGb === variant.storageGb);
                        return (
                          <span key={`${variant.ramGb}-${variant.storageGb}`} className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
                            {variantLabel(variant.ramGb, variant.storageGb)}
                            {price
                              ? ` · ${formatIdr(price.priceIdr)}${price.isPromotion ? " (promo)" : ""}${price.inStock === false ? " (stok habis, tidak jadi harga aktif)" : ""}`
                              : " · tanpa harga"}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}

                  {item.summary && item.lineup.unassignedPrices.length > 0 ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-warning/40 p-3">
                      {item.lineup.unassignedPrices.map((price, priceIndex) => (
                        <div key={`${price.priceIdr}-${priceIndex}`} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-foreground">
                            Harga mulai {formatIdr(price.priceIdr)} tanpa keterangan varian. Varian:
                          </span>
                          <select
                            aria-label={`Varian untuk harga ${formatIdr(price.priceIdr)}`}
                            value={assignments.get(id)?.[priceIndex] ?? ""}
                            disabled={committing}
                            onChange={(event) => setAssignment(id, priceIndex, event.target.value)}
                            className="h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
                          >
                            <option value="">Belum dipilih, harga dilewati</option>
                            {item.summary!.variants.map((variant) => (
                              <option key={`${variant.ramGb}+${variant.storageGb}`} value={`${variant.ramGb}+${variant.storageGb}`}>
                                {variantLabel(variant.ramGb, variant.storageGb)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {duplicate ? (
                    <p className="mt-2 text-xs font-medium text-warning">
                      Model resmi lain juga dipasangkan ke halaman GSMArena ini. Pilih halaman yang benar atau lepas salah satunya.
                    </p>
                  ) : null}
                  {item.issues.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {item.issues.map((issue) => (
                        <li key={issue.message} className={`text-xs ${issue.level === "error" ? "font-medium text-destructive" : "text-warning"}`}>
                          {issue.level === "error" ? "Galat: " : "Cek: "}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.gsmarena ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Sumber:{" "}
                      <a href={`https://www.gsmarena.com/${item.gsmarena.path}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">GSMArena</a>
                      {item.lineup.officialUrl ? (
                        <>
                          {" dan "}
                          <a href={item.lineup.officialUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">situs resmi</a>
                        </>
                      ) : (
                        " (merek ini tanpa harga di situs resmi; isi harga lewat impor CSV penawaran)"
                      )}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {/* Tahap 4 */}
          <div className="mt-6 space-y-2 rounded-xl border border-border bg-muted/30 p-4">
            <Label htmlFor="scrape-usage-basis">Dasar hak pakai foto (opsional)</Label>
            <select
              id="scrape-usage-basis"
              value={usageBasis}
              onChange={(event) => setUsageBasis(event.target.value)}
              className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Lewati foto (hanya data)</option>
              {IMAGE_USAGE_BASES.map((value) => (
                <option key={value} value={value}>
                  {IMAGE_USAGE_BASIS_LABELS[value]}
                </option>
              ))}
            </select>
            {usageBasis ? (
              <>
                <Label htmlFor="scrape-usage-rights">
                  {isImageUsageBasis(usageBasis) && IMAGE_BASIS_NEEDS_NOTE.has(usageBasis)
                    ? "Bukti hak pakai (wajib)"
                    : "Keterangan (opsional)"}
                </Label>
                <Input
                  id="scrape-usage-rights"
                  value={usageRights}
                  maxLength={500}
                  onChange={(event) => setUsageRights(event.target.value)}
                  placeholder="Contoh: Izin email pemilik foto, 2026-09-20 / CC BY 4.0"
                />
              </>
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Sama seperti impor CSV: tanpa dasar hak pakai, spesifikasi dan harga tetap masuk, tetapi foto dari GSMArena dilewati.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={commit} disabled={committing || running || includedCount === 0}>
              {committing ? "Menyiapkan pratinjau..." : `Kirim ${includedCount} model ke Pusat Impor`}
            </Button>
            <Button type="button" variant="outline" onClick={exportCsv} disabled={includedCount === 0}>
              Unduh CSV
            </Button>
            <p className="text-xs text-muted-foreground">
              {includedPriceCount} harga resmi per varian ikut dikirim. Belum ada yang ditulis ke katalog sebelum kamu menerapkannya di Pusat Impor; produk baru tetap draft.
            </p>
          </div>

          {commitResult ? <CommitReport summary={commitResult} /> : null}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Ringkasan harga satu model di daftar. Harga yang RAM-nya belum disebut situs
 * resmi (Samsung menulis "512 GB" saja) tetap dihitung: pasangannya baru
 * ditentukan setelah varian GSMArena terbaca, jadi jangan ditampilkan seolah
 * harganya tidak ada.
 */
function LineupPriceLabel({ item }: { item: LineupItem }) {
  const all = [...item.prices, ...item.storageOnlyPrices, ...item.unassignedPrices];
  if (!item.officialUrl && all.length === 0) return <>Harga diisi lewat impor CSV penawaran</>;
  if (all.length === 0) return <>Situs resmi tidak menampilkan harga saat ini</>;
  const lowest = formatIdr(Math.min(...all.map((price) => price.priceIdr)));
  return item.storageOnlyPrices.length > 0 ? (
    <>{`${all.length} harga, mulai ${lowest} (RAM dipasangkan setelah spesifikasi diambil)`}</>
  ) : (
    <>{`${all.length} harga varian, mulai ${lowest}`}</>
  );
}

function CommitReport({ summary }: { summary: CommitSummary }) {
  return (
    <div role="status" className="mt-5 rounded-xl border border-border p-5 text-sm">
      {summary.error ? <p className="font-medium text-destructive">{summary.error}</p> : null}
      {summary.specs ? (
        <div>
          <h3 className="font-bold text-foreground">Spesifikasi</h3>
          <p className="mt-1 text-muted-foreground">
            {summary.specs.created} produk baru, {summary.specs.updated} diperbarui, {summary.specs.imagesCreated + summary.specs.imagesUpdated} foto tersimpan, {summary.specs.skipped.length} dilewati.
          </p>
          <IssueList items={[...summary.specs.skipped, ...summary.specs.imageSkipped]} />
        </div>
      ) : null}
      {summary.prices ? (
        <div className="mt-4">
          <h3 className="font-bold text-foreground">Harga resmi</h3>
          <p className="mt-1 text-muted-foreground">
            {summary.prices.pricesRecorded} harga tercatat, {summary.prices.duplicatePrices} sudah pernah tercatat, {summary.prices.created} penawaran baru, {summary.prices.skipped.length} dilewati.
          </p>
          <IssueList items={summary.prices.skipped} />
        </div>
      ) : null}
    </div>
  );
}

function IssueList({ items }: { items: { label: string; reason: string }[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="text-xs text-warning">
          {item.label}: {item.reason}
        </li>
      ))}
    </ul>
  );
}
