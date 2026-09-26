import "server-only";

import { headers } from "next/headers";

/**
 * Pembatas laju sliding-window berbasis memori.
 *
 * Jujur soal batasnya: hitungan hidup di satu proses. Di banyak instance
 * (serverless), setiap instance menghitung sendiri sehingga batas efektifnya
 * lebih longgar. Karena itu setiap pemakai sebaiknya memasang DUA lapis:
 * batas per klien, dan batas global per instance yang tidak bisa diakali
 * dengan memalsukan header IP. Kalau butuh batas yang tepat lintas instance,
 * pindahkan penyimpanannya ke store bersama (mis. tabel InsForge/Redis).
 */

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

export type RateLimiter = {
  check(key: string): RateLimitResult;
};

/** Batas jumlah kunci yang dilacak, supaya peta tidak tumbuh tanpa batas. */
const MAX_TRACKED_KEYS = 5000;

export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const hits = new Map<string, number[]>();

  function prune(now: number) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(key);
    }
  }

  return {
    check(key) {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

      if (recent.length >= limit) {
        hits.set(key, recent);
        return {
          allowed: false,
          retryAfterSec: Math.max(
            1,
            Math.ceil((windowMs - (now - recent[0])) / 1000)
          ),
        };
      }

      recent.push(now);
      hits.set(key, recent);

      if (hits.size > MAX_TRACKED_KEYS) {
        prune(now);
        // Kalau semuanya masih aktif (mis. banjir IP palsu), buang yang paling
        // lama dimasukkan. Batas global tetap menahan biaya di kasus ini.
        while (hits.size > MAX_TRACKED_KEYS) {
          const oldest = hits.keys().next().value;
          if (oldest === undefined) break;
          hits.delete(oldest);
        }
      }

      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

/**
 * Identitas klien untuk pembatasan laju.
 *
 * Header IP hanya bisa dipercaya bila ditulis ulang oleh platform/proxy di
 * depan aplikasi (mis. Vercel mengisi `x-real-ip`/`x-forwarded-for`). Tanpa
 * proxy seperti itu, klien bisa mengarangnya, dan itulah alasan batas global
 * per instance tetap wajib ada di samping batas per klien.
 */
export async function clientIp(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get("x-real-ip")?.trim() ||
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "tanpa-ip"
  );
}
