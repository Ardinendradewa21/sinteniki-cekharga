/**
 * Halaman kebutuhan (PB-29), mis. "HP 5G di bawah Rp3 juta". Modul murni.
 *
 * Setiap halaman hanyalah pencarian katalog yang sudah ada, dengan kalimat
 * yang dipahami pencarian semantik (5G, NFC, RAM/penyimpanan minimal, batas
 * harga). Tidak ada kurasi tangan dan tidak ada label "terbaik".
 *
 * Halaman HANYA tampil bila minimal `MIN_FRESH_PRODUCTS` produk lolos dengan
 * harga segar. Filter harga katalog memang hanya menghitung harga segar, jadi
 * halaman dengan harga basi tidak pernah terbit diam-diam. Bila syaratnya
 * tidak terpenuhi, halaman mengembalikan 404 dan tidak masuk sitemap.
 */

export const MIN_FRESH_PRODUCTS = 3;

export type NeedPage = {
  slug: string;
  title: string;
  intro: string;
  /** Kalimat pencarian katalog; harus dipahami `semantic-needs.ts`. */
  query: string;
};

export const NEED_PAGES: readonly NeedPage[] = [
  {
    slug: "hp-5g-di-bawah-3-juta",
    title: "HP 5G di Bawah Rp3 Juta",
    intro: "Smartphone yang tercatat mendukung 5G dengan harga segar di bawah Rp3 juta untuk varian acuannya.",
    query: "5G di bawah 3 juta",
  },
  {
    slug: "hp-nfc-di-bawah-2-5-juta",
    title: "HP NFC di Bawah Rp2,5 Juta",
    intro: "Smartphone yang tercatat punya NFC, misalnya untuk isi saldo uang elektronik, dengan harga segar di bawah Rp2,5 juta.",
    query: "NFC di bawah 2,5 juta",
  },
  {
    slug: "hp-ram-8gb-di-bawah-4-juta",
    title: "HP RAM 8 GB di Bawah Rp4 Juta",
    intro: "Smartphone dengan varian RAM minimal 8 GB dan harga segar di bawah Rp4 juta.",
    query: "RAM minimal 8 GB di bawah 4 juta",
  },
  {
    slug: "hp-memori-256gb-di-bawah-5-juta",
    title: "HP Penyimpanan 256 GB di Bawah Rp5 Juta",
    intro: "Smartphone dengan varian penyimpanan minimal 256 GB dan harga segar di bawah Rp5 juta.",
    query: "penyimpanan minimal 256 GB di bawah 5 juta",
  },
  {
    slug: "hp-5g-nfc-di-bawah-5-juta",
    title: "HP 5G dan NFC di Bawah Rp5 Juta",
    intro: "Smartphone yang tercatat mendukung 5G sekaligus punya NFC, dengan harga segar di bawah Rp5 juta.",
    query: "5G NFC di bawah 5 juta",
  },
];

export function findNeedPage(slug: string): NeedPage | null {
  return NEED_PAGES.find((page) => page.slug === slug) ?? null;
}

export function needPagePath(page: Pick<NeedPage, "slug">): string {
  return `/hp/${page.slug}`;
}

/** Halaman layak terbit bila produk berharga segar yang lolos mencapai batas. */
export function needPageQualifies(freshMatches: number): boolean {
  return freshMatches >= MIN_FRESH_PRODUCTS;
}
