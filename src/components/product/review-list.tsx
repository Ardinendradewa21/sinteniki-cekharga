import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare01Icon } from "@hugeicons/core-free-icons";

import type { ProductReview } from "@/lib/catalog/queries";

/**
 * Ringkasan pengalaman reviewer (PRD FR-03 dan FR-08).
 *
 * Yang membedakan bagian ini dari tabel spesifikasi:
 *
 * - Ini PENDAPAT, bukan fakta perangkat, dan dinyatakan begitu.
 * - Setiap kelebihan dan keterbatasan menempel pada review yang mengatakannya,
 *   lengkap dengan channel, tanggal, dan konteks pengujiannya. Tidak ada daftar
 *   pro/kontra anonim yang seolah berlaku universal.
 * - Dua reviewer boleh berbeda pendapat dan keduanya tetap ditampilkan; PRD
 *   FR-07 melarang menghapus perbedaan pendapat.
 * - Konteks pengujian yang tidak dicatat dinyatakan apa adanya, karena klaim
 *   tanpa konteks tidak bisa dinilai pembaca.
 */

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatPublishedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

export function ReviewList({ reviews }: { reviews: ProductReview[] }) {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Pengalaman reviewer
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Ringkasan kurasi dari video reviewer, bukan pengujian CekHarga dan bukan
        kesimpulan dari angka spesifikasi. Setiap poin menempel pada sumbernya.
      </p>

      {reviews.length === 0 ? (
        <div className="mt-5 rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-foreground">
            Belum ada ringkasan review
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Produk ini belum masuk daftar kurasi. Spesifikasi dan penawaran di
            halaman ini tetap bisa dipakai.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-bold text-foreground">
                  {review.channelName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPublishedAt(review.publishedAt)}
                </p>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Aspek: {review.aspect}
                {review.variantLabel ? ` · varian ${review.variantLabel}` : ""}
              </p>

              <p className="mt-3 text-sm leading-relaxed text-foreground">
                {review.summary}
              </p>

              {review.strengths.length > 0 || review.limitations.length > 0 ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {review.strengths.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-success">
                        Menurut {review.channelName}, kelebihannya
                      </p>
                      <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                        {review.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {review.limitations.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-warning">
                        Keterbatasan yang disebut
                      </p>
                      <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                        {review.limitations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                Konteks pengujian:{" "}
                {review.testContext ?? (
                  <span className="italic">tidak dicatat reviewer</span>
                )}
              </p>

              <a
                href={review.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
              >
                Lihat video sumber
                {review.timestampSeconds !== null
                  ? ` (menit ${formatTimestamp(review.timestampSeconds)})`
                  : ""}
                <HugeiconsIcon
                  icon={LinkSquare01Icon}
                  size={15}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="sr-only">(membuka tab baru)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
