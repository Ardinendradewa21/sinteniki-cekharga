"use client";

import { useActionState } from "react";

import { signInAction, type SignInState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Form masuk admin.
 *
 * Memakai `useActionState` supaya pesan gagal muncul tanpa memuat ulang
 * halaman, TETAPI tetap berupa <form action={...}> biasa: kalau JavaScript
 * gagal dimuat, form ini masih terkirim dan tetap bisa dipakai masuk. Itu pola
 * yang sama dengan seluruh form di situs ini.
 */
const INITIAL: SignInState = { error: null };
const DEFAULT_ADMIN_EMAIL = "sinteniki@gmail.com";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, INITIAL);

  return (
    <form action={action} autoComplete="off" className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={DEFAULT_ADMIN_EMAIL}
          autoComplete="off"
          readOnly
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Kata sandi</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="off"
          required
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Memeriksa..." : "Masuk"}
      </Button>
    </form>
  );
}
