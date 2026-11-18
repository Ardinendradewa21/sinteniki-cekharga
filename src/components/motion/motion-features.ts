import { domMax } from "motion/react"

/**
 * Fitur animasi Motion yang dimuat MALAS lewat `LazyMotion` (audit 004 no. 2).
 *
 * `domMax` (bukan `domAnimation`) karena situs memakai `layoutId` (penanda
 * navigasi, tab bar, chip, segmented control) dan animasi layout. Berkas ini
 * hanya diimpor secara dinamis dari `motion-provider.tsx`, jadi kodenya tidak
 * ikut dieksekusi di jalur kritis sebelum konten pertama tampil.
 */
export default domMax
