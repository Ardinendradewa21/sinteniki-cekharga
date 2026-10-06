"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Menghitung satu tayangan iklan bila ≥50% area iklan terlihat selama ≥1 detik
 * terus-menerus (definisi viewable impression IAB/MRC). Dikirim sekali per
 * unit per pemuatan halaman lewat navigator.sendBeacon, tanpa cookie.
 *
 * Contoh iklan (mode pratinjau) tidak dilacak: `creativeId` null.
 */
export function AdViewTracker({
  creativeId,
  slot,
  className,
  children,
}: {
  creativeId: string | null;
  slot: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!creativeId || !node || typeof IntersectionObserver === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      const payload = JSON.stringify({ events: [{ c: creativeId, s: slot }] });
      const ok =
        typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon("/api/ads/impression", new Blob([payload], { type: "application/json" }));
      if (!ok) {
        void fetch("/api/ads/impression", {
          method: "POST",
          body: payload,
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        }).catch(() => {});
      }
      observer.disconnect();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting) && (entry?.intersectionRatio ?? 0) >= 0.5;
        if (visible && document.visibilityState === "visible") {
          timer ??= setTimeout(send, 1000);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.5, 1] }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [creativeId, slot]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
