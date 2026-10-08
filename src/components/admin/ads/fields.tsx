import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NavTabs } from "@/components/ui/nav-tabs";
import { cn } from "@/lib/utils";

/**
 * Elemen tampilan admin iklan tanpa state (aman dirender server dan dipakai
 * sebagai children <ActionForm>). Semua kontrol bertinggi ≥44 px (PRD §8).
 * `scope` membuat id label unik bila satu halaman memuat beberapa form sejenis.
 */

const CONTROL =
  "flex min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Field({
  name,
  label,
  hint,
  className,
  scope,
  ...props
}: { name: string; label: string; hint?: string; className?: string; scope?: string } & Omit<
  React.ComponentProps<"input">,
  "name" | "className" | "id"
>) {
  const id = `f-${scope ?? "x"}-${name}`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {props.required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input {...props} id={id} name={name} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  hint,
  className,
  required,
  scope,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
  className?: string;
  required?: boolean;
  scope?: string;
}) {
  const id = `f-${scope ?? "x"}-${name}`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={name} defaultValue={defaultValue} required={required} className={CONTROL}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextArea({
  name,
  label,
  defaultValue,
  rows = 3,
  hint,
  className,
  required,
  maxLength,
  scope,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  rows?: number;
  hint?: string;
  className?: string;
  required?: boolean;
  maxLength?: number;
  scope?: string;
}) {
  const id = `f-${scope ?? "x"}-${name}`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        required={required}
        maxLength={maxLength}
        className={cn(CONTROL, "py-2")}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: ReactNode;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
      />
      <span className="text-sm leading-snug text-foreground">
        {label}
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Panel({
  title,
  description,
  children,
  className,
  actions,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          {description ? <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Nada Pill lama dipetakan ke varian Badge bertoken (kontras teruji). */
const TONE = {
  neutral: "muted",
  good: "brand",
  warn: "warning",
  bad: "destructive",
} as const;

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof TONE; children: ReactNode }) {
  return <Badge variant={TONE[tone]}>{children}</Badge>;
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "warn"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        tone === "warn" ? "border-accent-warm/40 bg-accent-warm-soft text-foreground" : "border-border bg-muted/40 text-muted-foreground"
      )}
    >
      {children}
    </p>
  );
}

const NAV = [
  { href: "/admin/iklan", label: "Ringkasan" },
  { href: "/admin/iklan/advertiser", label: "Advertiser & PKS" },
  { href: "/admin/iklan/review", label: "Review materi" },
  { href: "/admin/iklan/laporan", label: "Laporan" },
  { href: "/admin/iklan/slot", label: "Slot & rate card" },
  { href: "/admin/iklan/pengaturan", label: "Pengaturan" },
] as const;

/** Sub-navigasi modul iklan. `current` = href halaman aktif. */
export function AdsNav({ current, pendingReview }: { current: string; pendingReview?: number }) {
  return (
    <NavTabs
      label="Menu iklan"
      items={NAV.map((item) => ({
        href: item.href,
        label: item.label,
        active: item.href === current,
        // accent-warm hanya untuk ilustrasi (globals.css), jadi hitungan
        // memakai Badge warning yang kontrasnya teruji.
        count:
          item.href === "/admin/iklan/review" && pendingReview ? (
            <Badge variant="warning" aria-label={`${pendingReview} menunggu review`}>
              {pendingReview}
            </Badge>
          ) : undefined,
      }))}
    />
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-2 max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Tabel sederhana dengan gulir horizontal di layar sempit. */
export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-3 py-2 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
      {empty ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">{empty}</p> : null}
    </div>
  );
}

export const td = "px-3 py-3 align-top";
