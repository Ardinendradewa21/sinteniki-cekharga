"use client";

import { animate, inView } from "motion/react";
import { useId, useLayoutEffect, useRef } from "react";

import { Marker, seriesStyle } from "@/components/product/price-history-marks";
import type { ChartGeometry } from "@/lib/catalog/price-history-rules";
import { transition } from "@/lib/motion";

/** Label sumbu dibulatkan ke terdekat (Rp20 jt untuk Rp19.999.000), bukan dipotong ke bawah. */
function axisIdr(priceIdr: number): string {
  if (priceIdr >= 1_000_000) return `Rp${(Math.round(priceIdr / 100_000) / 10).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return `Rp${Math.round(priceIdr / 1000)} rb`;
}

function wibDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

const PLOT_LEFT = 76;

/**
 * Grafik riwayat harga (PB-36, DESIGN.md §7 Price History, VD-06).
 *
 * Garis tangga: harga berlaku sampai pemeriksaan berikutnya; titik = pemeriksaan
 * nyata; segmen yang melintasi celah "tidak diperiksa" putus-putus. Tanpa garis
 * perkiraan dan tanpa label "terendah".
 *
 * Data reveal sekali (DESIGN.md §8): seri terbuka dari kiri ke kanan selama
 * 900 ms lewat klip yang digeser dari kiri (transform translateX, bukan
 * stroke-dashoffset yang mengulang di tiap subpath garis tangga, dan bukan
 * scaleX karena Motion memaksa titik asal transform SVG ke tengah). Aturannya sama dengan Reveal:
 * HTML server berisi grafik lengkap; hanya grafik yang awalnya di bawah
 * lipatan yang ditutup sebelum paint lalu dibuka saat terlihat. Tanpa
 * JavaScript dan dengan reduced motion, grafik langsung lengkap.
 */
export function PriceHistoryChart({ mobile, desktop }: { mobile: ChartGeometry; desktop: ChartGeometry }) {
  const root = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    const clips = Array.from(element.querySelectorAll<SVGRectElement>("[data-reveal-clip]"));
    // Klip digeser sejauh lebarnya ke kiri: grafik tertutup penuh.
    const offset = (clip: SVGRectElement) => -Number(clip.getAttribute("width") ?? 0);
    for (const clip of clips) clip.style.transform = `translateX(${offset(clip)}px)`;
    const controls: ReturnType<typeof animate>[] = [];
    const stop = inView(
      element,
      () => {
        for (const clip of clips) controls.push(animate(clip, { x: [offset(clip), 0] }, transition.dataReveal));
        stop();
      },
      { margin: "0px 0px -64px 0px" }
    );
    return () => {
      stop();
      for (const control of controls) control.stop();
      for (const clip of clips) clip.style.transform = "";
    };
  }, []);

  return (
    <div ref={root}>
      <ChartSvg geometry={mobile} clipId={`${id}m`} className="h-auto w-full sm:hidden" />
      <ChartSvg geometry={desktop} clipId={`${id}d`} className="hidden h-auto w-full sm:block" />
    </div>
  );
}

function ChartSvg({ geometry, clipId, className }: { geometry: ChartGeometry; clipId: string; className: string }) {
  return (
    <svg
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      className={className}
      role="img"
      aria-label="Grafik riwayat harga; data lengkapnya ada di tabel di bawah grafik."
    >
      <defs>
        <clipPath id={clipId}>
          {/* Area plot plus ruang penanda di tepi kanan. */}
          <rect data-reveal-clip x={PLOT_LEFT - 6} y={0} width={geometry.width - PLOT_LEFT + 6} height={geometry.height} />
        </clipPath>
      </defs>
      {geometry.yTicks.map((tick) => (
        <g key={tick.y}>
          <line x1={PLOT_LEFT} x2={geometry.width - 16} y1={tick.y} y2={tick.y} className="stroke-border" strokeWidth={1} />
          <text x={66} y={tick.y + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            {axisIdr(tick.priceIdr)}
          </text>
        </g>
      ))}
      {geometry.xTicks.map((tick) => (
        <text key={tick.x} x={tick.x} y={geometry.height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          {wibDate(tick.at)}
        </text>
      ))}
      <g clipPath={`url(#${clipId})`}>
        {geometry.series.map((series, index) => {
          const style = seriesStyle(index);
          return (
            <g key={series.offerId}>
              {series.solid ? <path d={series.solid} fill="none" stroke={style.stroke} strokeWidth={2} strokeLinejoin="round" /> : null}
              {series.dashed ? <path d={series.dashed} fill="none" stroke={style.stroke} strokeWidth={2} strokeDasharray="4 4" /> : null}
              {series.markers.map((marker) => (
                <Marker key={marker.at} x={marker.x} y={marker.y} shape={style.shape} color={style.stroke} />
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
