"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/admin/actions";

/**
 * Form produk, dipakai halaman buat maupun sunting.
 *
 * Dua hal yang membedakannya dari form CMS biasa, dan keduanya berasal dari
 * PRD §6:
 *
 * - Hampir semua field spesifikasi boleh kosong. Kosong berarti "belum
 *   diketahui" dan akan tersimpan sebagai null, bukan nol. Admin tidak pernah
 *   dipaksa mengarang angka supaya bisa menyimpan.
 * - Pertanyaan ya/tidak punya tiga pilihan, karena "belum diketahui" adalah
 *   jawaban yang sah dan berbeda maknanya dari "tidak".
 */

const INITIAL: ActionState = { error: null };

/**
 * Nilai spesifikasi datang dari kolom JSONB, jadi bentuknya `unknown` sampai
 * dibaca. Helper di bawah yang menyempitkannya; tidak ada asumsi tipe di sini.
 */
type SpecValue = unknown;

export type ProductFormValues = {
  slug?: string;
  brand?: string;
  model?: string;
  specsSource?: string;
  specsSourceUrl?: string | null;
  sourceKey?: string | null;
  specs?: Record<string, SpecValue>;
};

function textOf(value: SpecValue): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return "";
  return String(value);
}

function boolOf(value: SpecValue): string {
  if (value === true) return "ya";
  if (value === false) return "tidak";
  return "";
}

function Field({
  name,
  label,
  hint,
  defaultValue,
  type = "text",
  required,
  step,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required ? null : (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            boleh kosong
          </span>
        )}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        required={required}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TriState({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="flex min-h-11 w-full rounded-lg border border-border-strong bg-card px-3 text-base text-foreground"
      >
        <option value="">Belum diketahui</option>
        <option value="ya">Ya</option>
        <option value="tidak">Tidak</option>
      </select>
    </div>
  );
}

export function ProductForm({
  action,
  values = {},
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values?: ProductFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const specs = values.specs ?? {};

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-bold text-foreground">Identitas</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field name="brand" label="Merek" defaultValue={values.brand} required />
          <Field name="model" label="Model" defaultValue={values.model} required />
          <Field
            name="slug"
            label="Slug"
            hint="Huruf kecil dan tanda hubung. Dipakai di alamat halaman produk."
            defaultValue={values.slug}
            required
          />
          <Field
            name="sourceKey"
            label="Kunci sumber"
            hint="Penanda stabil dari sumber data, mis. gsmarena:oppo_a6-14412. Mencegah impor ulang menggandakan produk."
            defaultValue={values.sourceKey ?? ""}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-bold text-foreground">Sumber spesifikasi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ditampilkan ke pengunjung di halaman detail, jadi tulis sumber yang
          benar-benar dipakai.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field
            name="specsSource"
            label="Nama sumber"
            defaultValue={values.specsSource ?? "GSMArena"}
            required
          />
          <Field
            name="specsSourceUrl"
            label="URL sumber"
            type="url"
            defaultValue={values.specsSourceUrl ?? ""}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-bold text-foreground">Spesifikasi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Biarkan kosong bila belum diverifikasi. Kolom kosong tampil sebagai
          &ldquo;Belum diketahui&rdquo;, bukan nol.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field name="specs.displayInches" label="Layar (inci)" type="number" step="0.01" defaultValue={textOf(specs.displayInches)} />
          <Field name="specs.displayTechnology" label="Teknologi layar" defaultValue={textOf(specs.displayTechnology)} />
          <Field name="specs.refreshRateHz" label="Refresh rate (Hz)" type="number" defaultValue={textOf(specs.refreshRateHz)} />
          <Field name="specs.chipset" label="Chipset" defaultValue={textOf(specs.chipset)} />
          <Field name="specs.batteryMah" label="Baterai (mAh)" type="number" defaultValue={textOf(specs.batteryMah)} />
          <Field name="specs.chargingWatt" label="Pengisian (W)" type="number" defaultValue={textOf(specs.chargingWatt)} />
          <Field name="specs.mainCameraMp" label="Kamera utama (MP)" type="number" defaultValue={textOf(specs.mainCameraMp)} />
          <Field name="specs.cameraLensCount" label="Jumlah lensa belakang" type="number" defaultValue={textOf(specs.cameraLensCount)} />
          <Field name="specs.cameraOpticalZoomX" label="Zoom optik (x)" type="number" step="0.1" defaultValue={textOf(specs.cameraOpticalZoomX)} />
          <Field name="specs.weightGrams" label="Bobot (gram)" type="number" defaultValue={textOf(specs.weightGrams)} />
          <Field name="specs.releaseYear" label="Tahun rilis" type="number" defaultValue={textOf(specs.releaseYear)} />
          <Field name="specs.ipRating" label="IP rating" hint="Mis. IP68" defaultValue={textOf(specs.ipRating)} />
          <Field name="specs.osVersion" label="Sistem operasi" defaultValue={textOf(specs.osVersion)} />
          <Field name="specs.colorOptions" label="Pilihan warna" hint="Pisahkan dengan koma." defaultValue={textOf(specs.colorOptions)} />
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <TriState name="specs.is5G" label="Dukung 5G" defaultValue={boolOf(specs.is5G)} />
          <TriState name="specs.hasNfc" label="Punya NFC" defaultValue={boolOf(specs.hasNfc)} />
          <TriState name="specs.has35mmJack" label="Jack 3.5mm" defaultValue={boolOf(specs.has35mmJack)} />
          <TriState name="specs.cameraHasUltrawide" label="Ada ultrawide" defaultValue={boolOf(specs.cameraHasUltrawide)} />
          <TriState name="specs.cameraHasTelephoto" label="Ada telefoto" defaultValue={boolOf(specs.cameraHasTelephoto)} />
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm font-medium text-success">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : submitLabel}
      </Button>
    </form>
  );
}
