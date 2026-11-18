import { Urbanist } from "next/font/google";

/**
 * Font workspace admin (tema Veyla, AV-01). Dimuat hanya dari layout admin
 * supaya halaman publik tidak ikut mengunduh/preload Urbanist. Variabelnya
 * dipakai `.admin-theme` di globals.css; angka tabular tetap Plus Jakarta Sans
 * karena Urbanist tidak punya `tnum`.
 */
export const adminFont = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
