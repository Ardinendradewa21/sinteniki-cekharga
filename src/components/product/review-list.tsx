import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, LinkSquare01Icon, MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";

import { ReviewCarousel } from "@/components/product/review-carousel";
import { ReviewVideo, ReviewVideoProvider, TimestampButton } from "@/components/product/review-video";
import type { ProductReview } from "@/lib/catalog/queries";
import { formatClock, splitKeyword, type ReviewPoint } from "@/lib/reviews/review-format";
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

/** Poin per sisi yang langsung tampil di kartu format RV-02 (RV-04, keputusan PO 19 Nov 2026). */
const SHOWN_POINTS = 2;

function ReviewCard({
  review,
  aspectLabel,
  className,
}: {
  review: ProductReview;
  aspectLabel: string;
  className?: string;
}) {
  const hiddenPoints =
    Math.max(0, review.strengths.length - SHOWN_POINTS) + Math.max(0, review.limitations.length - SHOWN_POINTS);
  return (
    // `relative`: teks sr-only (posisi absolut) tertampung di kartu. Tanpa ini,
    // kartu carousel di luar layar membuat halaman 375px bisa digeser 380px.
    <li className={cn("relative rounded-xl border border-border bg-card p-5", className)}>
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

      {review.verdict ? (
        <>
          {/* RV-02: kesimpulan dulu (piramida terbalik), lalu label untuk
              dipindai, video, poin bermenit, dan ringkasan lengkap dilipat. */}
          <p className="mt-3 text-xs font-semibold text-muted-foreground">Intinya menurut {review.channelName}</p>
          <p className="mt-1 text-base leading-snug font-semibold text-foreground">{review.verdict}</p>
          {review.goodFor.length > 0 || review.notFor.length > 0 ? (
            <dl className="mt-3 space-y-2">
              <FitRow label="Cocok untuk" items={review.goodFor} tone="good" />
              <FitRow label="Kurang cocok untuk" items={review.notFor} tone="bad" />
            </dl>
          ) : null}
          <VideoOrLink review={review} />
          {/* RV-04: hanya 2 poin teratas per sisi di kartu (keputusan PO: jangan
              scroll panjang); sisanya ikut dilipat bersama ringkasan lengkap. */}
          <Points
            channelName={review.channelName}
            strengths={review.strengths.slice(0, SHOWN_POINTS)}
            limitations={review.limitations.slice(0, SHOWN_POINTS)}
          />
          <details className="group mt-4 rounded-lg border border-border">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 text-sm font-semibold text-brand-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              {hiddenPoints > 0 ? `Baca ringkasan lengkap dan ${hiddenPoints} poin lainnya` : "Baca ringkasan lengkap"}
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={16}
                strokeWidth={2}
                aria-hidden
                className="shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-border px-3 py-3">
              {hiddenPoints > 0 ? (
                <div className="-mt-4 mb-4">
                  <Points
                    channelName={review.channelName}
                    strengths={review.strengths.slice(SHOWN_POINTS)}
                    limitations={review.limitations.slice(SHOWN_POINTS)}
                    more
                  />
                </div>
              ) : null}
              <p className="text-sm leading-relaxed text-foreground">{review.summary}</p>
              <TestContext value={review.testContext} />
            </div>
          </details>
        </>
      ) : (
        <>
          {/* Format lama (sebelum RV-02): ringkasan terbuka, lalu poin. */}
          <p className="mt-3 text-sm leading-relaxed text-foreground">{review.summary}</p>
          <Points channelName={review.channelName} strengths={review.strengths} limitations={review.limitations} />
          <div className="mt-4 border-t border-border pt-3">
            <TestContext value={review.testContext} />
          </div>
          <VideoOrLink review={review} />
        </>
      )}
      </ReviewVideoProvider>
    </li>
  );
}

function TestContext({ value }: { value: string | null }) {
  return (
    <p className="mt-3 text-xs text-muted-foreground first:mt-0">
      Konteks pengujian: {value ?? <span className="italic">tidak dicatat reviewer</span>}
    </p>
  );
}

/** Label "Cocok untuk" / "Kurang cocok untuk": warna hanya penguat, teks label tetap menyebut maknanya. */
function FitRow({ label, items, tone }: { label: string; items: string[]; tone: "good" | "bad" }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      {items.map((item) => (
        <dd
          key={item}
          className={cn(
            "rounded-pill border px-2.5 py-0.5 text-xs font-semibold text-foreground",
            tone === "good" ? "border-success/40 bg-success/10" : "border-warning/50 bg-warning/10"
          )}
        >
          {item}
        </dd>
      ))}
    </div>
  );
}

function Points({
  channelName,
  strengths,
  limitations,
  more = false,
}: {
  channelName: string;
  strengths: ReviewPoint[];
  limitations: ReviewPoint[];
  /** Poin lanjutan di dalam "Baca ringkasan lengkap". */
  more?: boolean;
}) {
  if (strengths.length === 0 && limitations.length === 0) return null;
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <PointList title={more ? "Kelebihan lainnya" : `Kelebihan menurut ${channelName}`} points={strengths} tone="good" />
      <PointList title={more ? "Kekurangan lainnya" : "Kekurangan yang disebut"} points={limitations} tone="bad" />
    </div>
  );
}

function PointList({ title, points, tone }: { title: string; points: ReviewPoint[]; tone: "good" | "bad" }) {
  if (points.length === 0) return null;
  return (
    <div>
      <p className={cn("text-xs font-semibold", tone === "good" ? "text-success" : "text-warning")}>{title}</p>
      <ul className="mt-1.5 space-y-1.5">
        {points.map((point, index) => {
          const { keyword, rest } = splitKeyword(point.text);
          return (
            <li key={`${index}-${point.text}`} className="flex items-center gap-2 text-sm leading-snug text-muted-foreground">
              {/* Tanda + / − membuat sisi poin terbaca tanpa bergantung warna. */}
              <HugeiconsIcon
                icon={tone === "good" ? PlusSignIcon : MinusSignIcon}
                size={14}
                strokeWidth={2.4}
                aria-hidden
                className={cn("shrink-0", tone === "good" ? "text-success" : "text-warning")}
              />
              <span className="min-w-0 flex-1">
                {keyword ? <strong className="font-semibold text-foreground">{keyword}:</strong> : null} {rest}
              </span>
              {point.seconds !== null ? <TimestampButton seconds={point.seconds} label={point.text} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * RV-01: video diputar di kartu ini (thumbnail dulu, pemutar dimuat saat
 * diklik), dengan pilihan "Buka di YouTube". Tautan lama menjadi cadangan
 * bila ID video tidak bisa dibaca.
 */
function VideoOrLink({ review }: { review: ProductReview }) {
  if (parseYoutubeVideoId(review.videoUrl)) return <ReviewVideo channelName={review.channelName} />;
  return (
    <a
      href={review.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-text underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
    >
      Lihat video sumber
      {review.timestampSeconds !== null ? ` (menit ${formatClock(review.timestampSeconds)})` : ""}
      <HugeiconsIcon icon={LinkSquare01Icon} size={15} strokeWidth={2} aria-hidden />
      <span className="sr-only">(membuka tab baru)</span>
    </a>
  );
}
