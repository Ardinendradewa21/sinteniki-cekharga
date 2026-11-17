import Link from "next/link";

import { RecommendationCard } from "@/components/assistant/recommendation-card";
import { Button } from "@/components/ui/button";
import { numberCandidates } from "@/lib/assistant/result-numbering";
import type { Candidate } from "@/lib/assistant/recommend";
import type { ResultView } from "@/lib/assistant/results";
import { PRICING_POLICY } from "@/lib/config";

/**
 * Hasil asisten, dipakai jalur chat (di dalam komponen klien) dan jalur
 * formulir (Server Component). Karena itu komponen ini tanpa hook dan tanpa
 * impor server: hanya menampilkan `ResultView`.
 *
 * Urutan grup mengikuti kekuatan klaimnya:
 *   1. memenuhi semua syarat (harga segar bila budget wajib),
 *   2. harga terakhir masuk budget tetapi perlu dicek ulang,
 *   3. di luar budget.
 * Grup 2 dan 3 tidak pernah disebut "memenuhi syarat".
 */

function count(shown: number, total: number) {
  return total > shown ? `${shown} dari ${total}` : String(total);
}

/** Kartu yang langsung terlihat per grup di mode ringkas (chat). */
const COMPACT_VISIBLE = 3;

/**
 * Daftar kartu satu grup. Mode ringkas menampilkan 3 kartu dan melipat
 * sisanya ke "Lihat N lainnya": tidak ada yang disembunyikan, hanya tidak
 * memanjangkan percakapan (VD-08).
 */
function CardList({
  candidates,
  now,
  numberOf,
  compact,
}: {
  candidates: Candidate[];
  now: Date;
  numberOf: Map<Candidate, number>;
  compact: boolean;
}) {
  const visible = compact ? candidates.slice(0, COMPACT_VISIBLE) : candidates;
  const rest = compact ? candidates.slice(COMPACT_VISIBLE) : [];
  return (
    <>
      <div className="mt-5 space-y-4">
        {visible.map((candidate) => (
          <RecommendationCard key={candidate.slug} candidate={candidate} now={now} number={numberOf.get(candidate)} />
        ))}
      </div>
      {rest.length > 0 ? (
        <details className="mt-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand-text">
            Lihat {rest.length} kandidat lain
          </summary>
          <div className="mt-3 space-y-4">
            {rest.map((candidate) => (
              <RecommendationCard key={candidate.slug} candidate={candidate} now={now} number={numberOf.get(candidate)} />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

export function AssistantResults({
  result,
  newConversationHref,
  extraActions,
  compact = false,
}: {
  result: ResultView;
  newConversationHref: string;
  /** Aksi tambahan dari pemanggil, mis. tombol salin tautan di jalur chat. */
  extraActions?: React.ReactNode;
  /**
   * Mode chat: 3 kartu per grup dan sisanya dilipat; grup harga perlu dicek
   * dan grup di luar budget dilipat bila sudah ada kandidat yang cocok.
   */
  compact?: boolean;
}) {
  const now = new Date();
  const { totals } = result;
  const nothing = totals.matches === 0 && totals.staleMatches === 0;
  // Nomor yang sama dipakai asisten saat menjelaskan ("kenapa nomor 2?").
  const numberOf = new Map(numberCandidates(result).map((entry) => [entry.candidate, entry.number]));

  return (
    <div className={compact ? "mt-5 space-y-6" : "mt-8 space-y-8 border-t border-border pt-8"}>
      {result.appliedHardRules.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="heading-label text-foreground">Syarat wajib yang dipakai menyaring</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {result.appliedHardRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.notes.length > 0 ? (
        <ul className="space-y-1 text-sm text-warning" role="note">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {totals.matches > 0 ? (
        <section aria-labelledby="hasil-cocok">
          <h2 id="hasil-cocok" className={compact ? "heading-label text-foreground" : "heading-section text-foreground"}>
            {totals.matches === 1
              ? "Satu kandidat yang memenuhi syaratmu"
              : `${count(result.matches.length, totals.matches)} kandidat yang memenuhi syaratmu`}
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Urutan di bawah mengikuti prioritasmu, bukan peringkat kualitas.
          </p>
          <CardList candidates={result.matches} now={now} numberOf={numberOf} compact={compact} />
        </section>
      ) : null}

      {totals.staleMatches > 0 ? (
        <Foldable fold={compact && totals.matches > 0} summary={`Harga perlu dicek ulang (${totals.staleMatches})`}>
        <section aria-labelledby="hasil-harga-lama">
          <h2 id="hasil-harga-lama" className="heading-section text-foreground">
            Harga terakhir masuk budget, tetapi perlu dicek ulang
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {count(result.staleMatches.length, totals.staleMatches)} produk lolos semua syaratmu yang lain, tetapi harganya
            belum diperiksa ulang dalam {PRICING_POLICY.freshnessWindowHours} jam terakhir. Harga di toko bisa sudah berubah, jadi produk ini belum bisa
            dipastikan masuk budget.
          </p>
          <CardList candidates={result.staleMatches} now={now} numberOf={numberOf} compact={compact} />
        </section>
        </Foldable>
      ) : null}

      {nothing ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="heading-card text-foreground">Tidak ada kandidat yang memenuhi semua syaratmu</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Saya tidak melonggarkan syaratmu diam-diam supaya daftar ini terisi. Coba ubah salah satu syarat, atau lihat
            alasan di bawah.
          </p>
          {result.exclusions.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {result.exclusions.map((exclusion) => (
                <li key={exclusion.name}>
                  <span className="font-medium text-foreground">{exclusion.name}</span>: {exclusion.reason}
                </li>
              ))}
              {totals.exclusions > result.exclusions.length ? (
                <li>dan {totals.exclusions - result.exclusions.length} produk lain.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {totals.overBudget > 0 ? (
        <Foldable fold={compact && totals.matches + totals.staleMatches > 0} summary={`Di luar budget, kalau mau menimbang ulang (${totals.overBudget})`}>
        <section aria-labelledby="hasil-luar-budget">
          <h2 id="hasil-luar-budget" className="heading-section text-foreground">
            Di luar budget, kalau mau menimbang ulang
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Menampilkan {count(result.overBudget.length, totals.overBudget)}, dari selisih terkecil.
          </p>
          <CardList candidates={result.overBudget} now={now} numberOf={numberOf} compact={compact} />
        </section>
        </Foldable>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {result.catalogHref ? (
          <Button asChild>
            <Link href={result.catalogHref}>Lihat semua di katalog</Link>
          </Button>
        ) : null}
        {extraActions}
        {compact ? null : (
          <>
            <Button asChild variant="outline">
              <Link href={newConversationHref}>Mulai dari awal</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/products">Telusuri katalog sendiri</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Grup sekunder dilipat di mode ringkas; selain itu tampil apa adanya. */
function Foldable({ fold, summary, children }: { fold: boolean; summary: string; children: React.ReactNode }) {
  if (!fold) return <>{children}</>;
  return (
    <details className="rounded-2xl border border-border bg-card px-4 py-1">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-foreground">{summary}</summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}
