import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CandidateReviewForm } from "@/components/admin/candidate-review-form";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/auth/dal";
import { getInsforgeAdminClient } from "@/lib/backend/insforge";
import { publishFromCandidateAction, rejectCandidateAction } from "@/lib/reviews/actions";
import { getCandidate } from "@/lib/reviews/queries";
import { youtubeWatchUrl } from "@/lib/reviews/youtube-match";

export const metadata: Metadata = {
  title: "Tulis ringkasan ulasan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Menulis ringkasan dari satu kandidat video (PB-40). */
export default async function CandidatePage(props: PageProps<"/admin/ulasan/[id]">) {
  await requireStaff([]);
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const candidate = await getCandidate(id);
  if (!candidate) notFound();

  const { data } = await getInsforgeAdminClient()
    .database.from("variants")
    .select("id, ram_gb, storage_gb")
    .eq("product_id", candidate.product.id)
    .order("ram_gb")
    .order("storage_gb");
  const variants = ((data ?? []) as { id: string; ram_gb: number; storage_gb: number }[]).map((row) => ({
    id: row.id,
    label: `${row.ram_gb}/${row.storage_gb >= 1024 ? `${row.storage_gb / 1024} TB` : `${row.storage_gb} GB`}`,
  }));

  async function publish(state: ActionState, formData: FormData) {
    "use server";
    return publishFromCandidateAction(id, state, formData);
  }

  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      <Link href="/admin/ulasan" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline-offset-4 hover:underline">
        Kembali ke kandidat
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">Tulis ringkasan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {candidate.product.name} · {candidate.channel.title}
      </p>

      {candidate.status !== "pending" ? (
        <p role="status" className="mt-4 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm text-foreground">
          Kandidat ini sudah {candidate.status === "used" ? "dipakai untuk ringkasan" : "ditolak"}. Menulis lagi menambah
          ringkasan baru (mis. aspek yang lain).
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="aspect-video overflow-hidden rounded-xl border border-border bg-muted">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${candidate.video.youtubeId}`}
              title={candidate.video.title}
              loading="lazy"
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
              className="size-full"
            />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">{candidate.video.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Terbit {new Date(candidate.video.publishedAt).toLocaleDateString("id-ID", { dateStyle: "long" })} ·{" "}
            <a
              href={youtubeWatchUrl(candidate.video.youtubeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand underline-offset-4 hover:underline"
            >
              Buka di YouTube
            </a>
          </p>
          {candidate.status === "pending" ? (
            <form action={rejectCandidateAction} className="mt-4">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <input type="hidden" name="back" value="/admin/ulasan" />
              <Button type="submit" variant="outline" size="sm">
                Bukan ulasan produk ini
              </Button>
            </form>
          ) : null}
        </div>

        <CandidateReviewForm action={publish} suggestedAspect={candidate.suggestedAspect} variants={variants} />
      </div>
    </Container>
  );
}
