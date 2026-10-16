"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { summarizeReviewsAction } from "@/lib/reviews/digest-actions";
import type { ReviewDigest } from "@/lib/reviews/digest-rules";

/**
 * Tombol dan hasil rangkuman AI ulasan reviewer (PB-40). Rangkuman yang sudah
 * ada di cache langsung tampil dari server; selain itu pengguna memintanya
 * sendiri, supaya model tidak dipanggil untuk setiap kunjungan.
 */
export function ReviewDigestPanel({
  slugs,
  initial,
  noteCount,
  channels,
}: {
  slugs: string[];
  initial: ReviewDigest | null;
  noteCount: number;
  channels: string[];
}) {
  const [digest, setDigest] = useState<ReviewDigest | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const request = () =>
    startTransition(async () => {
      setError(null);
      const result = await summarizeReviewsAction(slugs);
      if (result.ok) setDigest(result.digest);
      else setError(result.error);
    });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="heading-label text-foreground">Rangkuman ulasan reviewer</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Dari {noteCount} ringkasan terkurasi ({channels.join(", ")}).
          </p>
        </div>
        {!digest ? (
          <Button type="button" variant="outline" onClick={request} disabled={pending}>
            <HugeiconsIcon icon={AiMagicIcon} size={16} strokeWidth={2} aria-hidden />
            {pending ? "Merangkum…" : "Rangkum dengan AI"}
          </Button>
        ) : null}
      </div>

      <div aria-live="polite">
        {digest ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Keseluruhan</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{digest.overall}</p>
            </div>
            {digest.camera ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Kamera</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{digest.camera}</p>
              </div>
            ) : null}
            <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              Inferensi AI dari ringkasan yang ditulis tim CekHarga, bukan dari video secara langsung, dan bisa keliru.
              Tanpa skor atau pemenang; baca ringkasan asli per reviewer di halaman produk.
            </p>
          </div>
        ) : error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            AI menyandingkan apa kata reviewer tentang tiap produk, dipisah antara ulasan keseluruhan dan kamera.
          </p>
        )}
      </div>
    </div>
  );
}
