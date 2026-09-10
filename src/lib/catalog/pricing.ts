import { FRESHNESS_WINDOW_MS } from "@/lib/config";
import type {
  Offer,
  PriceCheck,
  PriceObservation,
  Variant,
} from "@/lib/catalog/schema";

/**
 * Aturan harga & freshness (PRD §7). Fungsi di sini murni (tidak menyentuh
 * jaringan, tidak membaca jam sistem sendiri): `now` selalu diberikan pemanggil
 * supaya perilakunya deterministik dan bisa diuji dengan clock terkendali
 * (PRD §7 penutup).
 *
 * Yang ditegakkan di sini:
 *  1. "Mulai dari" = harga terendah dari penawaran layak dalam cakupan CekHarga,
 *     bukan klaim termurah se-internet.
 *  2. Penawaran layak = cocok varian, kondisi baru, listing aktif, harga valid,
 *     dan cukup baru. Listing ambigu / habis tidak jadi basis harga.
 *  3. Harga lintas varian wajib menyebut varian acuannya.
 *  5. Tanpa penawaran layak → "Harga belum tersedia"; harga lama hanya boleh
 *     tampil terpisah sebagai "Harga terakhir tercatat".
 *  6. Hanya percobaan yang BERHASIL memperbarui waktu pemeriksaan.
 */

export type PriceResolution =
  | {
      status: "available";
      priceIdr: number;
      /** Waktu pemeriksaan berhasil terakhir untuk penawaran ini. */
      checkedAt: string;
      offerId: string;
      variantId: string;
      origin: PriceObservation["origin"];
    }
  | {
      status: "stale";
      priceIdr: number;
      /** Kapan harga itu terakhir benar-benar teramati. */
      observedAt: string;
      offerId: string;
      variantId: string;
    }
  | { status: "unavailable" };

export type StartingPriceResolution = PriceResolution & {
  /**
   * Varian yang menjadi basis harga. Wajib ditampilkan bersama harga saat kartu
   * memakai harga terendah lintas varian (PRD §7 butir 3).
   */
  referenceVariantId?: string;
};

/** Listing yang boleh jadi basis harga aktif (PRD §7 butir 2). */
export function isPriceableListing(offer: Offer): boolean {
  return offer.condition === "new" && offer.listingStatus === "active";
}

export function isFresh(observedAt: string, now: Date): boolean {
  const age = now.getTime() - new Date(observedAt).getTime();
  return age >= 0 && age <= FRESHNESS_WINDOW_MS;
}

/** Pengamatan berhasil terakhir untuk satu penawaran. */
export function latestObservation(
  offerId: string,
  observations: readonly PriceObservation[]
): PriceObservation | null {
  const found = observations
    .filter((observation) => observation.offerId === offerId)
    .sort(
      (a, b) =>
        new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
    );
  return found[0] ?? null;
}

/**
 * Waktu pemeriksaan BERHASIL terakhir (PRD §7 butir 6). Percobaan gagal tidak
 * pernah memajukan waktu ini, dan penyuntingan metadata tidak membuat harga
 * terlihat baru.
 */
export function lastSuccessfulCheckAt(
  offerId: string,
  checks: readonly PriceCheck[]
): string | null {
  const successes = checks
    .filter((check) => check.offerId === offerId && check.outcome === "success")
    .sort(
      (a, b) =>
        new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime()
    );
  return successes[0]?.attemptedAt ?? null;
}

/** Harga untuk satu varian yang dipilih (halaman detail & perbandingan). */
export function resolveVariantPrice(input: {
  variantId: string;
  offers: readonly Offer[];
  observations: readonly PriceObservation[];
  checks: readonly PriceCheck[];
  now: Date;
}): PriceResolution {
  const { variantId, offers, observations, checks, now } = input;

  const candidates = offers.filter(
    (offer) => offer.variantId === variantId && isPriceableListing(offer)
  );

  let best: Extract<PriceResolution, { status: "available" }> | null = null;
  let fallback: Extract<PriceResolution, { status: "stale" }> | null = null;

  for (const offer of candidates) {
    const observation = latestObservation(offer.id, observations);
    if (!observation) continue;

    if (isFresh(observation.observedAt, now)) {
      const checkedAt =
        lastSuccessfulCheckAt(offer.id, checks) ?? observation.observedAt;
      const candidate = {
        status: "available" as const,
        priceIdr: observation.priceIdr,
        checkedAt,
        offerId: offer.id,
        variantId,
        origin: observation.origin,
      };
      if (!best || candidate.priceIdr < best.priceIdr) best = candidate;
      continue;
    }

    const staleCandidate = {
      status: "stale" as const,
      priceIdr: observation.priceIdr,
      observedAt: observation.observedAt,
      offerId: offer.id,
      variantId,
    };
    if (!fallback || staleCandidate.priceIdr < fallback.priceIdr) {
      fallback = staleCandidate;
    }
  }

  return best ?? fallback ?? { status: "unavailable" };
}

/**
 * Harga "mulai dari" untuk sebuah produk: terendah lintas varian yang layak.
 * Hasilnya selalu membawa `referenceVariantId` supaya UI bisa menyebut varian
 * acuannya dan tidak mencampur basis harga diam-diam (PRD §7 butir 3).
 */
export function resolveStartingPrice(input: {
  variants: readonly Variant[];
  offers: readonly Offer[];
  observations: readonly PriceObservation[];
  checks: readonly PriceCheck[];
  now: Date;
}): StartingPriceResolution {
  const { variants, offers, observations, checks, now } = input;

  let best: StartingPriceResolution | null = null;
  let fallback: StartingPriceResolution | null = null;

  for (const variant of variants) {
    const resolution = resolveVariantPrice({
      variantId: variant.id,
      offers,
      observations,
      checks,
      now,
    });

    if (resolution.status === "available") {
      if (!best || resolution.priceIdr < best.priceIdr) {
        best = { ...resolution, referenceVariantId: variant.id };
      }
    } else if (resolution.status === "stale") {
      if (!fallback || resolution.priceIdr < fallback.priceIdr) {
        fallback = { ...resolution, referenceVariantId: variant.id };
      }
    }
  }

  return best ?? fallback ?? { status: "unavailable" };
}

/**
 * Selisih harga hanya dihitung ketika kedua harga layak (PRD FR-04). Data
 * kosong tidak boleh diperlakukan sebagai nol atau "lebih buruk".
 */
export function priceDifference(
  a: PriceResolution,
  b: PriceResolution
): number | null {
  if (a.status !== "available" || b.status !== "available") return null;
  return a.priceIdr - b.priceIdr;
}

/** Format Rupiah deterministik (tanpa bergantung pada ICU environment). */
export function formatIdr(priceIdr: number): string {
  const grouped = Math.trunc(priceIdr)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp${grouped}`;
}

/**
 * Label waktu pemeriksaan relatif. `now` wajib diberikan supaya hasilnya
 * deterministik dan tidak berbeda antara render server dan client.
 */
export function formatCheckedAt(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "baru saja";
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}
