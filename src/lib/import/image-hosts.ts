/**
 * Host foto produk yang boleh diunduh importer, dan nama sumbernya.
 *
 * Daftar ini menjaga server dari URL sembarang (SSRF) dan dari sumber yang
 * tidak dikenal. Host yang diizinkan BUKAN berarti fotonya boleh dipakai:
 * dasar hak pakai tetap wajib dipilih admin (image-rights.ts).
 *
 * Modul murni: dipakai pembaca CSV (pratinjau) dan importer gambar (server).
 */

const IMAGE_HOST_SOURCES = new Map<string, string>([
  ["down-id.img.susercontent.com", "Shopee"],
  ["fdn.gsmarena.com", "GSMArena"],
  ["fdn2.gsmarena.com", "GSMArena"],
  // CDN foto katalog Erafone (Eraspace).
  ["cdnpro.eraspace.com", "Erafone"],
  // CDN situs resmi Xiaomi Indonesia (mi.co.id), ditambahkan 2026-10-12.
  ["i02.appmifile.com", "Situs resmi Xiaomi"],
  // CDN situs resmi Samsung (samsung.com/id), ditambahkan 2026-10-14.
  ["images.samsung.com", "Situs resmi Samsung"],
  // CDN situs resmi vivo Indonesia (vivo.com/id), ditambahkan 2026-10-17.
  // Galeri warnanya berupa kanvas lebar 5120x1536 berlatar biru muda; margin
  // dan latarnya dirapikan di pipeline gambar (trim + matte warna sudut).
  ["asia-exstatic-vivofs.vivo.com", "Situs resmi vivo"],
]);

/**
 * Host bernomor yang tidak bisa didaftar satu per satu. Pola dikunci di awal
 * dan akhir supaya subdomain lain di domain yang sama tidak ikut lolos.
 */
const IMAGE_HOST_PATTERNS: readonly (readonly [RegExp, string])[] = [
  // CDN situs resmi Motorola Indonesia (motorola.com/id), ditambahkan
  // 2026-11-11. Galeri per warna memakai p1-, p2-, ... secara bergantian;
  // PNG 1200-1500 px berlatar transparan.
  [/^p\d{1,2}-ofp\.static\.pub$/, "Situs resmi Motorola"],
];

/**
 * Host yang parameter URL-nya mengubah isi berkas, bukan sekadar ukuran.
 * images.samsung.com: `?imbypass=true` dikirim sebagai text/plain dan
 * `?$LazyLoad_Home_JPG$` hanya placeholder 1,7 KB, sedangkan tanpa parameter
 * keluar foto PNG aslinya (diuji 2026-10-14). Parameter dibuang supaya foto
 * yang sama dengan parameter berbeda juga tercatat sekali.
 */
const STRIP_QUERY_HOSTS = new Set(["images.samsung.com"]);

function hostSource(hostname: string): string | null {
  const host = hostname.toLowerCase();
  const listed = IMAGE_HOST_SOURCES.get(host);
  if (listed) return listed;
  for (const [pattern, source] of IMAGE_HOST_PATTERNS) if (pattern.test(host)) return source;
  return null;
}

/** Host foto yang boleh diunduh importer (daftar tetap atau pola bernomor). */
export function isAllowedImageHost(hostname: string): boolean {
  return hostSource(hostname) !== null;
}

/** URL gambar HTTPS dari host yang diizinkan, tanpa kredensial dan port; selain itu null. */
export function safeHttpsImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !isAllowedImageHost(url.hostname)
    ) {
      return null;
    }
    if (STRIP_QUERY_HOSTS.has(url.hostname.toLowerCase())) url.search = "";
    return url;
  } catch {
    return null;
  }
}

/** Nama sumber foto yang ditampilkan sebagai asal foto. */
export function imageSourceName(url: URL): string {
  return hostSource(url.hostname) ?? url.hostname;
}

export const IMAGE_HOST_ISSUE = "URL gambar tidak memakai HTTPS atau host-nya belum diizinkan.";
