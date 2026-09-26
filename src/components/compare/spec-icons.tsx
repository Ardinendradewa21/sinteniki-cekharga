import type { ReactNode } from "react";

import type { CompareSpecIcon } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";

/**
 * Ikon garis untuk atribut perbandingan.
 *
 * Digambar sendiri untuk CekHarga dengan gaya lembar spesifikasi produsen
 * (garis tipis, sudut membulat, titik lensa terisi), bukan salinan aset merek
 * mana pun. Semua memakai `currentColor`, jadi mengikuti tema terang/gelap.
 * Dekoratif: labelnya selalu tertulis di sebelahnya, jadi `aria-hidden`.
 */
const PATHS: Record<CompareSpecIcon, ReactNode> = {
  display: (
    <>
      <rect x="12" y="4.5" width="16" height="31" rx="3" />
      <path d="M16.5 26.5 23.5 13.5M23.5 13.5h-4.2M23.5 13.5v4.2M16.5 26.5h4.2M16.5 26.5v-4.2" />
    </>
  ),
  refresh: (
    <>
      <rect x="12" y="4.5" width="16" height="31" rx="3" />
      <path d="M24.2 17.2a4.6 4.6 0 0 0-8.3 1.4M15.8 22.8a4.6 4.6 0 0 0 8.3-1.4" />
      <path d="M24.4 13.8v3.6h-3.6M15.6 26.2v-3.6h3.6" />
    </>
  ),
  chip: (
    <>
      <rect x="11" y="11" width="18" height="18" rx="2.5" />
      <rect x="15.5" y="15.5" width="9" height="9" rx="1" />
      <path d="M15 7v4M20 7v4M25 7v4M15 29v4M20 29v4M25 29v4M7 15h4M7 20h4M7 25h4M29 15h4M29 20h4M29 25h4" />
    </>
  ),
  os: (
    <>
      <rect x="12" y="4.5" width="16" height="31" rx="3" />
      <rect x="15.5" y="11" width="3.6" height="3.6" rx="1" />
      <rect x="20.9" y="11" width="3.6" height="3.6" rx="1" />
      <rect x="15.5" y="16.4" width="3.6" height="3.6" rx="1" />
      <rect x="20.9" y="16.4" width="3.6" height="3.6" rx="1" />
      <path d="M18 31h4" />
    </>
  ),
  camera: (
    <>
      <path d="M10 34V10a3.5 3.5 0 0 1 3.5-3.5H31" />
      <rect x="12.8" y="9.5" width="6.4" height="19" rx="3.2" />
      <circle cx="16" cy="13" r="1.9" fill="currentColor" />
      <circle cx="16" cy="19" r="1.9" fill="currentColor" />
      <circle cx="16" cy="25" r="1.9" fill="currentColor" />
      <circle cx="23" cy="12.5" r="0.9" />
    </>
  ),
  lenses: (
    <>
      <rect x="9" y="9" width="22" height="22" rx="5" />
      <circle cx="15.5" cy="15.5" r="3" />
      <circle cx="24.5" cy="15.5" r="3" />
      <circle cx="15.5" cy="24.5" r="3" />
      <circle cx="24.5" cy="24.5" r="1" fill="currentColor" />
    </>
  ),
  battery: (
    <>
      <rect x="13" y="8" width="14" height="27" rx="3" />
      <path d="M17.5 8V5.5h5V8" />
      <rect x="15.8" y="15" width="8.4" height="17" rx="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  charging: (
    <>
      <rect x="13" y="8" width="14" height="27" rx="3" />
      <path d="M17.5 8V5.5h5V8" />
      <path d="M21.2 13.5 16.8 21.6h4.4l-2.4 8 5-9.2h-4.4z" fill="currentColor" strokeLinejoin="round" />
    </>
  ),
  memory: (
    <>
      <rect x="7" y="13" width="26" height="14" rx="2" />
      <path d="M11 9.5V13M15 9.5V13M19 9.5V13M23 9.5V13M27 9.5V13M11 27v3.5M15 27v3.5M19 27v3.5M23 27v3.5M27 27v3.5" />
    </>
  ),
  storage: (
    <>
      <circle cx="20" cy="20" r="13" />
      <circle cx="20" cy="20" r="5" />
      <path d="M20 7v8M24.3 23.2l7.6 3.1" />
    </>
  ),
  weight: (
    <>
      <path d="M15.5 13.5a4.5 4.5 0 1 1 9 0" />
      <path d="M12.6 14.5h14.8l3.6 18.5a1.6 1.6 0 0 1-1.6 1.9H10.6A1.6 1.6 0 0 1 9 33l3.6-18.5z" />
    </>
  ),
  water: (
    <path d="M20 5.5c-5.3 7.4-9 12.4-9 17.4a9 9 0 0 0 18 0c0-5-3.7-10-9-17.4z" />
  ),
  palette: (
    <>
      <circle cx="15.5" cy="16" r="6.5" />
      <circle cx="24.5" cy="16" r="6.5" />
      <circle cx="20" cy="24" r="6.5" />
    </>
  ),
  network: (
    <>
      <path d="M9 31v-3M15.5 31v-7M22 31v-11M28.5 31V16" strokeWidth="3" />
      <path d="M26 10.5a8 8 0 0 1 5.5 2.3M27.6 7a12 12 0 0 1 7.4 3.1" />
    </>
  ),
  nfc: (
    <>
      <rect x="8" y="6.5" width="14" height="27" rx="3" />
      <path d="M26 15.5a6 6 0 0 1 0 9M29.5 12.5a10.5 10.5 0 0 1 0 15" />
    </>
  ),
  jack: (
    <>
      <path d="M9 25v-4a11 11 0 0 1 22 0v4" />
      <rect x="7" y="23" width="6" height="10" rx="2" />
      <rect x="27" y="23" width="6" height="10" rx="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="8" y="9" width="24" height="23" rx="3" />
      <path d="M8 16h24M14 6v6M26 6v6" />
      <path d="M13.5 21.5h3M18.5 21.5h3M23.5 21.5h3M13.5 26.5h3M18.5 26.5h3" />
    </>
  ),
  shield: (
    <>
      <path d="M20 5.5 9 9.5v9.2c0 7.3 4.7 12.6 11 15.8 6.3-3.2 11-8.5 11-15.8V9.5z" />
      <path d="m15.5 20 3.2 3.2 6-6.4" />
    </>
  ),
};

export function SpecIcon({
  name,
  className,
}: {
  name: CompareSpecIcon;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("size-10", className)}
    >
      {PATHS[name]}
    </svg>
  );
}
