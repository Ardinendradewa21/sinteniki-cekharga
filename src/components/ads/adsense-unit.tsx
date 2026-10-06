"use client";

import Script from "next/script";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { readAdConsent, subscribeAdConsent } from "@/components/ads/consent-store";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Cadangan AdSense untuk slot yang tidak terjual (fallback = "adsense").
 * Hanya dimuat bila pengunjung menyetujui iklan pihak ketiga (UU PDP); tanpa
 * persetujuan, slot tetap kosong dan tidak memuat skrip Google apa pun.
 */
export function AdsenseUnit({ client, slotId, className }: { client: string; slotId: string; className?: string }) {
  const consent = useSyncExternalStore(subscribeAdConsent, readAdConsent, () => null);
  const pushed = useRef(false);

  useEffect(() => {
    if (consent !== "all" || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Skrip diblokir (ad blocker) atau belum siap; slot dibiarkan kosong.
    }
  }, [consent]);

  if (consent !== "all") return null;
  return (
    <div className={className}>
      <Script
        id="adsbygoogle-js"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
        strategy="lazyOnload"
        crossOrigin="anonymous"
      />
      <ins
        className="adsbygoogle block"
        data-ad-client={client}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
