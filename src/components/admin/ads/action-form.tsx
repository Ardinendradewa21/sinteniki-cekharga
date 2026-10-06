"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { AdActionState } from "@/lib/ads/admin-schema";
import { cn } from "@/lib/utils";

/**
 * Pembungkus form admin iklan: menjalankan server action lewat
 * useActionState, lalu menampilkan galat (role="alert") atau pesan sukses
 * (role="status") tepat di bawah form. Isi field dirender server sebagai
 * children, sehingga satu komponen klien cukup untuk semua form modul iklan.
 *
 * Form dikirim manual (bukan `<form action>`) karena React 19 mengosongkan
 * field setelah setiap aksi, termasuk saat validasi gagal, sehingga isian
 * pengguna hilang. Di sini field hanya dikosongkan bila `resetOnSuccess`.
 */

type Variant = "default" | "outline" | "destructive" | "secondary" | "ghost";

const INITIAL: AdActionState = { error: null };

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Menyimpan…",
  submitVariant,
  submitName,
  submitValue,
  extraSubmit,
  className,
  resetOnSuccess = false,
  confirmMessage,
}: {
  action: (state: AdActionState, formData: FormData) => Promise<AdActionState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  submitVariant?: Variant;
  /** name/value tombol utama, mis. decision=approve. */
  submitName?: string;
  submitValue?: string;
  /** Tombol kirim kedua (mis. Tolak di samping Setujui), memakai name/value. */
  extraSubmit?: { label: string; name: string; value: string; variant?: Variant };
  className?: string;
  /** Kosongkan field setelah sukses (form tambah data). */
  resetOnSuccess?: boolean;
  /** Minta konfirmasi sebelum mengirim (aksi yang sulit dibatalkan). */
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && !state.error && state.message) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const formData = new FormData(event.currentTarget, submitter);
        startTransition(() => formAction(formData));
      }}
      aria-busy={pending}
      className={cn("space-y-4", className)}
    >
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          variant={submitVariant}
          name={submitName}
          value={submitValue}
          disabled={pending}
          className="min-h-11"
        >
          {pending ? pendingLabel : submitLabel}
        </Button>
        {extraSubmit ? (
          <Button
            type="submit"
            variant={extraSubmit.variant ?? "outline"}
            name={extraSubmit.name}
            value={extraSubmit.value}
            disabled={pending}
            className="min-h-11"
          >
            {extraSubmit.label}
          </Button>
        ) : null}
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : state.message ? (
        <p role="status" className="rounded-lg border border-brand/30 bg-brand-muted px-3 py-2 text-sm text-foreground">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
