"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PreviewState } from "@/lib/import/batch-actions";
import { cn } from "@/lib/utils";

type Action = "create" | "update" | "unchanged" | "skip";

export type ReviewItem = {
  id: string;
  entity: "product" | "offer";
  action: Action;
  label: string;
  reason: string | null;
  view: Record<string, unknown>;
  changes: { field: string; before: string | null; after: string | null }[];
  /** Diisi setelah batch diantrekan. */
  selected?: boolean;
  result?: "pending" | "done" | "failed" | "skipped" | null;
  resultAction?: "created" | "updated" | "unchanged" | null;
  resultMessage?: string | null;
};

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

const ACTION_LABEL: Record<Action, string> = {
  create: "Baru",
  update: "Berubah",
  unchanged: "Sama",
  skip: "Dilewati",
};

const ACTION_TONE: Record<Action, string> = {
  create: "bg-success-muted text-success",
  update: "bg-brand-muted text-brand",
  unchanged: "bg-muted text-muted-foreground",
  skip: "bg-warning-muted text-warning",
};

const FILTERS: (Action | "all")[] = ["all", "create", "update", "unchanged", "skip"];

function text(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  return String(value);
}

function ItemDetail({ item, prices }: { item: ReviewItem; prices?: string[] }) {
  const v = item.view;
  const facts =
    item.entity === "product"
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
          text(v.photos),
        ];
  const shown = facts.filter((fact): fact is string => Boolean(fact));

  return (
    <div className="min-w-0 space-y-2">
      {shown.length > 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{shown.join(" · ")}</p>
      ) : null}
      {item.entity === "offer" && text(v.url) ? (
        <a
          href={String(v.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-xs text-brand underline underline-offset-2"
        >
          {String(v.url)}
        </a>
      ) : null}
      {prices && prices.length > 0 ? (
        <p className="text-xs text-foreground">
          <span className="font-semibold">Harga resmi:</span> {prices.join(" · ")}
        </p>
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

/**
 * Tabel tinjauan batch. Semua baris dirender; filter hanya menyembunyikan
 * tampilan, sedangkan pilihan disimpan di state dan dikirim sebagai input
 * tersembunyi, jadi baris yang sedang tidak terlihat tetap ikut diterapkan.
 */
export function BatchReview({
  items,
  priceNotes = {},
  editable,
  applyAction,
}: {
  items: ReviewItem[];
  /** Harga resmi per kunci sumber produk (tarik otomatis). */
  priceNotes?: Record<string, string[]>;
  editable: boolean;
  applyAction: (state: PreviewState, formData: FormData) => Promise<PreviewState>;
}) {
  const [filter, setFilter] = useState<Action | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.filter((item) => item.action === "create" || item.action === "update").map((item) => item.id))
  );
  const [state, formAction, pending] = useActionState(applyAction, { error: null });

  const counts = useMemo(() => {
    const result: Record<Action | "all", number> = { all: items.length, create: 0, update: 0, unchanged: 0, skip: 0 };
    for (const item of items) result[item.action] += 1;
    return result;
  }, [items]);
  const visible = filter === "all" ? items : items.filter((item) => item.action === filter);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectWhere = (predicate: (item: ReviewItem) => boolean) =>
    setSelected(new Set(items.filter((item) => item.action !== "skip" && predicate(item)).map((item) => item.id)));

  return (
    <form action={formAction} className="space-y-4">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="item" value={id} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Saring menurut status" className="flex flex-wrap gap-2">
          {FILTERS.map((value) => (
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
              {value === "all" ? "Semua" : ACTION_LABEL[value]}
              <span className="tabular text-xs opacity-80">{counts[value]}</span>
            </button>
          ))}
        </div>
        {editable ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => selectWhere((item) => item.action === "create" || item.action === "update")}
            >
              Pilih baru & berubah
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSelected(new Set())}>
              Kosongkan
            </Button>
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Tidak ada baris dengan status ini.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {visible.map((item) => {
            const selectable = editable && item.action !== "skip";
            const checked = selected.has(item.id);
            return (
              <li
                key={item.id}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 p-4 sm:grid-cols-[auto_6.5rem_minmax(0,1fr)]",
                  checked && selectable && "bg-brand-muted/25"
                )}
              >
                <div className="row-span-2 flex items-start pt-0.5 sm:row-span-1">
                  {selectable ? (
                    <label className="-m-2.5 flex size-11 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item.id)}
                        className="size-4 accent-[var(--brand)]"
                        aria-label={`Terapkan ${item.label}`}
                      />
                    </label>
                  ) : (
                    <span className="block size-6" aria-hidden="true" />
                  )}
                </div>
                <div className="sm:pt-0.5">
                  <span
                    className={cn(
                      "inline-flex rounded-pill px-2.5 py-0.5 text-xs font-semibold",
                      ACTION_TONE[item.action]
                    )}
                  >
                    {ACTION_LABEL[item.action]}
                  </span>
                </div>
                <div className="col-start-2 min-w-0 space-y-1.5 sm:col-start-3 sm:row-start-1">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  {editable ? null : <ItemResultNote item={item} />}
                  <ItemDetail item={item} prices={priceNotes[String(item.view.sourceKey ?? "")]} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editable ? (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <p className="text-sm text-foreground">
            <span className="font-bold tabular">{selected.size}</span> baris dipilih untuk ditulis ke
            katalog. Baris lain tidak disentuh.
          </p>
          <div className="flex items-center gap-3">
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
      ) : null}
    </form>
  );
}
