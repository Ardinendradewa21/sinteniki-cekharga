import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

/**
 * robots.txt (konvensi file metadata Next.js).
 *
 * - Produksi (`SITE_URL` diisi): situs publik terbuka, area internal ditutup,
 *   sitemap diumumkan.
 * - Selain produksi: semua crawler ditolak, supaya preview *.vercel.app atau
 *   staging tidak bersaing dengan domain asli di mesin pencari.
 *
 * Catatan: robots.txt bukan pengamanan. Admin dan API tetap dilindungi
 * autentikasi server; ini hanya memberi tahu crawler mana yang tidak perlu
 * dirayapi.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  if (!base) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/style-guide"],
    },
    sitemap: new URL("/sitemap.xml", base).href,
  };
}
