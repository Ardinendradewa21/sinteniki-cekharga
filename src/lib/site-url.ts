/**
 * URL publik situs produksi, dari env `SITE_URL` (mis. https://cekharga.id).
 *
 * Sengaja tidak ada nilai bawaan: domain produksi belum ditetapkan (backlog
 * PB-01), dan URL yang dikarang akan masuk ke sitemap, canonical, dan Open
 * Graph. Tanpa `SITE_URL`, situs dianggap bukan produksi (lokal atau preview
 * Vercel): robots.txt menolak semua crawler supaya domain preview tidak
 * terindeks sebagai konten duplikat, dan sitemap kosong.
 */
export function siteUrl(): URL | null {
  const raw = process.env.SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? new URL(url.origin) : null;
  } catch {
    return null;
  }
}
