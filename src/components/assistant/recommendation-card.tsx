import Link from "next/link";

import { CardPriceMeta, CardPriceValue } from "@/components/price-display";
import { formatIdr } from "@/lib/catalog/pricing";
import type { Candidate } from "@/lib/assistant/recommend";

/**
 * Kartu kandidat dari asisten (PRD FR-06).
 *
 * Setiap kartu wajib membawa empat hal: alasan cocok, kompromi, varian, dan
 * harga beserta waktu pemeriksaannya. Yang berasal dari reviewer selalu
 * menyebut channel-nya, supaya klaim yang tidak bisa disimpulkan dari angka
 * tetap bisa ditelusuri pembaca.
 *
 * Kandidat di luar budget memakai kartu yang sama tetapi diberi label tegas di
 * atas, karena PRD melarang alternatif di luar budget "diam-diam dianggap
 * memenuhi syarat".
 */
export function RecommendationCard({
  candidate,
  now,
}: {
  candidate: Candidate;
  now: Date;
}) {
  const isOverBudget = candidate.overBudgetByIdr !== null;

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      {isOverBudget ? (
        <p className="mb-4 rounded-lg bg-warning-muted px-3 py-2 text-xs font-semibold text-warning">
          Di luar budget yang kamu sebut, lebih mahal{" "}
          {formatIdr(candidate.overBudgetByIdr ?? 0)}. Ditampilkan sebagai
          alternatif, bukan sebagai kandidat yang memenuhi syarat.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {candidate.brand}
          </p>
          <h3 className="text-base font-bold tracking-tight text-foreground">
            {candidate.model}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Varian {candidate.variantLabel}
          </p>
        </div>
        <div className="text-right">
          <CardPriceValue price={candidate.price} />
          <CardPriceMeta
            price={candidate.price}
            referenceVariant={candidate.variantLabel}
            now={now}
            className="mt-1"
          />
        </div>
      </div>

      {candidate.reasons.length > 0 ? (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-semibold text-foreground">
            Kenapa ini cocok dengan yang kamu sebut
          </p>
          <ul className="mt-2 space-y-1.5">
            {candidate.reasons.map((reason, index) => (
              <li
                key={`${reason.text}-${index}`}
                className="text-sm leading-relaxed text-muted-foreground"
              >
                {reason.text}
                {reason.source ? (
                  <span className="text-foreground"> ({reason.source})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs font-semibold text-foreground">Komprominya</p>
        {candidate.tradeOffs.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Belum ada kompromi yang tercatat untuk produk ini. Itu berarti belum
            ada catatannya, bukan berarti tidak ada.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {candidate.tradeOffs.map((tradeOff, index) => (
              <li
                key={`${tradeOff.text}-${index}`}
                className="text-sm leading-relaxed text-muted-foreground"
              >
                {tradeOff.text}
                {tradeOff.source ? (
                  <span className="text-foreground"> ({tradeOff.source})</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href={candidate.detailHref}
        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
      >
        Lihat detail dan penawarannya
      </Link>
    </article>
  );
}
