import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReviewForm } from "@/components/admin/review-form";
import { Container } from "@/components/layout/container";
import type { ActionState } from "@/lib/admin/actions";
import { hasAiCredentials } from "@/lib/assistant/ai/client";
import { requireStaff } from "@/lib/auth/dal";
import { updateReviewAction } from "@/lib/reviews/actions";
import { draftForReviewAction, type DraftRequest } from "@/lib/reviews/ai-draft-actions";
import { getReviewForEdit } from "@/lib/reviews/queries";
import { formatClock, pointToLine, zipPoints } from "@/lib/reviews/review-format";
import { YOUTUBE_EMBED_ALLOW, youtubeWatchUrl } from "@/lib/reviews/youtube-match";

export const metadata: Metadata = {
  title: "Ubah ringkasan ulasan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
/** Sama dengan halaman kandidat: draf dari video bisa beberapa menit (batas Vercel Hobby 300 s). */
export const maxDuration = 300;

/**
 * Ubah satu ringkasan ulasan (RV-02). Dipakai juga untuk mengubah ringkasan
 * format lama ke format kartu lewat "Rapikan isian dengan AI".
 */
export default async function EditReviewPage(props: PageProps<"/admin/ulasan/ringkasan/[id]">) {
  await requireStaff([]);
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const review = await getReviewForEdit(id);
  if (!review) notFound();

  // Id ringkasan diikat di server, tidak dikirim dari formulir.
  async function save(state: ActionState, formData: FormData) {
    "use server";
    return updateReviewAction(id, state, formData);
  }
  async function draft(request: DraftRequest) {
    "use server";
    return draftForReviewAction(id, request);
  }

  const lines = (texts: string[], seconds: (number | null)[]) => zipPoints(texts, seconds).map(pointToLine).join("\n");

  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      <Link
        href={`/admin/products/${review.productId}`}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline-offset-4 hover:underline"
      >
        Kembali ke produk
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Ubah ringkasan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {review.productName} · {review.channelName} · {review.status === "published" ? "sudah terbit" : "draft"}
      </p>

      {review.verdict === null ? (
        <p role="status" className="mt-4 max-w-prose rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm text-foreground">
          Ringkasan ini masih format lama (tanpa &ldquo;Intinya&rdquo;). Tekan &ldquo;Rapikan isian dengan AI&rdquo; untuk menatanya ke format
          kartu, atau isi kolomnya sendiri. Periksa hasilnya sebelum menyimpan.
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          {review.youtubeId ? (
            <>
              <div className="aspect-video overflow-hidden rounded-xl border border-border bg-muted">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${review.youtubeId}${review.timestampSeconds ? `?start=${review.timestampSeconds}` : ""}`}
                  title={review.videoTitle ?? `Video ulasan ${review.channelName}`}
                  loading="lazy"
                  allow={YOUTUBE_EMBED_ALLOW}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="size-full"
                />
              </div>
              {review.videoTitle ? <p className="mt-3 text-sm font-semibold text-foreground">{review.videoTitle}</p> : null}
              <a
                href={youtubeWatchUrl(review.youtubeId, review.timestampSeconds)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline-offset-4 hover:underline"
              >
                Buka di YouTube{review.timestampSeconds ? ` (menit ${formatClock(review.timestampSeconds)})` : ""}
              </a>
            </>
          ) : (
            <a
              href={review.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              Buka video sumber
            </a>
          )}
        </div>

        <ReviewForm
          action={save}
          draftAction={hasAiCredentials() ? draft : null}
          hasVideo={review.youtubeId !== null}
          variants={review.variants}
          submitLabel="Simpan perubahan"
          initial={{
            aspect: review.aspect,
            variantId: review.variantId,
            isSponsored: review.isSponsored,
            verdict: review.verdict ?? "",
            goodFor: review.goodFor.join("\n"),
            notFor: review.notFor.join("\n"),
            summary: review.summary,
            strengths: lines(review.strengths, review.strengthSeconds),
            limitations: lines(review.limitations, review.limitationSeconds),
            testContext: review.testContext ?? "",
            timestamp: review.timestampSeconds ? formatClock(review.timestampSeconds) : "",
          }}
        />
      </div>
    </Container>
  );
}
