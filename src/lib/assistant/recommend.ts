import "server-only";

import { loadPublishedCatalog } from "@/lib/catalog/queries";
import {
  formatVariantLabel,
  variantKey,
} from "@/lib/catalog/queries";
import { resolveVariantPrice } from "@/lib/catalog/pricing";
import type { PriceResolution } from "@/lib/catalog/pricing";
import type { Product, Variant } from "@/lib/catalog/schema";
import type { UserNeeds } from "@/lib/assistant/needs";

/**
 * Mesin rekomendasi (PRD FR-06).
 *
 * Ini bagian yang menjawab syarat penerimaan paling penting di FR-06: "syarat
 * wajib disaring melalui logika terstruktur, BUKAN janji prompt saja". Semua
 * penyaringan syarat wajib terjadi di sini, deterministik dan bisa diuji, tanpa
 * melibatkan model bahasa sama sekali.
 *
 * Pembagian tanggung jawab yang direncanakan saat backend AI masuk nanti:
 * kode ini tetap yang memutuskan kandidat mana yang memenuhi syarat, dan model
 * bahasa hanya membantu menerjemahkan kebutuhan pengguna dari kalimat bebas
 * menjadi `UserNeeds`, lalu merangkai penjelasannya. Model tidak boleh diberi
 * wewenang meloloskan kandidat yang gagal syarat wajib.
 *
 * Aturan lain yang ditegakkan di sini:
 *
 * - Kandidat di luar budget TIDAK dibuang diam-diam. Kalau budgetnya wajib,
 *   mereka dipisahkan sebagai alternatif berlabel, sesuai PRD: "Alternatif di
 *   luar budget harus diberi label dan tidak boleh diam-diam dianggap memenuhi
 *   syarat."
 * - Alasan cocok hanya berisi FAKTA yang tercatat (angka spesifikasi, varian,
 *   harga) atau kutipan reviewer. PRD melarang menyimpulkan pengalaman gaming
 *   atau baterai hanya dari angka spesifikasi, jadi kalimatnya tidak pernah
 *   mengklaim rasa pemakaian tanpa sumber.
 * - Jumlah rekomendasi tidak dipaksakan. Kalau hanya satu yang lolos, yang
 *   ditampilkan satu.
 */

export type MatchReason = {
  /** `fact` = angka tercatat, `review` = pernyataan reviewer dengan sumber. */
  kind: "fact" | "review";
  text: string;
  /** Diisi untuk `review`, supaya klaim selalu bisa ditelusuri. */
  source: string | null;
};

export type Candidate = {
  slug: string;
  name: string;
  brand: string;
  model: string;
  variantLabel: string;
  variantKey: string;
  price: PriceResolution;
  detailHref: string;
  /** Kenapa kandidat ini cocok, semuanya berbasis data tercatat. */
  reasons: MatchReason[];
  /** Apa yang dikorbankan. Kosong berarti tidak ada yang tercatat, bukan sempurna. */
  tradeOffs: MatchReason[];
  /** Terisi hanya untuk alternatif di luar budget. */
  overBudgetByIdr: number | null;
};

export type RecommendationResult = {
  /** Kandidat yang memenuhi SEMUA syarat wajib. */
  matches: Candidate[];
  /** Kandidat yang gagal HANYA karena melewati budget wajib, diberi label. */
  overBudget: Candidate[];
  /** Alasan kandidat lain tersingkir, dinyatakan terbuka. */
  exclusions: { name: string; reason: string }[];
  /** Syarat wajib yang benar-benar diterapkan sebagai penyaring. */
  appliedHardRules: string[];
  totalPublished: number;
};

type Scored = { candidate: Candidate; score: number; order: number };

function bestPricedVariant(
  variants: Variant[],
  offers: Parameters<typeof resolveVariantPrice>[0]["offers"],
  observations: Parameters<typeof resolveVariantPrice>[0]["observations"],
  checks: Parameters<typeof resolveVariantPrice>[0]["checks"],
  now: Date
): { variant: Variant; price: PriceResolution } | null {
  let fallback: { variant: Variant; price: PriceResolution } | null = null;
  let best: { variant: Variant; price: PriceResolution } | null = null;

  for (const variant of variants) {
    const price = resolveVariantPrice({
      variantId: variant.id,
      offers,
      observations,
      checks,
      now,
    });

    if (price.status === "available") {
      if (!best || price.priceIdr < (best.price as { priceIdr: number }).priceIdr) {
        best = { variant, price };
      }
    } else if (!fallback) {
      fallback = { variant, price };
    }
  }

  return best ?? fallback;
}

export async function recommend(
  now: Date,
  needs: UserNeeds
): Promise<RecommendationResult> {
  const catalog = await loadPublishedCatalog(now);

  const appliedHardRules: string[] = [];
  if (needs.budgetIdr !== null && needs.budgetIsHard) {
    appliedHardRules.push(
      `Harga tidak boleh melebihi ${needs.budgetIdr.toLocaleString("id-ID")} rupiah`
    );
  }
  for (const requirement of needs.requirements) {
    if (requirement === "garansi-resmi") {
      appliedHardRules.push("Varian harus bergaransi resmi Indonesia");
    }
    if (requirement === "ram-8") appliedHardRules.push("RAM minimal 8 GB");
    if (requirement === "storage-256") {
      appliedHardRules.push("Penyimpanan minimal 256 GB");
    }
  }

  const matches: Scored[] = [];
  const overBudget: Scored[] = [];
  const exclusions: { name: string; reason: string }[] = [];

  catalog.products.forEach((product: Product, order: number) => {
    const name = `${product.brand} ${product.model}`;

    // Syarat wajib pada varian dijalankan lebih dulu. Kandidat yang tidak punya
    // satu pun varian yang memenuhi syarat memang tidak layak ditawarkan.
    const eligibleVariants = catalog.variants.filter((variant) => {
      if (variant.productId !== product.id) return false;
      if (
        needs.requirements.includes("garansi-resmi") &&
        variant.region === null
      ) {
        return false;
      }
      if (needs.requirements.includes("ram-8") && variant.ramGb < 8) {
        return false;
      }
      if (needs.requirements.includes("storage-256") && variant.storageGb < 256) {
        return false;
      }
      return true;
    });

    if (eligibleVariants.length === 0) {
      exclusions.push({
        name,
        reason: "Tidak ada varian tercatat yang memenuhi syarat wajibmu.",
      });
      return;
    }

    const picked = bestPricedVariant(
      eligibleVariants,
      catalog.offers,
      catalog.priceObservations,
      catalog.priceChecks,
      now
    );

    if (!picked) {
      exclusions.push({ name, reason: "Belum ada varian yang bisa dinilai." });
      return;
    }

    const { variant, price } = picked;

    const reasons: MatchReason[] = [];
    const tradeOffs: MatchReason[] = [];

    // Alasan berbasis angka tercatat. Sengaja tidak menyimpulkan rasa pemakaian.
    if (needs.activities.includes("baterai") || needs.priority === "baterai") {
      reasons.push({
        kind: "fact",
        text: product.specs.batteryMah
          ? `Kapasitas baterai tercatat ${product.specs.batteryMah} mAh`
          : "Kapasitas baterai belum tercatat, jadi belum bisa dinilai",
        source: null,
      });
    }
    if (needs.activities.includes("foto") || needs.priority === "kamera") {
      reasons.push({
        kind: "fact",
        text: product.specs.mainCameraMp
          ? `Kamera utama tercatat ${product.specs.mainCameraMp} MP. Angka megapiksel tidak menentukan kualitas foto`
          : "Resolusi kamera utama belum tercatat",
        source: null,
      });
    }
    if (needs.activities.includes("game") || needs.priority === "performa") {
      reasons.push({
        kind: "fact",
        text: product.specs.chipset
          ? `Chipset tercatat: ${product.specs.chipset}`
          : "Chipset belum tercatat, jadi performanya belum bisa dinilai",
        source: null,
      });
    }
    if (needs.activities.includes("kerja")) {
      reasons.push({
        kind: "fact",
        text: `Varian ini punya RAM ${variant.ramGb} GB dan penyimpanan ${variant.storageGb} GB`,
        source: null,
      });
    }

    // Kutipan reviewer dipakai untuk hal yang memang tidak bisa disimpulkan dari
    // angka. Selalu membawa nama channel sebagai sumber.
    for (const review of catalog.reviews) {
      if (review.productId !== product.id) continue;
      const relevant =
        (needs.priority === "baterai" &&
          review.aspect.toLowerCase().includes("baterai")) ||
        (needs.priority === "kamera" &&
          review.aspect.toLowerCase().includes("kamera")) ||
        (needs.priority === "performa" &&
          review.aspect.toLowerCase().includes("performa"));

      if (relevant) {
        reasons.push({
          kind: "review",
          text: review.summary,
          source: review.channelName,
        });
      }
      for (const limitation of review.limitations) {
        tradeOffs.push({
          kind: "review",
          text: limitation,
          source: review.channelName,
        });
      }
    }

    if (price.status !== "available") {
      tradeOffs.push({
        kind: "fact",
        text: "Belum ada penawaran yang memenuhi syarat, jadi harganya belum bisa dipastikan",
        source: null,
      });
    }

    const candidate: Candidate = {
      slug: product.slug,
      name,
      brand: product.brand,
      model: product.model,
      variantLabel: formatVariantLabel(variant),
      variantKey: variantKey(variant),
      price,
      detailHref: `/products/${product.slug}?varian=${variantKey(variant)}`,
      reasons,
      tradeOffs,
      overBudgetByIdr: null,
    };

    // Penyaring budget dijalankan paling akhir supaya kandidat yang lolos semua
    // syarat lain tetap bisa ditawarkan sebagai alternatif berlabel.
    if (needs.budgetIdr !== null && needs.budgetIsHard) {
      /*
        Kandidat tanpa harga yang layak TIDAK boleh lolos batas budget yang
        ditetapkan sebagai syarat keras. Harga yang tidak diketahui bukan berarti
        murah, dan menampilkannya di daftar "memenuhi syarat" sama saja
        menyatakan sesuatu yang tidak bisa dibuktikan (PRD FR-06 dan §6).

        Kandidatnya tidak dibuang diam-diam: alasannya disebutkan di daftar
        pengecualian supaya pengguna tahu ia ada dan kenapa tidak muncul.
      */
      if (price.status !== "available") {
        exclusions.push({
          name,
          reason:
            "Harganya belum bisa dipastikan, jadi tidak bisa dijamin masuk budget yang kamu tetapkan sebagai batas keras.",
        });
        return;
      }

      const over = price.priceIdr - needs.budgetIdr;
      if (over > 0) {
        overBudget.push({
          candidate: { ...candidate, overBudgetByIdr: over },
          score: 0,
          order,
        });
        return;
      }
    } else if (needs.budgetIdr !== null && price.status === "available") {
      // Budget hanya perkiraan: kelebihannya dicatat sebagai kompromi, bukan
      // sebagai alasan membuang kandidat.
      const over = price.priceIdr - needs.budgetIdr;
      if (over > 0) {
        tradeOffs.push({
          kind: "fact",
          text: `Melewati budget yang kamu sebut sebesar ${over.toLocaleString("id-ID")} rupiah`,
          source: null,
        });
      }
    }

    // Skor hanya untuk mengurutkan preferensi lunak. Tidak pernah ditampilkan
    // sebagai nilai, dan tidak pernah membuang kandidat.
    let score = 0;
    if (price.status === "available") score += 1;
    if (needs.priority === "harga" && price.status === "available") {
      score += 1_000_000_000 / Math.max(price.priceIdr, 1);
    }
    if (needs.priority === "baterai" && product.specs.batteryMah) {
      score += product.specs.batteryMah / 1000;
    }
    if (needs.priority === "kamera" && product.specs.mainCameraMp) {
      score += product.specs.mainCameraMp / 20;
    }
    if (needs.priority === "performa" && product.specs.chipset) score += 2;

    matches.push({ candidate: { ...candidate, tradeOffs }, score, order });
  });

  const sortByScore = (a: Scored, b: Scored) =>
    b.score - a.score || a.order - b.order;

  return {
    matches: matches.sort(sortByScore).map((entry) => entry.candidate),
    overBudget: overBudget
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.candidate),
    exclusions,
    appliedHardRules,
    totalPublished: catalog.products.length,
  };
}
