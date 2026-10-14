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
]);

/**
 * Host yang parameter URL-nya mengubah isi berkas, bukan sekadar ukuran.
 * images.samsung.com: `?imbypass=true` dikirim sebagai text/plain dan
 * `?$LazyLoad_Home_JPG$` hanya placeholder 1,7 KB, sedangkan tanpa parameter
 * keluar foto PNG aslinya (diuji 2026-10-14). Parameter dibuang supaya foto
 * yang sama dengan parameter berbeda juga tercatat sekali.
 */
const STRIP_QUERY_HOSTS = new Set(["images.samsung.com"]);

export const ALLOWED_IMAGE_HOSTS: ReadonlySet<string> = new Set(IMAGE_HOST_SOURCES.keys());

/** URL gambar HTTPS dari host yang diizinkan, tanpa kredensial dan port; selain itu null. */
export function safeHttpsImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase())
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
  return IMAGE_HOST_SOURCES.get(url.hostname.toLowerCase()) ?? url.hostname;
}

export const IMAGE_HOST_ISSUE = "URL gambar tidak memakai HTTPS atau host-nya belum diizinkan.";
