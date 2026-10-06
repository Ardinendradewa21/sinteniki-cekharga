"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { retryFailedPhotosAction } from "@/lib/import/photo-actions";

/** Mengantrekan ulang foto gagal milik satu produk, lalu memuat ulang panel. */
export function RetryPhotosButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { retried } = await retryFailedPhotosAction(productId);
            setMessage(retried > 0 ? `${retried} foto diantrekan ulang.` : "Tidak ada foto gagal.");
            router.refresh();
          })
        }
      >
        {pending ? "Memproses…" : "Coba ulang foto yang gagal"}
      </Button>
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
