import Link from "next/link";

import type { OfferUrlSuggestionGroup } from "@/lib/admin/queries";

/**
 * Produk yang URL penawaran situs resminya tidak tercantum lagi (PB-06).
 * Harganya tetap diperbarui lewat pencocokan nama model; panel ini hanya
 * mengajak admin memutuskan URL mana yang dipakai tombol "Situs resmi".
 * Tidak dirender bila tidak ada usulan.
 */
export function OfferUrlSuggestionsPanel({ groups, total }: { groups: OfferUrlSuggestionGroup[]; total: number }) {
  if (total === 0) return null;
  return (
    <section aria-labelledby="url-berganti" className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 id="url-berganti" className="text-lg font-bold text-foreground">
        URL situs resmi berganti
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {total} penawaran situs resmi punya URL yang tidak tercantum lagi: halamannya berganti, atau penawarannya ganda
        dengan penawaran lain di varian yang sama. Buka produknya untuk memilih URL yang dipakai atau menghapus yang
        ganda.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {groups.map((group) => (
          <li key={group.productId}>
            <Link
              href={`/admin/products/${group.productId}#penawaran`}
              className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-foreground hover:text-brand focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium">{group.productName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {group.count} penawaran · {new Date(group.latestSeenAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
