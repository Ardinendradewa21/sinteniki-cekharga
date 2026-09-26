"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import {
  buildCompareHref,
  type CompareSelection,
} from "@/lib/catalog/compare-params";
import { cn } from "@/lib/utils";

/**
 * Pemilih produk per kolom di bar atas perbandingan: nama produk bergaris
 * bawah tebal dengan chevron, seperti lembar perbandingan situs produsen.
 *
 * Memakai `<select>` bawaan agar keyboard, pembaca layar, dan pemilih native
 * di ponsel langsung benar. Pilihan tetap hidup di URL; komponen ini hanya
 * menukar satu slug lalu menavigasi, varian kembali ke basis harga produk
 * barunya.
 */
export function CompareColumnSwitch({
  index,
  current,
  selections,
  candidates,
}: {
  index: number;
  /** `label` = nama model saja (tanpa merek) supaya muat di kolom sempit. */
  current: { slug: string; name: string; label: string };
  selections: CompareSelection[];
  candidates: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = `ganti-kolom-${index + 1}`;

  return (
    <div className={cn("relative", pending && "opacity-60")}>
      <label htmlFor={id} className="sr-only">
        Ganti produk di kolom {index + 1}, sekarang {current.name}
      </label>
      <select
        id={id}
        value={current.slug}
        disabled={pending}
        onChange={(event) => {
          const slug = event.target.value;
          if (slug === current.slug) return;
          const next = selections.map((selection, position) =>
            position === index ? { slug, variantKey: null } : selection
          );
          startTransition(() => router.push(buildCompareHref(next), { scroll: false }));
        }}
        className="min-h-11 w-full cursor-pointer appearance-none truncate border-0 border-b-[3px] border-foreground bg-transparent py-2 pr-5 pl-0 text-[13px] font-bold sm:pr-8 text-foreground focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-base [&>option]:bg-card [&>option]:font-medium [&>option]:text-foreground"
      >
        <option value={current.slug}>{current.label}</option>
        {candidates.map((candidate) => (
          <option key={candidate.slug} value={candidate.slug}>
            {candidate.name}
          </option>
        ))}
      </select>
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        strokeWidth={2}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-foreground sm:size-5"
      />
    </div>
  );
}
