import Image from "next/image";
import type { CSSProperties } from "react";

import { AdLabel } from "@/components/ads/ad-label";
import { AdViewTracker } from "@/components/ads/ad-view-tracker";
import { AdsenseUnit } from "@/components/ads/adsense-unit";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button-variants";
import { decide, getSlot, type LiveSlot, type ServedCreative, type SlotCode } from "@/lib/ads/decision";
import { adsenseSlotId, getAdSettings } from "@/lib/ads/settings";
import { cn } from "@/lib/utils";

/**
 * Unit iklan di situs publik (docs/ads/ADS-CONTEXT.md §6-7).
 *
 * - Kartu sendiri (sudut membulat, bayangan halus, terangkat saat disorot)
 *   sehingga terbaca sebagai unit terpisah dari daftar produk.
 * - <AdLabel> selalu ada DI DALAM materi iklan; tidak bisa dimatikan.
 * - Ukuran mengikuti slot di database (desktop/mobile "WxH"), dipesan lewat
 *   aspect-ratio sehingga tidak ada pergeseran tata letak.
 * - Slot tanpa iklan tidak dirender sama sekali, kecuali slot ber-fallback
 *   AdSense yang sudah dikonfigurasi dan disetujui pengunjung.
 * - Tautan memakai rel="sponsored", membuka tab baru, target sentuh ≥44 px,
 *   dan menghormati reduced motion.
 */

const LIFT =
  "transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0";

function parseSize(size: string | null): { w: number; h: number } | null {
  const match = size?.match(/^(\d+)x(\d+)$/);
  return match ? { w: Number(match[1]), h: Number(match[2]) } : null;
}

function linkProps(creative: ServedCreative) {
  const label = creative.kind === "preview" ? "Contoh iklan" : "Iklan";
  const isPreview = creative.kind === "preview";
  return {
    href: creative.href,
    ...(isPreview ? {} : { target: "_blank", rel: "sponsored noopener noreferrer" }),
    "aria-label": `${label} dari ${creative.advertiserLabel}: ${creative.headline ?? creative.altText}${isPreview ? "" : " (membuka tab baru)"}`,
    "data-ad-slot": creative.slotCode,
  } as const;
}

function DisplayAd({ creative, slot }: { creative: ServedCreative; slot: LiveSlot }) {
  const desktop = parseSize(slot.desktopSize);
  if (!desktop || !creative.imageUrl) return null;
  const isRail = slot.code.startsWith("rail_");
  const mobileImage = creative.imageUrlMobile && !isRail ? creative.imageUrlMobile : null;
  // Tanpa gambar ponsel, kotak ponsel memakai rasio materi desktop (temuan F1):
  // materi 970×250 tidak lagi mengecil menjadi pita di kotak 300×250.
  const mobile = (mobileImage ? parseSize(slot.mobileSize) : null) ?? desktop;
  // Banner ponsel setinggi ±50 px (T1): label "Iklan" di atas materi akan
  // menutup hampir separuh tingginya, jadi di ponsel label pindah ke strip
  // tipis di atas gambar, tetap di dalam unit iklan.
  const compactMobile = Boolean(mobileImage) && mobile.h <= 60;
  const style = {
    maxWidth: desktop.w,
    "--ad-ar-d": `${desktop.w} / ${desktop.h}`,
    "--ad-ar-m": `${mobile.w} / ${mobile.h}`,
  } as CSSProperties;
  const preview = creative.kind === "preview";

  return (
    <a
      {...linkProps(creative)}
      style={style}
      className={cn(
        // Sudut kecil (T1): rounded-2xl memotong sudut materi pengiklan.
        "group relative mx-auto block w-full overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-border/70 hover:ring-brand/40",
        LIFT
      )}
    >
      {compactMobile ? (
        <span className="flex items-center bg-card px-2 py-1 sm:hidden">
          <AdLabel preview={preview} />
        </span>
      ) : null}
      <span className="relative block aspect-(--ad-ar-m) w-full sm:aspect-(--ad-ar-d)">
        <Image
          src={creative.imageUrl}
          alt={creative.altText}
          fill
          sizes={`(min-width: 640px) ${desktop.w}px, 100vw`}
          className={cn(
            // contain, bukan cover: teks di materi tidak boleh terpotong. Unggahan
            // baru sudah divalidasi rasionya, jadi umumnya tanpa bingkai kosong.
            "object-contain transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
            mobileImage && "hidden sm:block"
          )}
        />
        {mobileImage ? (
          <Image
            src={mobileImage}
            alt={creative.altText}
            fill
            sizes="100vw"
            className="object-contain transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none sm:hidden"
          />
        ) : null}
        <AdLabel preview={preview} className={cn("absolute top-2 left-2", compactMobile && "hidden sm:inline-flex")} />
      </span>
    </a>
  );
}

function NativeAd({ creative }: { creative: ServedCreative }) {
  // Contoh iklan (pratinjau) menaut ke media kit di situs ini, bukan keluar.
  const arrow = creative.kind === "preview" ? "→" : "↗";
  return (
    <a
      {...linkProps(creative)}
      className={cn(
        // Ponsel (T2): gambar persegi kecil di kiri, teks di kanan, supaya
        // kartu tidak lebih tinggi dari satu baris kartu produk.
        "group relative grid grid-cols-[104px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:border-brand/40 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
        LIFT
      )}
    >
      {/* Garis aksen solid: penanda visual bahwa ini unit berbeda dari kartu
          produk. Gradien dan terracotta dipensiunkan (DESIGN.md §9). */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-1 bg-brand" />
      <div className="stage relative min-h-full overflow-hidden sm:min-h-48">
        {creative.imageUrl ? (
          <Image
            src={creative.imageUrl}
            alt={creative.altText}
            fill
            sizes="(min-width: 640px) 40vw, 104px"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
        <AdLabel preview={creative.kind === "preview"} className="absolute top-3 left-2 sm:left-3" />
      </div>
      <div className="flex flex-col gap-1.5 p-4 sm:gap-2 sm:p-6">
        <div className="flex items-center gap-2">
          {creative.logoUrl ? (
            <span className="stage relative size-6 shrink-0 overflow-hidden rounded-md ring-1 ring-border sm:size-8 sm:rounded-lg">
              <Image src={creative.logoUrl} alt="" fill sizes="32px" className="object-contain p-1" />
            </span>
          ) : null}
          <span className="truncate text-sm font-semibold text-foreground">{creative.advertiserLabel}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">Bersponsor</span>
        </div>
        <p className="text-base leading-snug font-bold tracking-tight text-foreground sm:text-xl">
          {creative.headline}
        </p>
        {creative.body ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{creative.body}</p>
        ) : null}
        {/* Teks CTA di dalam kartu yang seluruhnya tautan, jadi bukan elemen
            interaktif tersendiri. Desktop tampil seperti tombol sistem; ponsel
            cukup teks agar kartu tetap pendek. Panah ↗ karena tautan keluar
            situs (R-08). */}
        <span className="mt-auto text-sm font-semibold text-brand-text sm:hidden">
          {creative.ctaLabel || "Kunjungi situs"} <span aria-hidden="true">{arrow}</span>
        </span>
        <span className={cn(buttonVariants(), "pointer-events-none mt-auto hidden w-fit sm:inline-flex")}>
          {creative.ctaLabel || "Kunjungi situs"}
          <span aria-hidden="true">{arrow}</span>
        </span>
      </div>
    </a>
  );
}

/** Satu unit iklan yang sudah diputuskan. */
export function AdUnit({
  creative,
  slot,
  className,
}: {
  creative: ServedCreative;
  slot: LiveSlot;
  className?: string;
}) {
  const isRail = slot.code.startsWith("rail_");
  const native = creative.format === "native" && slot.allowsNative;
  return (
    <aside
      aria-label={creative.kind === "preview" ? "Contoh iklan" : "Iklan"}
      className={cn(
        isRail ? "w-[160px]" : "w-full",
        // Slot tanpa ukuran mobile (sidebar, rail) hanya tampil di layar lebar.
        !slot.mobileSize && !native && "hidden lg:block",
        className
      )}
    >
      <AdViewTracker creativeId={creative.kind === "campaign" ? creative.creativeId : null} slot={slot.code}>
        {native ? <NativeAd creative={creative} /> : <DisplayAd creative={creative} slot={slot} />}
      </AdViewTracker>
    </aside>
  );
}

/** Keputusan iklan untuk slot + data slotnya; null bila slot mati atau kosong. */
export async function resolveAd(
  code: SlotCode,
  options: { brand?: string | null; exclude?: string[] } = {}
): Promise<{ slot: LiveSlot; creative: ServedCreative } | null> {
  const slot = await getSlot(code);
  if (!slot) return null;
  const creative = await decide(code, options);
  return creative ? { slot, creative } : null;
}

/**
 * Slot iklan berdasarkan kode di tabel ad_slots. Tidak merender apa pun bila
 * slot nonaktif atau tidak ada iklan dan tidak ada cadangan AdSense.
 */
export async function AdSlot({
  code,
  brand,
  className,
}: {
  code: SlotCode;
  /** Merek halaman ini, untuk targeting kontekstual. */
  brand?: string | null;
  className?: string;
}) {
  const slot = await getSlot(code);
  if (!slot) return null;
  const creative = await decide(code, { brand });
  if (creative) return <AdUnit creative={creative} slot={slot} className={className} />;

  if (slot.fallback === "adsense") {
    const slotId = adsenseSlotId(code);
    const { adsenseClient } = await getAdSettings();
    if (adsenseClient && slotId) {
      return (
        <aside aria-label="Iklan" className={cn("w-full", className)}>
          <AdsenseUnit client={adsenseClient} slotId={slotId} />
        </aside>
      );
    }
  }
  return null;
}

/**
 * Slot selebar kontainer halaman (beranda), dengan jarak atas-bawah. Kontainer
 * hanya dirender bila ada iklan, supaya slot kosong tidak meninggalkan celah.
 */
export async function AdBand({ code, brand }: { code: SlotCode; brand?: string | null }) {
  const slot = await AdSlot({ code, brand });
  if (!slot) return null;
  return <Container className="py-6">{slot}</Container>;
}

/**
 * Rail kiri dan kanan (skyscraper 160×600) yang menempel saat digulir, di luar
 * area konten. Hanya tampil di layar ≥1680 px, tempat ada ruang kosong di
 * samping konten selebar 1280 px, sehingga tidak pernah menutupi konten.
 */
export async function AdRails() {
  const left = await resolveAd("rail_left");
  const right = await resolveAd("rail_right", { exclude: left ? [left.creative.lineItemId] : [] });
  if (!left && !right) return null;

  return (
    <>
      {left ? (
        <div className="fixed top-24 left-[calc(50%-824px)] z-10 hidden min-[1680px]:block print:hidden">
          <AdUnit creative={left.creative} slot={left.slot} />
        </div>
      ) : null}
      {right ? (
        <div className="fixed top-24 right-[calc(50%-824px)] z-10 hidden min-[1680px]:block print:hidden">
          <AdUnit creative={right.creative} slot={right.slot} />
        </div>
      ) : null}
    </>
  );
}
