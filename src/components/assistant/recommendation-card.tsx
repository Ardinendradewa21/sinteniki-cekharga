import Image from "next/image";
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
 * Tata letak ringkas: foto, identitas, dan harga dulu; dua alasan pertama
 * langsung terlihat, sisanya beserta kompromi ada di disclosure supaya daftar
 * kandidat tetap bisa dipindai. Kompromi tidak pernah disembunyikan total:
 * jumlahnya selalu disebut di ringkasan disclosure.
 *
 * Kandidat di luar budget memakai kartu yang sama tetapi diberi label tegas di
 * atas, karena PRD melarang alternatif di luar budget "diam-diam dianggap
 * memenuhi syarat".
 */

const VISIBLE_REASONS = 2;

function ReasonItem({ reason }: { reason: Candidate["reasons"][number] }) {
  return (
    <li className="text-sm leading-relaxed text-muted-foreground">
      {reason.text}
      {reason.source ? <span className="text-foreground"> ({reason.source})</span> : null}
    </li>
  );
}

export function RecommendationCard({
  candidate,
  now,
}: {
  candidate: Candidate;
  now: Date;
}) {
  const isOverBudget = candidate.overBudgetByIdr !== null;
  const visible = candidate.reasons.slice(0, VISIBLE_REASONS);
  const moreReasons = candidate.reasons.slice(VISIBLE_REASONS);

  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      {isOverBudget ? (
        <p className="mb-4 rounded-lg bg-warning-muted px-3 py-2 text-xs font-semibold text-warning">
          Di luar budget yang kamu sebut, lebih mahal{" "}
          {formatIdr(candidate.overBudgetByIdr ?? 0)}. Ditampilkan sebagai
          alternatif, bukan sebagai kandidat yang memenuhi syarat.
        </p>
      ) : null}

      <div className="flex gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
          <Image
            src={candidate.image.src}
            alt={candidate.image.isGenericIllustration ? "" : candidate.image.alt}
            fill
            sizes="96px"
            className="object-contain p-1.5"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{candidate.brand}</p>
            <h3 className="text-base font-bold tracking-tight text-foreground">{candidate.model}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Varian {candidate.variantLabel}</p>
            {candidate.image.isGenericIllustration ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">Gambar ilustrasi, bukan foto produk</p>
            ) : null}
          </div>
          <div className="sm:text-right">
            <CardPriceValue price={candidate.price} />
            <CardPriceMeta price={candidate.price} referenceVariant={candidate.variantLabel} now={now} className="mt-1" />
          </div>
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-semibold text-foreground">Kenapa ini cocok dengan yang kamu sebut</p>
          <ul className="mt-2 space-y-1.5">
            {visible.map((reason, index) => (
              <ReasonItem key={`${reason.text}-${index}`} reason={reason} />
            ))}
          </ul>
        </div>
      ) : null}

      <details className="group mt-3 border-t border-border pt-1">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-foreground">
          {moreReasons.length > 0 ? `Alasan lain (${moreReasons.length}) dan ` : ""}
          Komprominya ({candidate.tradeOffs.length})
        </summary>
        {moreReasons.length > 0 ? (
          <ul className="mb-3 space-y-1.5">
            {moreReasons.map((reason, index) => (
              <ReasonItem key={`${reason.text}-${index}`} reason={reason} />
            ))}
          </ul>
        ) : null}
        {candidate.tradeOffs.length === 0 ? (
          <p className="pb-2 text-sm leading-relaxed text-muted-foreground">
            Belum ada kompromi yang tercatat untuk produk ini. Itu berarti belum
            ada catatannya, bukan berarti tidak ada.
          </p>
        ) : (
          <ul className="space-y-1.5 pb-2">
            {candidate.tradeOffs.map((tradeOff, index) => (
              <ReasonItem key={`${tradeOff.text}-${index}`} reason={tradeOff} />
            ))}
          </ul>
        )}
      </details>

      <Link
        href={candidate.detailHref}
        className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
      >
        Lihat detail dan penawarannya
      </Link>
    </article>
  );
}
