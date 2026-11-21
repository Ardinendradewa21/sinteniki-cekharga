export type AdminTheme = "light" | "dark";

export const ADMIN_THEME_COOKIE = "cekharga_admin_theme";

/**
 * Filter terakhir di Kelola produk (AV-02, keputusan PO 20 Nov 2026): isi
 * query string `q`/`brand`/`page`. Dipulihkan saat admin kembali ke
 * `/admin/products` tanpa parameter (tombol kembali, menu samping, breadcrumb).
 */
export const ADMIN_PRODUCT_FILTER_COOKIE = "cekharga_admin_produk_filter";
