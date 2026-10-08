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
  const mobile = parseSize(slot.mobileSize) ?? desktop;
  if (!desktop || !mobile || !creative.imageUrl) return null;
  const isRail = slot.code.startsWith("rail_");
  const mobileImage = creative.imageUrlMobile && !isRail ? creative.imageUrlMobile : null;
  const style = {
    maxWidth: desktop.w,
    "--ad-ar-d": `${desktop.w} / ${desktop.h}`,
    "--ad-ar-m": `${mobile.w} / ${mobile.h}`,
  } as CSSProperties;

  return (
    <a
      {...linkProps(creative)}
      style={style}
      className={cn(
        "group relative mx-auto block aspect-(--ad-ar-m) w-full overflow-hidden rounded-2xl bg-muted shadow-sm ring-1 ring-border/70 hover:ring-brand/40 sm:aspect-(--ad-ar-d)",
        LIFT
      )}
    >
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
      <AdLabel preview={creative.kind === "preview"} className="absolute top-2 left-2" />
    </a>
  );
}

function NativeAd({ creative }: { creative: ServedCreative }) {
  return (
    <a
      {...linkProps(creative)}
      className={cn(
        "group relative grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:border-brand/40 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
        LIFT
      )}
    >
      {/* Aksen gradasi: penanda visual bahwa ini unit berbeda dari kartu produk. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-brand via-accent-warm to-brand"
      />
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-brand-muted to-muted sm:aspect-auto sm:min-h-48">
        {creative.imageUrl ? (
          <Image
            src={creative.imageUrl}
            alt={creative.altText}
            fill
            sizes="(min-width: 640px) 40vw, 100vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
        <AdLabel preview={creative.kind === "preview"} className="absolute top-3 left-3" />
      </div>
      <div className="flex flex-col gap-2 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          {creative.logoUrl ? (
            <span className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-border">
              <Image src={creative.logoUrl} alt="" fill sizes="32px" className="object-contain p-1" />
            </span>
          ) : null}
          <span className="truncate text-sm font-semibold text-foreground">{creative.advertiserLabel}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">Bersponsor</span>
        </div>
        <p className="text-lg leading-snug font-extrabold tracking-tight text-foreground sm:text-xl">
          {creative.headline}
        </p>
        {creative.body ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{creative.body}</p>
        ) : null}
        {/* Teks CTA di dalam kartu yang seluruhnya tautan: tampil seperti tombol
            sistem (buttonVariants), tetapi bukan elemen interaktif tersendiri. */}
        <span className={cn(buttonVariants(), "pointer-events-none mt-auto w-fit")}>
          {creative.ctaLabel || "Selengkapnya"}
          <span aria-hidden="true">→</span>
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
