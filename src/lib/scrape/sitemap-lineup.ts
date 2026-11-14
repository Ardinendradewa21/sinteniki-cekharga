/**
 * Daftar model dari sitemap resmi merek (14 November 2026).
 *
 * Untuk merek tanpa harga online, daftar model dulu diambil dari dua halaman
 * daftar merek GSMArena (±80 model global, termasuk yang tidak dijual di
 * Indonesia). Sitemap resmi Indonesia lebih tepat (hanya model yang dipasarkan
 * di sini) dan mengurangi permintaan ke GSMArena, yang sejak 13 November 2026
 * membatasi akses. GSMArena tetap dipakai untuk halaman spesifikasi.
 *
 * Generik: merek lain cukup menambah konfigurasi (URL sitemap, pola path
 * ponsel, cara membentuk nama). Survei 14 November 2026: Tecno, Honor, dan
 * Huawei punya sitemap Indonesia; realme dan itel tidak.
 *
 * Murni (tanpa jaringan) supaya bisa diuji; pengambilan ada di sources.ts.
 */

export type SitemapLineupConfig = {
  /** Sitemap resmi yang dibaca. */
  sitemapUrl: string;
  /** Hanya URL di host ini yang diterima (bukan tautan ke situs lain). */
  host: string;
  /** Path halaman ponsel, mis. `/id/id/p/phones/<seri>/<model>/<kode>`. */
  pathPattern: RegExp;
  /** Nama model yang dicocokkan ke GSMArena, atau null bila bukan ponsel. */
  nameFromPath: (pathname: string) => string | null;
};

export type SitemapModel = { id: string; name: string; url: string };

/** Semua URL ponsel unik dari isi sitemap, beserta nama turunannya. */
export function lineupFromSitemap(xml: string, config: SitemapLineupConfig): SitemapModel[] {
  const seen = new Set<string>();
  const models: SitemapModel[] = [];
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    let url: URL;
    try {
      url = new URL(match[1].replace(/&amp;/g, "&"));
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || url.hostname !== config.host) continue;
    const path = url.pathname.replace(/\/+$/, "");
    if (!config.pathPattern.test(path) || seen.has(path)) continue;
    const name = config.nameFromPath(path);
    if (!name) continue;
    seen.add(path);
    models.push({ id: path.split("/").filter(Boolean).slice(-3).join("/"), name, url: `https://${url.hostname}${path}` });
  }
  return models;
}

/* ------------------------------------------------------------- Motorola */

const MOTOROLA_PHONE = /^\/id\/id\/p\/phones\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9]+$/;

function titleWord(word: string): string {
  if (/^\d+g$/i.test(word)) return word.toUpperCase();
  return word;
}

/**
 * Nama model Motorola dari path sitemap Indonesia:
 *   moto-g/45                                  -> "moto g45"
 *   moto-g/57-power-5g                         -> "moto g57 power 5G"
 *   moto-g/g06-power                           -> "moto g06 power"
 *   motorola-edge/60-fusion                    -> "motorola edge 60 fusion"
 *   motorola-edge/motorola-edge-70-fusion-7000mah -> "motorola edge 70 fusion"
 *   motorola-signature/signature               -> "motorola signature"
 *   razr/razr-fold                             -> "razr fold"
 * Kapasitas baterai di slug (mis. "7000mah") bukan bagian nama model.
 */
export function motorolaNameFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const at = parts.indexOf("phones");
  const series = parts[at + 1];
  const slug = parts[at + 2];
  if (at < 0 || !series || !slug) return null;

  const seriesWords = series.split("-");
  let words = slug.split("-").filter((word) => !/^\d+mah$/i.test(word));
  // Slug yang mengulang nama seri: "motorola-edge-70-fusion", "razr-60".
  if (seriesWords.every((word, i) => words[i] === word)) words = words.slice(seriesWords.length);
  // Slug yang mengulang kata terakhir seri saja: seri "motorola-signature", slug "signature".
  else if (words[0] === seriesWords[seriesWords.length - 1]) words = words.slice(1);

  const last = seriesWords[seriesWords.length - 1];
  if (/^[a-z]$/.test(last) && words[0]) {
    // Seri satu huruf (moto g): angka model ditempel ke hurufnya, "g" + "45" = "g45".
    if (/^\d/.test(words[0])) {
      return [...seriesWords.slice(0, -1), `${last}${words[0]}`, ...words.slice(1)].map(titleWord).join(" ");
    }
    // Slug sudah membawa hurufnya ("g06-power"): jangan ditulis dua kali.
    if (new RegExp(`^${last}\\d`).test(words[0])) {
      return [...seriesWords.slice(0, -1), ...words].map(titleWord).join(" ");
    }
  }
  return [...seriesWords, ...words].map(titleWord).join(" ").trim() || null;
}

export const MOTOROLA_SITEMAP_LINEUP: SitemapLineupConfig = {
  sitemapUrl: "https://www.motorola.com/id/id/sitemap.xml",
  host: "www.motorola.com",
  pathPattern: MOTOROLA_PHONE,
  nameFromPath: motorolaNameFromPath,
};
