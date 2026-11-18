import { Urbanist } from "next/font/google";

/**
 * Font utama CekHarga sejak tema Calda (CD-00, keputusan PO 18 November
 * 2026), dipakai situs publik dan admin. Dipasang sebagai variabel
 * `--font-urbanist` di <html> (root layout).
 *
 * Urbanist tidak punya angka tabular (fitur `tnum`; terukur: lebar digit "1"
 * kurang dari separuh digit lain), jadi angka yang harus sejajar (`.tabular`,
 * `tabular-nums`: harga, jumlah, kolom tabel) memakai Plus Jakarta Sans lewat
 * globals.css.
 */
export const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
