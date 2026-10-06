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
  images: insforgeStorageHostname
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: insforgeStorageHostname,
            pathname: "/api/storage/buckets/product-images/objects/**",
          },
          {
            // Materi iklan mitra (slot iklan situs publik).
            protocol: "https",
            hostname: insforgeStorageHostname,
            pathname: "/api/storage/buckets/ad-creatives/objects/**",
          },
        ],
      }
    : undefined,
  experimental: {
    ...(Number.isFinite(buildCpus) && buildCpus > 0 ? { cpus: buildCpus } : {}),
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
