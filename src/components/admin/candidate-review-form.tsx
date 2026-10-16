"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/admin/actions";

const INITIAL: ActionState = { error: null };

const FIELD = "min-h-11 w-full rounded-lg border border-border-strong bg-card px-3 py-2 text-base text-foreground";

/**
 * Formulir ringkasan dari kandidat video (PB-40). Admin menulis ulang temuan
 * reviewer dengan kalimat sendiri; channel, tautan, dan tanggal diisi sistem
 * dari data video supaya atribusinya tidak bisa salah ketik.
 */
export function CandidateReviewForm({
  action,
  suggestedAspect,
  variants,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  suggestedAspect: "umum" | "kamera";
  variants: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">Aspek yang diulas</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: "umum", label: "Ulasan keseluruhan", hint: "Pemakaian harian, performa, baterai, layar" },
            { value: "kamera", label: "Ulasan kamera", hint: "Hasil foto dan video" },
          ].map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer gap-3 rounded-lg border border-border bg-card p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-muted/40"
            >
              <input type="radio" name="aspect" value={option.value} defaultChecked={option.value === suggestedAspect} className="mt-1 size-4 accent-[var(--brand)]" />
              <span>
                <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="summary">Ringkasan temuan</Label>
        <textarea id="summary" name="summary" rows={4} required minLength={40} maxLength={1200} className={FIELD} />
        <p className="text-xs text-muted-foreground">
          Tulis ulang dengan kalimat sendiri, jangan menyalin ucapan reviewer kata per kata. Tanpa skor atau &ldquo;terbaik&rdquo;.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="strengths">Kelebihan menurut reviewer</Label>
          <textarea id="strengths" name="strengths" rows={4} maxLength={1500} className={FIELD} />
          <p className="text-xs text-muted-foreground">Satu poin per baris, maksimal 6.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="limitations">Kekurangan menurut reviewer</Label>
          <textarea id="limitations" name="limitations" rows={4} maxLength={1500} className={FIELD} />
          <p className="text-xs text-muted-foreground">Satu poin per baris, maksimal 6.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="testContext">Konteks pengujian</Label>
          <Input id="testContext" name="testContext" maxLength={300} placeholder="Mis. pemakaian 2 minggu, main game 1 jam" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timestamp">Menit yang dirujuk</Label>
          <Input id="timestamp" name="timestamp" maxLength={8} placeholder="Mis. 4:35" inputMode="numeric" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="variantId">Berlaku untuk</Label>
        <select id="variantId" name="variantId" defaultValue="" className={FIELD}>
          <option value="">Seluruh varian</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              Varian {variant.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
        <input type="checkbox" name="isSponsored" className="size-5 accent-[var(--brand)]" />
        Video ini bersponsor atau disebut kerja sama (ditampilkan ke pembaca)
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Terbitkan ringkasan"}
      </Button>
    </form>
  );
}
