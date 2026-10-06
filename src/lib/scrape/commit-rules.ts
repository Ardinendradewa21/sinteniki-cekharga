import type { OfficialVariantPrice, PreviewItem } from "@/lib/scrape/types";

/**
 * Aturan murni untuk mengirim hasil tarik otomatis ke Pusat Impor
 * (rencana kerja impor, Fase 3.1). Dipakai server action dan unit test.
 *
 * Browser hanya boleh mengirim KEPUTUSAN admin: model mana yang dikirim dan,
 * untuk "harga mulai" tanpa varian (Infinix), varian mana yang dipilih.
 * Semua data (spesifikasi, harga, URL) diambil dari hasil yang disimpan server.
 * Pilihan yang tidak cocok dengan data server diabaikan, bukan dipercaya.
 */

export type CommitSelection = {
  officialId: string;
  /** indeks harga di `lineup.unassignedPrices` → "ram+storage". */
  assignments?: Record<string, string>;
};

/** Hari setelah harga sesi dianggap terlalu lama untuk dikirim sebagai harga aktif. */
export const SESSION_PRICE_MAX_AGE_DAYS = 7;

/** Model boleh dikirim: spesifikasinya terbaca dan tidak ada temuan merah. */
export function isIncludable(item: PreviewItem): boolean {
  return item.specRow !== null && !item.issues.some((issue) => issue.level === "error");
}

/** Harga final satu model: harga per varian + "harga mulai" yang variannya dipilih admin dengan sah. */
export function finalPrices(item: PreviewItem, assignments: Record<string, string> = {}): OfficialVariantPrice[] {
  const variants = new Set((item.summary?.variants ?? []).map((v) => `${v.ramGb}+${v.storageGb}`));
  const extra = item.lineup.unassignedPrices.flatMap((price, index) => {
    const key = assignments[String(index)];
    // Varian harus benar-benar ada di spesifikasi; selain itu harga dilewati.
    if (!key || !variants.has(key)) return [];
    const [ramGb, storageGb] = key.split("+").map(Number);
    return [{ ...price, ramGb: ramGb!, storageGb: storageGb! }];
  });
  return [...item.lineup.prices, ...extra];
}

export type CommitPlan = {
  accepted: { officialId: string; item: PreviewItem; prices: OfficialVariantPrice[] }[];
  rejected: { officialId: string; reason: string }[];
};

/** Mencocokkan pilihan browser dengan hasil yang disimpan server. */
export function planCommit(
  stored: Readonly<Record<string, { status: "ok"; item: PreviewItem } | { status: "error" }>>,
  selections: readonly CommitSelection[]
): CommitPlan {
  const plan: CommitPlan = { accepted: [], rejected: [] };
  const seen = new Set<string>();
  for (const selection of selections) {
    if (seen.has(selection.officialId)) continue;
    seen.add(selection.officialId);
    const result = stored[selection.officialId];
    if (!result) {
      plan.rejected.push({ officialId: selection.officialId, reason: "Model ini belum diambil spesifikasinya di sesi ini." });
    } else if (result.status !== "ok") {
      plan.rejected.push({ officialId: selection.officialId, reason: "Spesifikasi model ini gagal diambil." });
    } else if (!isIncludable(result.item)) {
      plan.rejected.push({ officialId: selection.officialId, reason: "Model ini punya temuan merah sehingga tidak bisa disimpan." });
    } else {
      plan.accepted.push({
        officialId: selection.officialId,
        item: result.item,
        prices: finalPrices(result.item, selection.assignments),
      });
    }
  }
  return plan;
}

/** Umur harga sesi dalam hari (dibulatkan ke bawah). */
export function sessionAgeDays(fetchedAt: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(fetchedAt).getTime()) / 86_400_000);
}
