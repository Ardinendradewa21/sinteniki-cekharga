"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpRight01Icon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { DemoBadge } from "@/components/demo-marker";
import type { HeroTourData } from "@/components/home/hero-tour-data";
import { CountUp } from "@/components/motion/count-up";
import { SegmentedControl } from "@/components/motion/segmented-control";
import { StatusPill } from "@/components/status-pill";
import { easeOutQuint, useMotionPreset } from "@/lib/motion";

/**
 * Cuplikan fitur di Hero Price Panel (Sprint 13 S13-3, tema Verdant VD-04).
 *
 * Setiap adegan memakai potongan UI CekHarga dengan data katalog asli (lihat
 * hero-tour-data.ts), jadi pengunjung melihat fiturnya, bukan ilustrasinya.
 *
 * Susunan Verdant (DESIGN.md §7): kartu solid berisi adegan dan keterangannya,
 * lalu SegmentedControl untuk memilih adegan (thumb ikut bergeser saat
 * autoplay) dan tombol jeda. Tidak ada teks yang langsung di atas kaca.
 *
 * Aturan motion PRD §8 dan WCAG 2.2.2: diputar SEKALI lalu berhenti di adegan
 * terakhir, ada tombol jeda dan pilihan per langkah. `prefers-reduced-motion`
 * tidak diputar otomatis dan semua animasi adegan selesai seketika. Kartu
 * bertinggi tetap supaya pergantian adegan tidak menggeser tata letak. Harga
 * di adegan Harga dirender final (CountUp tidak bergulir saat dimuat).
 */

const SCENE_MS = 3200;

type Scene = { tab: string; title: string; body: string; stage: ReactNode };

/**
 * Entrance kecil untuk potongan adegan: geser 8px saja, TANPA memudar. Teks
 * selalu beropasitas penuh, jadi kontrasnya tidak pernah turun di tengah
 * animasi (terukur VD-04: pemeriksa kontras Lighthouse menangkap kartu harga
 * yang sedang memudar dan mencatat 1.02:1). Seketika saat reduced motion.
 */
function useRise() {
  const { reduce } = useMotionPreset();
  return (delay: number): HTMLMotionProps<"div"> =>
    reduce
      ? {}
      : {
          initial: { y: 8 },
          animate: { y: 0 },
          transition: { duration: 0.35, delay, ease: easeOutQuint },
        };
}

export function HeroTour({ data, isDemo }: { data: HeroTourData; isDemo: boolean }) {
  const { reduce, transition } = useMotionPreset();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const autoplay = playing && !reduce;

  const candidates: (Scene | null)[] = [
    data.search && {
      tab: "Cari",
      title: "Cari dari kebutuhan",
      body: `Ketik "${data.search.query}", katalog langsung tersaring.`,
      stage: <SearchStage search={data.search} />,
    },
    data.compare && {
      tab: "Bandingkan",
      title: "Bandingkan 2 sampai 3 HP",
      body: "Spesifikasi berdampingan, komprominya terlihat.",
      stage: <CompareStage compare={data.compare} />,
    },
    data.price && {
      tab: "Harga",
      title: "Harga per varian",
      body: "Lengkap dengan waktu periksa, lalu beli di toko pilihanmu.",
      stage: <PriceStage price={data.price} isDemo={isDemo} />,
    },
    {
      tab: "Tanya AI",
      title: "Masih bingung? Tanya AI",
      body: "Ceritakan kebutuhanmu, kandidatnya dari katalog.",
      stage: <AskStage />,
    },
  ];
  const scenes = candidates.filter((scene): scene is Scene => scene !== null);

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => {
      if (index < scenes.length - 1) {
        setIndex(index + 1);
      } else {
        setPlaying(false);
        setFinished(true);
      }
    }, SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, index, scenes.length]);

  const control = finished
    ? { label: "Putar ulang cuplikan", icon: RepeatIcon }
    : autoplay
      ? { label: "Jeda cuplikan", icon: PauseIcon }
      : { label: "Putar cuplikan", icon: PlayIcon };

  const onControl = () => {
    if (finished) {
      setIndex(0);
      setFinished(false);
      setPlaying(true);
    } else {
      setPlaying(!autoplay);
    }
  };

  const current = scenes[index];

  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="relative flex h-108 flex-col overflow-hidden rounded-lg bg-card p-5 shadow-sm">
        {/* Penanda kemajuan: satu ruas per adegan. */}
        <div aria-hidden className="flex gap-1.5">
          {scenes.map((scene, i) => (
            <span key={scene.tab} className="relative h-1 flex-1 overflow-hidden rounded-pill bg-muted">
              {i < index || (i === index && !autoplay) ? (
                <span className="absolute inset-0 bg-brand" />
              ) : i === index ? (
                <motion.span
                  key={`${index}-${playing}`}
                  className="absolute inset-y-0 left-0 bg-brand"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: SCENE_MS / 1000, ease: "linear" }}
                />
              ) : null}
            </span>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.tab}
            className="mt-5 min-h-0 flex-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: transition("micro") }}
            exit={{ opacity: 0, transition: transition("exit") }}
          >
            {current.stage}
          </motion.div>
        </AnimatePresence>

        <div className="mt-3 border-t border-border pt-3 text-center">
          <p className="text-sm font-bold text-card-foreground">
            <span className="sr-only">
              Langkah {index + 1} dari {scenes.length}:{" "}
            </span>
            {current.title}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onControl}
          aria-label={control.label}
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-card-foreground transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HugeiconsIcon icon={control.icon} size={16} strokeWidth={2} aria-hidden />
        </button>
        <SegmentedControl
          label="Langkah cuplikan fitur CekHarga"
          fullWidth
          // Lebar tab mengikuti labelnya (flex-auto), bukan sama rata: di 375px
          // "Bandingkan" tidak muat di seperempat lebar (terlihat di VD-04).
          className="min-w-0 flex-nowrap [&_button]:flex-auto [&_button]:px-2 [&_button]:text-xs sm:[&_button]:px-3"
          value={current.tab}
          onValueChange={(tab) => {
            setIndex(scenes.findIndex((scene) => scene.tab === tab));
            setPlaying(false);
            setFinished(false);
          }}
          options={scenes.map((scene) => ({ value: scene.tab, label: scene.tab }))}
        />
      </div>
    </div>
  );
}

function SearchStage({ search }: { search: NonNullable<HeroTourData["search"]> }) {
  const rise = useRise();
  const { reduce } = useMotionPreset();
  return (
    <div aria-hidden>
      <div className="flex h-11 items-center gap-2.5 rounded-md border border-input bg-background px-3.5">
        <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={2} className="shrink-0 text-muted-foreground" />
        <motion.span
          className="overflow-hidden text-sm whitespace-nowrap text-foreground"
          initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 0.9, delay: 0.2, ease: "linear" }}
        >
          {search.query}
        </motion.span>
      </div>
      <motion.div
        {...rise(1.1)}
        className="mt-3 inline-flex rounded-pill border border-brand/30 bg-brand-muted px-3 py-1 text-xs font-medium text-brand-text"
      >
        {search.filterLabel}
      </motion.div>
      <ul className="mt-3 flex flex-col gap-2">
        {search.results.map((result, i) => (
          <motion.li
            key={result.name}
            {...(rise(1.4 + i * 0.15) as HTMLMotionProps<"li">)}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3.5 py-2.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{result.name}</span>
              {result.variant ? (
                <span className="block text-xs text-muted-foreground">Varian {result.variant}</span>
              ) : null}
            </span>
            <span className="tabular shrink-0 text-sm font-bold text-foreground">{result.price}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function CompareStage({ compare }: { compare: NonNullable<HeroTourData["compare"]> }) {
  const rise = useRise();
  return (
    <div aria-hidden>
      <div className="grid grid-cols-2 gap-3">
        {compare.items.map((item, i) => (
          <motion.div
            key={item.name}
            {...rise(0.1 + i * 0.05)}
            className="rounded-md border border-border bg-background p-3"
          >
            <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.name}</p>
            <p className="tabular mt-1 text-sm font-bold text-foreground">{item.price}</p>
          </motion.div>
        ))}
      </div>
      <dl className="mt-3 flex flex-col gap-2">
        {compare.rows.map((row, i) => {
          const differs = row.values[0] !== row.values[1];
          return (
            <motion.div
              key={row.label}
              {...rise(0.6 + i * 0.2)}
              className={differs ? "rounded-md bg-brand-muted px-3 py-2" : "rounded-md border border-border px-3 py-2"}
            >
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                {row.label}
                {differs ? <span className="font-bold text-brand-text">beda</span> : null}
              </dt>
              <dd className="mt-0.5 grid grid-cols-2 gap-3 text-xs text-foreground">
                <span className="line-clamp-2">{row.values[0]}</span>
                <span className="line-clamp-2">{row.values[1]}</span>
              </dd>
            </motion.div>
          );
        })}
      </dl>
    </div>
  );
}

function PriceStage({ price, isDemo }: { price: NonNullable<HeroTourData["price"]>; isDemo: boolean }) {
  const rise = useRise();
  return (
    <div>
      <motion.div {...rise(0)} className="rounded-md border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{price.brand}</p>
          {isDemo ? <DemoBadge /> : null}
        </div>
        <p className="mt-0.5 text-base font-bold tracking-tight text-foreground">{price.model}</p>
        <p className="mt-3 text-xs text-muted-foreground">{price.fresh ? "Mulai dari" : "Harga terakhir tercatat"}</p>
        {/* Angka akhir sejak render pertama; tidak bergulir saat dimuat (DESIGN.md §8.4). */}
        <p className="flex items-baseline gap-0.5 font-extrabold tracking-tight text-foreground">
          <span className="text-base text-muted-foreground">Rp</span>
          <CountUp value={price.priceIdr} format="number" className="text-3xl" />
        </p>
        {price.variant ? <p className="mt-1 text-sm text-foreground">Varian {price.variant}</p> : null}
        <StatusPill tone={price.fresh ? "fresh" : "stale"} className="mt-2.5">
          {price.checked}
        </StatusPill>
      </motion.div>
      <motion.div
        {...rise(1.2)}
        aria-hidden
        className="mt-3 flex items-center justify-between rounded-md border border-brand/30 bg-brand-muted px-3.5 py-2.5 text-sm font-semibold text-brand-text"
      >
        Lanjut ke toko pilihanmu
        <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} strokeWidth={2} />
      </motion.div>
    </div>
  );
}

function AskStage() {
  const rise = useRise();
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <motion.div
        {...rise(0.1)}
        className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
      >
        Budget 4 juta, utamakan kamera
      </motion.div>
      <motion.div
        {...rise(0.9)}
        className="mr-auto max-w-[85%] rounded-lg rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground"
      >
        Budget 4 juta aku jadikan batas wajib. Kandidatnya aku pilih dari
        katalog CekHarga, lengkap dengan alasan dan komprominya.
      </motion.div>
    </div>
  );
}
