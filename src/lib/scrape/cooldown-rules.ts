/**
 * Masa tenang setelah sumber membatasi akses (anti-bot, 403/429).
 *
 * Begitu sebuah host memblokir, tarik otomatis tidak menghubunginya lagi
 * selama masa tenang: tombol, antrean, worker, dan cron semuanya menahan diri.
 * Mencoba berulang kali tepat setelah diblokir sama dengan memaksa masuk dan
 * biasanya memperpanjang blokirnya (temuan 13 November 2026, GSMArena).
 *
 * Murni (tanpa jaringan dan database) supaya bisa diuji.
 */

/** Lama masa tenang setelah blokir terakhir, dalam jam. */
export const BLOCK_COOLDOWN_HOURS = 6;

/** Akhir masa tenang, atau null bila sudah lewat / belum pernah diblokir. */
export function cooldownUntil(
  lastBlockedAt: string | null,
  now: number = Date.now(),
  hours: number = BLOCK_COOLDOWN_HOURS
): Date | null {
  if (!lastBlockedAt) return null;
  const blocked = Date.parse(lastBlockedAt);
  if (Number.isNaN(blocked)) return null;
  const until = blocked + hours * 3_600_000;
  return until > now ? new Date(until) : null;
}

/** "14.30 WIB", atau "15 Nov 14.30 WIB" bila bukan hari yang sama (zona Asia/Jakarta). */
export function formatCooldownTime(until: Date, now: number = Date.now()): string {
  const day = (value: number) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(until)
    .replace(":", ".");
  if (day(until.getTime()) === day(now)) return `${time} WIB`;
  const date = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" }).format(until);
  return `${date} ${time} WIB`;
}

/** Pesan untuk admin selama masa tenang. */
export function cooldownMessage(host: string, until: Date, now: number = Date.now()): string {
  const label = host === "www.gsmarena.com" ? "GSMArena" : host;
  return `${label} sedang membatasi akses CekHarga. Tarik otomatis menunggu sampai ${formatCooldownTime(until, now)} supaya blokirnya tidak diperpanjang. Untuk model yang mendesak, pakai Salin spesifikasi dari browser.`;
}
