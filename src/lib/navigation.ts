/**
 * Satu sumber untuk navigasi situs, dipakai header dan footer.
 *
 * PRD §4: "Hanya tampilkan navigasi yang memiliki tujuan berfungsi."
 * Setiap entri di sini WAJIB punya route yang benar-benar ada. Jangan menambah
 * item untuk halaman yang belum dibuat.
 *
 * /admin sengaja tidak ada di sini: aksesnya terproteksi dan dikerjakan bersama
 * backend (PRD §11 Irisan B), bukan bagian navigasi publik.
 */
export type NavItem = {
  href: string;
  label: string;
  description: string;
};

export const MAIN_NAV: readonly NavItem[] = [
  {
    href: "/",
    label: "Beranda",
    description: "Ringkasan cara CekHarga membantu memilih.",
  },
  {
    href: "/products",
    label: "Produk",
    description: "Cari dan saring katalog smartphone.",
  },
  {
    href: "/compare",
    label: "Bandingkan",
    description: "Sandingkan 2–3 produk beserta variannya.",
  },
  {
    href: "/assistant",
    label: "Tanya AI",
    description: "Jelaskan kebutuhan, dapatkan kandidat beralasan.",
  },
  {
    href: "/how-it-works",
    label: "Cara Kerja",
    description: "Sumber data, arti harga, dan keterbatasan.",
  },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
