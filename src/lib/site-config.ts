/**
 * Identitas penerbit dan tautan luar CekHarga.
 *
 * ATURAN: `null` berarti "belum ada", dan footer merendernya sebagai teks
 * berlabel "segera" — BUKAN tautan mati, `href="#"`, atau akun yang belum
 * tentu ada. Menampilkan tautan sosial yang tidak menuju ke mana-mana sama
 * menyesatkannya dengan tautan legal palsu yang sejak awal dilarang di footer.
 *
 * Cara mengisinya nanti: ganti `null` dengan string. Tidak ada tempat lain yang
 * perlu disentuh; footer, halaman FAQ, dan Ketentuan Layanan membaca dari sini.
 */

export const COMPANY = {
  /** Badan hukum yang menerbitkan CekHarga. */
  legalName: "PT Sinteniki",
  /** Nama yang dipakai perusahaan di situs resminya. */
  brandName: "Sinteniki Agency",
  product: "CekHarga",
  /**
   * Alamat kantor terdaftar. Masih null karena situs resmi sinteniki.com tidak
   * mencantumkannya, dan alamat perusahaan bukan hal yang boleh dikira-kira.
   */
  address: null as string | null,
  /** Email publik. Belum ada di situs resmi, jadi tetap null. */
  email: null as string | null,
  /** Nomor WhatsApp yang tercantum di sinteniki.com. */
  whatsapp: "6285810582323" as string | null,
  phone: null as string | null,
  /** Situs perusahaan induk. */
  website: "https://sinteniki.com" as string | null,
} as const;

export type SocialLink = {
  label: string;
  /** Ditulis apa adanya di footer, mis. "@cekharga.id". */
  handle: string | null;
  href: string | null;
};

/*
 * Situs resmi memasang ikon Instagram, Facebook, dan TikTok, tetapi URL-nya
 * dirender lewat JavaScript sehingga tidak bisa dibaca dari HTML. Karena itu
 * href-nya dibiarkan null: menebak alamat akun berisiko mengarahkan pengunjung
 * ke akun yang salah atau tidak ada. Isi begitu URL aslinya diketahui.
 */
export const SOCIAL_LINKS: readonly SocialLink[] = [
  { label: "Instagram", handle: null, href: null },
  { label: "Facebook", handle: null, href: null },
  { label: "TikTok", handle: null, href: null },
  { label: "WhatsApp", handle: "+62 858-1058-2323", href: "https://wa.me/6285810582323" },
] as const;

/**
 * Halaman pendukung di footer. Sama seperti MAIN_NAV, setiap entri di sini
 * wajib punya route yang benar-benar ada.
 */
export const SUPPORT_NAV = [
  {
    href: "/faq",
    label: "Pertanyaan Umum",
    description: "Jawaban singkat untuk yang paling sering ditanyakan.",
  },
  {
    href: "/how-it-works",
    label: "Cara Kerja",
    description: "Sumber data, arti harga, dan keterbatasan.",
  },
  {
    href: "/terms",
    label: "Ketentuan Layanan",
    description: "Ruang lingkup layanan, batasan, dan tanggung jawab.",
  },
] as const;

/**
 * Tanggal draf dokumen legal. Dinaikkan manual saat isinya benar-benar diubah,
 * bukan otomatis dari tanggal build, supaya pembaca tahu versi yang mereka baca.
 */
export const LEGAL_LAST_UPDATED = "9 September 2026";
