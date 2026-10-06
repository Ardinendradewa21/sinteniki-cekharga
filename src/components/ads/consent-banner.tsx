"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { readAdConsent, subscribeAdConsent, writeAdConsent } from "@/components/ads/consent-store";
import { Button } from "@/components/ui/button";

/**
 * Banner persetujuan iklan pihak ketiga (UU PDP). Hanya dirender layout bila
 * ada mitra pihak ketiga yang aktif (mis. AdSense). Dua pilihan setara,
 * tanpa pola gelap: menolak sama mudahnya dengan menerima.
 */
export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribeAdConsent, readAdConsent, () => "pending" as const);
  if (consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Persetujuan iklan"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-border bg-card p-4 shadow-xl sm:p-5 print:hidden"
    >
      <p className="text-sm leading-relaxed text-foreground">
        Kami bisa menampilkan iklan dari mitra pihak ketiga yang memakai cookie untuk mengukur dan
        menyesuaikan iklan. Iklan langsung dari CekHarga tetap tampil tanpa cookie apa pun pilihan Anda.{" "}
        <Link href="/terms" className="font-semibold text-brand underline underline-offset-2">
          Selengkapnya
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" className="min-h-11" onClick={() => writeAdConsent("all")}>
          Izinkan iklan pihak ketiga
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => writeAdConsent("essential")}>
          Hanya yang diperlukan
        </Button>
      </div>
    </div>
  );
}
