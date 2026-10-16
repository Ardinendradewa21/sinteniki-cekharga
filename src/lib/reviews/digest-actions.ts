"use server";

import { z } from "zod";

import { rateLimit } from "@/lib/assistant/ai/client";
import { consumeDailyQuota, quotaMessage } from "@/lib/assistant/ai/quota";
import { MAX_COMPARE_ITEMS, MIN_COMPARE_ITEMS } from "@/lib/catalog/compare-href";
import { getComparison } from "@/lib/catalog/queries";
import { digestProducts, generateDigest, readCachedDigest } from "@/lib/reviews/digest";
import { countNotes, digestCacheKey, MIN_NOTES_FOR_DIGEST, type ReviewDigest } from "@/lib/reviews/digest-rules";
import { clientIp } from "@/lib/rate-limit";

type DigestResult = { ok: true; digest: ReviewDigest } | { ok: false; error: string };

const slugsSchema = z
  .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
  .min(MIN_COMPARE_ITEMS)
  .max(MAX_COMPARE_ITEMS);

/**
 * Rangkuman AI ulasan reviewer untuk produk yang sedang dibandingkan (PB-40).
 * Hasil cache dikembalikan tanpa memakai kuota. Panggilan model baru melewati
 * pembatas per menit dan kuota harian yang sama dengan Tanya AI (aturan
 * system design 1), dan gagal dengan pesan, bukan halaman rusak (aturan 7).
 */
export async function summarizeReviewsAction(slugs: string[]): Promise<DigestResult> {
  const parsed = slugsSchema.safeParse([...new Set(slugs)]);
  if (!parsed.success) return { ok: false, error: "Pilih dua atau tiga produk untuk dirangkum." };

  const result = await getComparison(
    new Date(),
    parsed.data.map((slug) => ({ slug, variantKey: null }))
  ).catch(() => null);
  if (!result || result.items.length < MIN_COMPARE_ITEMS) return { ok: false, error: "Produk tidak ditemukan." };

  const products = digestProducts(result);
  if (countNotes(products) < MIN_NOTES_FOR_DIGEST) {
    return { ok: false, error: "Ringkasan reviewer untuk produk ini belum cukup untuk dirangkum." };
  }

  const cached = await readCachedDigest(digestCacheKey(products));
  if (cached) return { ok: true, digest: cached };

  const ip = await clientIp();
  const limit = rateLimit(ip);
  if (!limit.allowed) return { ok: false, error: `Terlalu cepat. Coba lagi dalam ${limit.retryAfterSec} detik.` };
  const quota = await consumeDailyQuota(ip);
  if (!quota.allowed) return { ok: false, error: quotaMessage(quota.reason).replace("Tanya AI", "Rangkuman AI") };

  const digest = await generateDigest(products);
  return digest
    ? { ok: true, digest }
    : { ok: false, error: "Rangkuman AI sedang tidak bisa dibuat. Ringkasan asli tiap reviewer tetap bisa dibaca di atas." };
}
