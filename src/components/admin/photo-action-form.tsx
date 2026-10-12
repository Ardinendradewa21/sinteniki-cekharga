"use client";

import { useActionState, type ReactNode } from "react";

import type { PhotoActionState } from "@/lib/admin/photo-admin-actions";
import { cn } from "@/lib/utils";

/**
 * Satu formulir aksi foto (naik/turun, sampul, pindah warna, hapus) dengan
 * pesan hasilnya sendiri. Tanpa JavaScript formulir tetap terkirim; pesan
 * diumumkan ke pembaca layar lewat aria-live.
 */
export function PhotoActionForm({
  action,
  productId,
  photoId,
  hidden = {},
  children,
  className,
}: {
  action: (prev: PhotoActionState, formData: FormData) => Promise<PhotoActionState>;
  productId: string;
  photoId: string;
  hidden?: Record<string, string>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, message: null });
  return (
    <form action={formAction} className={cn("flex flex-wrap items-center gap-2", className)} aria-busy={pending}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="photoId" value={photoId} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <span aria-live="polite" className={cn("text-xs", state.error ? "text-destructive" : "text-muted-foreground")}>
        {state.error ?? state.message ?? ""}
      </span>
    </form>
  );
}
