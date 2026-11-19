import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare01Icon } from "@hugeicons/core-free-icons";

import { ReviewCarousel } from "@/components/product/review-carousel";
import { ReviewVideo, ReviewVideoProvider } from "@/components/product/review-video";
import type { ProductReview } from "@/lib/catalog/queries";
import { parseYoutubeVideoId } from "@/lib/reviews/youtube-match";
import { cn } from "@/lib/utils";

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
 * - Ulasan keseluruhan dan ulasan kamera dipisah (PB-40), dan video bersponsor
 *   selalu ditandai.
 * - Lebih dari satu ulasan per aspek tampil sebagai Review Carousel (VD-06):
 *   satu kartu per tampilan, tanpa autoplay. Urutannya tetap terbaru dulu,
 *   bukan peringkat.
 */

const GROUPS = [
  {
    aspect: "umum",
    aspectLabel: "Aspek umum",
    title: "Ulasan keseluruhan",
    hint: "Pemakaian harian, performa, baterai, dan layar.",
    empty: "Belum ada ringkasan ulasan keseluruhan untuk produk ini.",
  },
  {
    aspect: "kamera",
    aspectLabel: "Aspek kamera",
    title: "Ulasan kamera",
    hint: "Hasil foto dan video menurut reviewer yang mengujinya.",
    empty: "Belum ada ringkasan ulasan kamera untuk produk ini.",
  },
] as const;

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
      <h2 className="heading-section text-foreground">Pengalaman reviewer</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Ringkasan kurasi dari video reviewer, bukan pengujian CekHarga dan bukan
        kesimpulan dari angka spesifikasi. Setiap poin menempel pada sumbernya.
      </p>

      {GROUPS.map((group) => {
        const items = reviews.filter((review) => review.aspect === group.aspect);
        return (
          <div key={group.aspect} className="mt-6">
            <h3 className="text-base font-bold text-foreground">{group.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{group.hint}</p>
            {items.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
                {group.empty}
              </p>
            ) : (
              items.length === 1 ? (
                <ul className="mt-3">
                  <ReviewCard review={items[0]!} aspectLabel={group.aspectLabel} />
                </ul>
              ) : (
                <ReviewCarousel label={group.title}>
                  {items.map((review) => (
                    <ReviewCard key={review.id} review={review} aspectLabel={group.aspectLabel} className="w-full shrink-0 snap-start" />
                  ))}
                </ReviewCarousel>
              )
            )}
          </div>
        );
      })}
    </section>
  );
}

function ReviewCard({
  review,
  aspectLabel,
  className,
}: {
  review: ProductReview;
  aspectLabel: string;
  className?: string;
}) {
  return (
    <li className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <ReviewVideoProvider videoUrl={review.videoUrl} startSeconds={review.timestampSeconds}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-bold text-foreground">{review.channelName}</p>
        <p className="text-xs text-muted-foreground">{formatPublishedAt(review.publishedAt)}</p>
      </div>

      {/* Aspek, varian, dan label bersponsor selalu terlihat di tiap kartu (DESIGN.md §7). */}
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{[aspectLabel, review.variantLabel ? `Varian ${review.variantLabel}` : null].filter(Boolean).join(" · ")}</span>
        {review.isSponsored ? (
          <span className="rounded-pill border border-warning/50 bg-warning/10 px-2 py-0.5 font-semibold text-foreground">
            Video bersponsor
          </span>
        ) : null}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-foreground">{review.summary}</p>

      {review.strengths.length > 0 || review.limitations.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {review.strengths.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-success">Menurut {review.channelName}, kelebihannya</p>
              <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                {review.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {review.limitations.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-warning">Keterbatasan yang disebut</p>
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
        {review.testContext ?? <span className="italic">tidak dicatat reviewer</span>}
      </p>

      {/* RV-01: video diputar di kartu ini (thumbnail dulu, pemutar dimuat
          saat diklik), dengan pilihan "Buka di YouTube". Tautan lama tetap
          menjadi cadangan bila ID video tidak bisa dibaca. */}
      {parseYoutubeVideoId(review.videoUrl) ? (
        <ReviewVideo channelName={review.channelName} />
      ) : (
        <a
          href={review.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-text underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
        >
          Lihat video sumber
          {review.timestampSeconds !== null ? ` (menit ${formatTimestamp(review.timestampSeconds)})` : ""}
          <HugeiconsIcon icon={LinkSquare01Icon} size={15} strokeWidth={2} aria-hidden />
          <span className="sr-only">(membuka tab baru)</span>
        </a>
      )}
      </ReviewVideoProvider>
    </li>
  );
}
