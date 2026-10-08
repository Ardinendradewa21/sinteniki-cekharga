"use client";

import Image from "next/image";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { DevicePlaceholder } from "@/components/product/device-placeholder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Photo = { src: string; alt: string; source: string };

/** Geser minimal (px) atau kecepatan (px/detik) agar swipe dianggap pindah foto. */
const SWIPE_OFFSET = 60;
const SWIPE_VELOCITY = 400;

const slide = {
  enter: (direction: number) => ({ x: direction * 72, opacity: 0, scale: 0.97 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({ x: direction * -72, opacity: 0, scale: 0.97 }),
};

/**
 * Galeri foto produk di halaman detail.
 *
 * - Tombol sebelumnya/berikutnya selalu terlihat (bukan hanya saat hover),
 *   karena swipe saja tidak boleh jadi satu-satunya cara (tidak ada di layar
 *   sentuh tanpa petunjuk, tidak ada di keyboard).
 * - Tidak berputar otomatis: foto berganti hanya karena tindakan pengguna.
 * - Swipe horizontal hanya di area foto; gulir vertikal halaman tetap jalan
 *   (`touch-action: pan-y`).
 * - Animasi geser dimatikan otomatis untuk "reduce motion" oleh MotionProvider
 *   (MotionConfig reducedMotion="user"); yang tersisa hanya pudar.
 */
export function ProductGallery({
  photos,
  fallback,
  name,
}: {
  photos: Photo[];
  /** Gambar utama produk; bila ilustrasi generik, tampil sebagai placeholder (PRD §8). */
  fallback: { src: string; alt: string; isGenericIllustration?: boolean };
  name: string;
}) {
  const [[index, direction], setPage] = useState<[number, number]>([0, 0]);
  const count = photos.length;

  if (count <= 1) {
    const photo = photos[0];
    return (
      <figure className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8">
        <div className="relative flex h-72 w-full items-center justify-center sm:h-96">
          {photo || !fallback.isGenericIllustration ? (
            <Image
              src={photo?.src ?? fallback.src}
              alt={photo?.alt ?? fallback.alt}
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              preload
              className="object-contain"
            />
          ) : (
            <DevicePlaceholder size="lg" />
          )}
        </div>
        {photo ? <PhotoSource source={photo.source} /> : null}
      </figure>
    );
  }

  const current = photos[index]!;
  const go = (delta: number) =>
    setPage(([value]) => [(value + delta + count) % count, delta]);
  const show = (target: number) =>
    setPage(([value]) => (target === value ? [value, 0] : [target, target > value ? 1 : -1]));

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_OFFSET || info.velocity.x < -SWIPE_VELOCITY) go(1);
    else if (info.offset.x > SWIPE_OFFSET || info.velocity.x > SWIPE_VELOCITY) go(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={`Foto ${name}`}
      className="rounded-xl border border-border bg-card p-4 sm:p-6"
    >
      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        <div className="relative h-72 w-full sm:h-96">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={current.src}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} dari ${count}`}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.5}
              onDragEnd={onDragEnd}
              style={{ touchAction: "pan-y" }}
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
            >
              <Image
                src={current.src}
                alt={current.alt}
                fill
                sizes="(min-width: 1024px) 40vw, 90vw"
                preload={index === 0}
                draggable={false}
                className="pointer-events-none select-none object-contain"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <GalleryButton label="Foto sebelumnya" onClick={() => go(-1)} className="left-1">
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-5" />
        </GalleryButton>
        <GalleryButton label="Foto berikutnya" onClick={() => go(1)} className="right-1">
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-5" />
        </GalleryButton>

        <p
          aria-hidden="true"
          className="absolute right-2 top-2 rounded-pill border border-border bg-card px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground"
        >
          {index + 1}/{count}
        </p>
      </div>

      <p className="sr-only" aria-live="polite">
        Foto {index + 1} dari {count}
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Pilih foto">
        {photos.map((photo, position) => {
          const active = position === index;
          return (
            <button
              key={photo.src}
              type="button"
              onClick={() => show(position)}
              aria-label={`Tampilkan foto ${position + 1}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative size-14 shrink-0 rounded-lg border bg-background/60 p-1 transition-[border-color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-transparent opacity-100"
                  : "border-border opacity-60 hover:opacity-100"
              )}
            >
              <Image
                src={photo.src}
                alt=""
                width={48}
                height={48}
                className="size-full object-contain"
              />
              {active ? (
                <motion.span
                  layoutId="product-gallery-active"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg ring-2 ring-primary"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <PhotoSource source={current.source} />
    </section>
  );
}

function GalleryButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    // Tombol sistem (outline, 44px) agar sama dengan tombol lain; tanpa blur
    // kaca atau efek membesar. shadow-sm memisahkannya dari foto di belakangnya.
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className={cn("absolute top-1/2 z-10 -translate-y-1/2 shadow-sm", className)}
    >
      {children}
    </Button>
  );
}

function PhotoSource({ source }: { source: string }) {
  return (
    <p className="mt-3 text-center text-xs text-muted-foreground">
      Sumber foto: {source}
    </p>
  );
}
