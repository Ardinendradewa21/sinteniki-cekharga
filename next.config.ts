import type { NextConfig } from "next";

/**
 * Jumlah worker paralel saat build.
 *
 * Secara default Next memakai banyak worker sekaligus (di mesin ini 11). Itu
 * cepat kalau memorinya lega, tetapi pada mesin yang RAM bebasnya sedang tipis
 * seluruh worker berebut memori dan build gagal dengan "JavaScript heap out of
 * memory" — kegagalan yang terlihat seperti bug kode padahal bukan.
 *
 * Nilainya sengaja TIDAK dipatok di sini supaya mesin yang memorinya lega tetap
 * memakai default Next yang cepat. Kalau build gagal karena kehabisan memori,
 * jalankan dengan pembatas:
 *
 *   CEKHARGA_BUILD_CPUS=2 pnpm build
 */
const buildCpus = Number(process.env.CEKHARGA_BUILD_CPUS);

const insforgeStorageHostname = (() => {
  try {
    const url = new URL(process.env.INSFORGE_URL ?? "");
    return url.protocol === "https:" ? url.hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    /*
      AVIF lebih dulu, WebP sebagai cadangan (dokumentasi Next 16: urutan
      menentukan format yang dipilih dari header Accept). Foto scene tema
      Verdant dan foto produk ikut lebih ringan di HP (DESIGN.md §6.2).
    */
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Thumbnail video ulasan (RV-01): sampul dari YouTube sebelum pemutar dimuat.
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      ...(insforgeStorageHostname
        ? [
            {
              protocol: "https" as const,
              hostname: insforgeStorageHostname,
              pathname: "/api/storage/buckets/product-images/objects/**",
            },
            {
              // Materi iklan mitra (slot iklan situs publik).
              protocol: "https" as const,
              hostname: insforgeStorageHostname,
              pathname: "/api/storage/buckets/ad-creatives/objects/**",
            },
          ]
        : []),
    ],
  },
  experimental: {
    ...(Number.isFinite(buildCpus) && buildCpus > 0 ? { cpus: buildCpus } : {}),
    // `inlineCss` dicoba di audit 004 no. 2: FCP/LCP tidak berubah di luar
    // derau pengukuran, padahal CSS jadi tidak bisa di-cache terpisah. Tidak dipakai.
    serverActions: {
      /**
       * Batas bawaan Server Action adalah 1 MB, dan berkas CSV dataset
       * spesifikasi gampang melewatinya. Dinaikkan seperlunya saja: batas ini
       * juga yang menahan pengiriman payload raksasa, jadi menaikkannya
       * berlebihan berarti membuka pintu yang tidak perlu.
       */
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
