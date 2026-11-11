"use client";

import { useActionState, useEffect, useRef } from "react";

import { completeResetAction, requestResetCodeAction, type ResetState } from "@/lib/auth/reset-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Form lupa kata sandi admin, dua langkah (PB-48).
 *
 * Langkah 1 meminta kode ke email; langkah 2 mengisi kode dan kata sandi baru.
 * Keduanya <form action> biasa, jadi tetap terkirim walau JavaScript gagal
 * dimuat (pesan tampil setelah halaman dimuat ulang).
 */
const INITIAL: ResetState = { step: "email", email: "", error: null, notice: null };

export function ResetPasswordForm() {
  const [sendState, sendAction, sending] = useActionState(requestResetCodeAction, INITIAL);
  const [doneState, doneAction, saving] = useActionState(completeResetAction, INITIAL);
  const codeRef = useRef<HTMLInputElement>(null);

  // Langkah 2 muncul setelah kode diminta; email-nya dari jawaban server langkah 1.
  const onCodeStep = sendState.step === "code";
  const email = sendState.email;

  useEffect(() => {
    if (sendState.step === "code") codeRef.current?.focus();
  }, [sendState]);

  if (!onCodeStep) {
    const error = sendState.error;
    return (
      <form action={sendAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email akun admin</Label>
          <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" defaultValue={email} required />
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? "Mengirim..." : "Kirim kode"}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {sendState.notice ? (
        <p role="status" className="rounded-xl border border-border bg-brand-muted p-3 text-sm leading-relaxed text-foreground">
          {sendState.notice}
        </p>
      ) : null}
      <form action={doneAction} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <div className="space-y-2">
          <Label htmlFor="code">Kode 6 digit dari email</Label>
          <Input
            ref={codeRef}
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            defaultValue={doneState.code ?? ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Kata sandi baru</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby="password-hint" />
          <p id="password-hint" className="text-xs text-muted-foreground">
            Minimal 12 karakter. Kalimat pendek yang mudah kamu ingat lebih aman dari kata acak yang pendek.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="repeat">Ulangi kata sandi baru</Label>
          <Input id="repeat" name="repeat" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
        </div>
        {doneState.error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {doneState.error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan kata sandi baru"}
        </Button>
      </form>
      <form action={sendAction}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="outline" className="w-full" disabled={sending}>
          {sending ? "Mengirim..." : "Kirim ulang kode"}
        </Button>
      </form>
    </div>
  );
}
