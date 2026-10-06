/** Waktu ISO → nilai input datetime-local dalam WIB (UTC+7, tanpa DST). */
export function toJakartaLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function formatJakarta(iso: string | null, withTime = true): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}
