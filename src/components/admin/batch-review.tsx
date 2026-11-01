"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PreviewState } from "@/lib/import/batch-actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  countByStatus,
  groupReviewItems,
  REVIEW_STATUS_ORDER,
  reviewStatus,
  selectedByDefault,
  type ReviewItem,
  type ReviewStatus,
} from "@/lib/import/review-groups";


const RESULT_LABEL = {
  pending: "Menunggu",
  done: "Berhasil",
  failed: "Gagal",
  skipped: "Dilewati saat diterapkan",
} as const;

const RESULT_TONE = {
  pending: "bg-muted text-muted-foreground",
  done: "bg-success-muted text-success",
  failed: "bg-destructive/10 text-destructive",
  skipped: "bg-warning-muted text-warning",
} as const;

const RESULT_ACTION_LABEL = { created: "dibuat", updated: "diperbarui", unchanged: "tanpa perubahan" } as const;

/** Hasil penerapan satu baris; menandai bila aksinya berbeda dari pratinjau. */
function ItemResultNote({ item }: { item: ReviewItem }) {
  if (!item.result) {
    return item.selected === false && item.action !== "skip" ? (
      <p className="text-xs text-muted-foreground">Tidak dipilih untuk diterapkan.</p>
    ) : null;
  }
  const expected = item.action === "create" ? "created" : item.action === "update" ? "updated" : null;
  const drifted = item.result === "done" && expected && item.resultAction && item.resultAction !== expected;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className={cn("inline-flex rounded-pill px-2.5 py-0.5 font-semibold", RESULT_TONE[item.result])}>
        {RESULT_LABEL[item.result]}
        {item.result === "done" && item.resultAction ? ` · ${RESULT_ACTION_LABEL[item.resultAction]}` : ""}
      </span>
      {drifted ? (
        <span className="text-warning">Berbeda dari pratinjau karena data katalog berubah sejak pratinjau dibuat.</span>
      ) : null}
      {item.resultMessage ? <span className="text-foreground">{item.resultMessage}</span> : null}
    </div>
  );
}

function text(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  return String(value);
}

function ItemDetail({ item }: { item: ReviewItem }) {
  const v = item.view;
  const facts =
    item.entity === "photo"
      ? [
          text(v.color) && `Warna ${text(v.color)}`,
          v.newColor ? "Warna baru (belum di spesifikasi)" : null,
          v.cover ? "Sampul warna ini" : null,
          text(v.source) ? "Ada tautan sumber" : null,
        ]
      : item.entity === "product"
      ? [
          text(v.slug) && `Slug ${text(v.slug)}`,
          text(v.variants) && `Varian ${text(v.variants)}`,
          text(v.chipset),
          text(v.releaseYear) && `Rilis ${text(v.releaseYear)}`,
          text(v.photo) && `Foto: ${text(v.photo)}`,
        ]
      : [
          [text(v.store) ?? text(v.marketplace), text(v.seller)].filter(Boolean).join(" · "),
          text(v.price),
          text(v.status),
          text(v.colors) && `Warna: ${text(v.colors)}`,
          text(v.merged),
          text(v.photos),
        ];
  const shown = facts.filter((fact): fact is string => Boolean(fact));

  return (
    <div className="min-w-0 space-y-2">
      {shown.length > 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{shown.join(" · ")}</p>
      ) : null}
      {item.entity !== "product" && text(v.url) ? (
        <a
          href={String(v.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="block min-h-11 truncate py-3 text-xs leading-5 text-brand underline underline-offset-2"
        >
          {String(v.url)}
        </a>
      ) : null}
      {item.reason ? (
        <p className="rounded-md bg-warning-muted px-2.5 py-1.5 text-xs text-foreground">{item.reason}</p>
      ) : null}
      {item.changes.length > 0 ? (
        <dl className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
          {item.changes.map((change) => (
            <div key={change.field} className="contents">
              <dt className="font-medium text-foreground">{change.field}</dt>
              <dd className="min-w-0 text-muted-foreground">
                <span className="line-through decoration-muted-foreground/60">
                  {change.before ?? "kosong"}
                </span>
                <span aria-hidden="true"> → </span>
                <span className="sr-only"> menjadi </span>
                <span className="font-semibold text-foreground">{change.after ?? "kosong"}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  create: "Baru",
  update: "Perbarui",
  stale: "Harga lama",
  review: "Perlu tinjau",
  unchanged: "Sama",
  skip: "Dilewati",
};

const STATUS_BADGE: Record<ReviewStatus, "success" | "brand" | "muted" | "warning" | "destructive"> = {
  create: "success",
  update: "brand",
  stale: "muted",
  review: "warning",
  unchanged: "muted",
  skip: "destructive",
};

const STATUS_HINT: Partial<Record<ReviewStatus, string>> = {
  stale: "Harga yang lebih tua dari harga terakhir: masuk riwayat, harga yang tampil tidak berubah.",
  review: "Varian disimpulkan dari judul, atau data terhapus akan dipulihkan. Tidak dicentang otomatis.",
};

/**
 * Pratinjau batch per produk (langkah 5 rancangan impor terpadu).
 *
 * Semua baris tetap dirender di state; tab hanya menyaring tampilan, dan
 * pilihan dikirim sebagai input tersembunyi, jadi baris yang sedang tidak
 * terlihat tetap ikut diterapkan. "Perlu tinjau" tidak dicentang otomatis.
 *
 * Batch CSV gabungan yang membawa tahap lanjutan (penawaran dan/atau foto)
 * punya dua mode: tahap ini + lanjutan (bawaan) atau tahap ini saja. Batch
 * spesifikasi juga punya mode "harga saja" untuk produk yang sudah ada.
 */
export function BatchReview({
  items,
  priceNotes = {},
  editable,
  applyAction,
  followUpCount = 0,
  followUpPhotoCount = 0,
  stageLabel = "Spesifikasi",
  pricesOnlyAction,
}: {
  items: ReviewItem[];
  /** Harga per kunci sumber produk (penawaran lanjutan batch spesifikasi). */
  priceNotes?: Record<string, string[]>;
  editable: boolean;
  applyAction: (state: PreviewState, formData: FormData) => Promise<PreviewState>;
  /** Jumlah penawaran lanjutan; >0 menampilkan pilihan mode penerapan. */
  followUpCount?: number;
  /** Jumlah foto lanjutan (CSV gabungan); >0 juga menampilkan pilihan mode. */
  followUpPhotoCount?: number;
  /** Nama tahap batch ini di pilihan mode, mis. "Spesifikasi" atau "Penawaran". */
  stageLabel?: string;
  pricesOnlyAction?: () => Promise<PreviewState>;
}) {
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.filter(selectedByDefault).map((item) => item.id))
  );
  const [mode, setMode] = useState<"all" | "specs-only">("all");
  const [state, formAction, pending] = useActionState(applyAction, { error: null });
  const [pricesState, pricesOnly, pricesPending] = useActionState(
    async () => (pricesOnlyAction ? pricesOnlyAction() : { error: null }),
    { error: null }
  );

  const counts = useMemo(() => countByStatus(items), [items]);
  const groups = useMemo(() => groupReviewItems(items), [items]);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      shown: filter === "all" ? group.items : group.items.filter((item) => reviewStatus(item) === filter),
    }))
    .filter((group) => group.shown.length > 0);

  const setMany = (ids: readonly string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="item" value={id} />
        ))}
        <input type="hidden" name="mode" value={mode} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Saring menurut status" className="flex flex-wrap gap-2">
            {(["all", ...REVIEW_STATUS_ORDER] as const)
              .filter((value) => value === "all" || counts[value] > 0)
              .map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-medium transition-colors",
                    filter === value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border-strong bg-card text-foreground hover:bg-muted"
                  )}
                >
                  {value === "all" ? "Semua" : STATUS_LABEL[value]}
                  <span className="tabular text-xs opacity-80">{counts[value]}</span>
                </button>
              ))}
          </div>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelected(new Set(items.filter(selectedByDefault).map((item) => item.id)))}
              >
                Pilih bawaan
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSelected(new Set())}>
                Kosongkan
              </Button>
            </div>
          ) : null}
        </div>

        {filter !== "all" && STATUS_HINT[filter] ? (
          <p className="text-sm text-muted-foreground">{STATUS_HINT[filter]}</p>
        ) : null}

        {visibleGroups.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Tidak ada baris dengan status ini.
          </p>
        ) : (
          <ul className="space-y-3">
            {visibleGroups.map((group) => {
              const selectable = group.shown.filter((item) => editable && item.action !== "skip").map((item) => item.id);
              const allOn = selectable.length > 0 && selectable.every((id) => selected.has(id));
              const prices = group.items.flatMap((item) => priceNotes[String(item.view.sourceKey ?? "")] ?? []);
              const statuses = [...new Set(group.items.map(reviewStatus))];
              return (
                <li key={group.key} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-muted/40 px-4 py-3">
                    {selectable.length > 0 ? (
                      <label className="-m-2.5 flex size-11 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={allOn}
                          onChange={() => setMany(selectable, !allOn)}
                          className="size-4 accent-[var(--brand)]"
                          aria-label={`Pilih semua baris ${group.title}`}
                        />
                      </label>
                    ) : null}
                    <h3 className="min-w-0 flex-1 text-sm font-bold text-foreground">{group.title}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {statuses.map((status) => (
                        <Badge key={status} variant={STATUS_BADGE[status]}>
                          {STATUS_LABEL[status]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ul className="divide-y divide-border">
                    {group.shown.map((item) => {
                      const canPick = editable && item.action !== "skip";
                      const checked = selected.has(item.id);
                      const status = reviewStatus(item);
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 p-4 sm:grid-cols-[auto_7rem_minmax(0,1fr)]",
                            checked && canPick && "bg-brand-muted/25"
                          )}
                        >
                          <div className="row-span-2 flex items-start pt-0.5 sm:row-span-1">
                            {canPick ? (
                              <label className="-m-2.5 flex size-11 cursor-pointer items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setMany([item.id], !checked)}
                                  className="size-4 accent-[var(--brand)]"
                                  aria-label={`Terapkan ${item.label}`}
                                />
                              </label>
                            ) : (
                              <span className="block size-6" aria-hidden="true" />
                            )}
                          </div>
                          <div className="sm:pt-0.5">
                            <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
                          </div>
                          <div className="col-start-2 min-w-0 space-y-1.5 sm:col-start-3 sm:row-start-1">
                            <p className="text-sm font-semibold text-foreground">
                              {item.entity !== "product" && item.view.variant ? String(item.view.variant) : item.label}
                            </p>
                            {editable ? null : <ItemResultNote item={item} />}
                            <ItemDetail item={item} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {prices.length > 0 ? (
                    <p className="border-t border-border px-4 py-3 text-xs text-foreground">
                      <span className="font-semibold">Harga yang menyusul setelah produk diterapkan:</span>{" "}
                      {prices.join(" · ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {editable ? (
          <div className="sticky bottom-0 z-10 -mx-4 space-y-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {followUpCount + followUpPhotoCount > 0 ? (
              <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <legend className="sr-only">Yang diterapkan</legend>
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="mode-choice"
                    checked={mode === "all"}
                    onChange={() => setMode("all")}
                    className="size-4 accent-[var(--brand)]"
                  />
                  {stageLabel} lalu{" "}
                  {[
                    followUpCount > 0 ? `${followUpCount} penawaran` : null,
                    followUpPhotoCount > 0 ? `${followUpPhotoCount} foto` : null,
                  ]
                    .filter(Boolean)
                    .join(" dan ")}{" "}
                  (ditinjau setelah tahap ini tersimpan)
                </label>
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="mode-choice"
                    checked={mode === "specs-only"}
                    onChange={() => setMode("specs-only")}
                    className="size-4 accent-[var(--brand)]"
                  />
                  {stageLabel} saja
                </label>
              </fieldset>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-foreground">
                <span className="font-bold tabular">{selected.size}</span> baris dipilih untuk ditulis ke katalog. Baris
                lain tidak disentuh.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {state.error ? (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {state.error}
                  </p>
                ) : null}
                <Button type="submit" disabled={pending || selected.size === 0}>
                  {pending ? "Menerapkan..." : `Terapkan ${selected.size} baris`}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </form>

      {editable && followUpCount > 0 && pricesOnlyAction ? (
        <form action={pricesOnly} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm">
          <p className="min-w-0 flex-1 text-muted-foreground">
            <span className="font-semibold text-foreground">Harga saja:</span> abaikan spesifikasi di berkas ini dan buat
            batch penawaran hanya untuk produk yang sudah ada di katalog. Batch ini dibatalkan.
          </p>
          {pricesState.error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {pricesState.error}
            </p>
          ) : null}
          <Button type="submit" variant="outline" disabled={pricesPending}>
            {pricesPending ? "Menyiapkan..." : "Terapkan harga saja"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
