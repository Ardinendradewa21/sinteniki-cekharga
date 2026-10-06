"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { PreviewState } from "@/lib/import/batch-actions";

/**
 * Mengantrekan ulang baris yang gagal. Baris yang sudah berhasil tidak
 * disentuh lagi; baris gagal diproses ulang dengan data katalog terkini.
 */
export function RetryFailedButton({
  action,
  failedCount,
}: {
  action: () => Promise<PreviewState>;
  failedCount: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<PreviewState>(async () => {
    const result = await action();
    if (!result.error) router.refresh();
    return result;
  }, { error: null });

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Mengantrekan…" : `Coba ulang ${failedCount} baris yang gagal`}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
