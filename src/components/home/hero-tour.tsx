"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpRight01Icon,
  Clock01Icon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { DemoBadge } from "@/components/demo-marker";
import type { HeroTourData } from "@/components/home/hero-tour-data";
import { cn } from "@/lib/utils";

/**
 * Cuplikan fitur di hero (Sprint 13 S13-3), pengganti bingkai ponsel berisi
 * balok abstrak.
 *
 * Setiap adegan memakai potongan UI CekHarga dengan data katalog asli (lihat
 * hero-tour-data.ts), jadi pengunjung melihat fiturnya, bukan ilustrasinya.
 *
 * Aturan motion PRD §8 dan WCAG 2.2.2: diputar SEKALI lalu berhenti di adegan
 * terakhir, ada tombol jeda dan tombol per langkah. `prefers-reduced-motion`
 * tidak diputar otomatis; MotionProvider sudah mematikan gerak transform, dan
 * pengguna memilih langkahnya sendiri. Panggung bertinggi tetap supaya
 * pergantian adegan tidak menggeser tata letak.
 */

const SCENE_MS = 3200;

type Scene = { tab: string; title: string; body: string; stage: ReactNode };

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, delay, ease: "easeOut" as const },
});

export function HeroTour({ data, isDemo }: { data: HeroTourData; isDemo: boolean }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const autoplay = playing && !reduceMotion;

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
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="relative h-92 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
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
            className="mt-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {current.stage}
          </motion.div>
        </AnimatePresence>
      </div>

      <div role="group" aria-label="Langkah cuplikan fitur CekHarga" className="mt-4 flex items-center gap-1">
        <button
          type="button"
          onClick={onControl}
          aria-label={control.label}
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HugeiconsIcon icon={control.icon} size={16} strokeWidth={2} aria-hidden />
        </button>
        {scenes.map((scene, i) => (
          <button
            key={scene.tab}
            type="button"
            aria-current={i === index ? "step" : undefined}
            onClick={() => {
              setIndex(i);
              setPlaying(false);
              setFinished(false);
            }}
            className={cn(
              "inline-flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full px-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              i === index ? "bg-brand-muted text-brand" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {scene.tab}
          </button>
        ))}
      </div>
      <div className="mt-2 min-h-17 px-2 text-center">
        <p className="text-sm font-bold text-foreground">
          <span className="sr-only">
            Langkah {index + 1} dari {scenes.length}:{" "}
          </span>
          {current.title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
      </div>
    </div>
  );
}

function SearchStage({ search }: { search: NonNullable<HeroTourData["search"]> }) {
  return (
    <div aria-hidden>
      <div className="flex h-11 items-center gap-2.5 rounded-lg border border-input bg-background px-3.5">
        <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={2} className="shrink-0 text-muted-foreground" />
        <motion.span
          className="overflow-hidden text-sm whitespace-nowrap text-foreground"
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 0.9, delay: 0.2, ease: "linear" }}
        >
          {search.query}
        </motion.span>
      </div>
      <motion.p
        {...rise(1.1)}
        className="mt-3 inline-flex rounded-pill border border-brand/30 bg-brand-muted px-3 py-1 text-xs font-medium text-brand"
      >
        {search.filterLabel}
      </motion.p>
      <ul className="mt-3 flex flex-col gap-2">
        {search.results.map((result, i) => (
          <motion.li
            key={result.name}
            {...rise(1.4 + i * 0.15)}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5"
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
  return (
    <div aria-hidden>
      <div className="grid grid-cols-2 gap-3">
        {compare.items.map((item, i) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: i === 0 ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
            className="rounded-lg border border-border bg-background p-3"
          >
            <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.name}</p>
            <p className="tabular mt-1 text-sm font-bold text-foreground">{item.price}</p>
          </motion.div>
        ))}
      </div>
      <dl className="mt-3 flex flex-col gap-2">
        {compare.rows.map((row, i) => (
          <motion.div key={row.label} {...rise(0.6 + i * 0.2)} className="rounded-lg border border-border px-3 py-2">
            <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="mt-0.5 grid grid-cols-2 gap-3 text-xs text-foreground">
              <span className="line-clamp-2">{row.values[0]}</span>
              <span className="line-clamp-2">{row.values[1]}</span>
            </dd>
          </motion.div>
        ))}
      </dl>
    </div>
  );
}

function PriceStage({ price, isDemo }: { price: NonNullable<HeroTourData["price"]>; isDemo: boolean }) {
  return (
    <div>
      <motion.div {...rise(0)} className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{price.brand}</p>
          {isDemo ? <DemoBadge /> : null}
        </div>
        <p className="mt-0.5 text-base font-bold tracking-tight text-foreground">{price.model}</p>
        <p className="mt-3 text-xs text-muted-foreground">{price.fresh ? "Mulai dari" : "Harga terakhir tercatat"}</p>
        <p className="tabular text-2xl font-extrabold tracking-tight text-foreground">{price.price}</p>
        {price.variant ? <p className="mt-1 text-sm text-foreground">Varian {price.variant}</p> : null}
        <motion.p
          {...rise(0.7)}
          className={cn("mt-2 inline-flex items-center gap-1.5 text-sm", price.fresh ? "text-success" : "text-warning")}
        >
          <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={2} aria-hidden />
          {price.checked}
        </motion.p>
      </motion.div>
      <motion.p
        {...rise(1.4)}
        aria-hidden
        className="mt-3 flex items-center justify-between rounded-lg border border-brand/30 bg-brand-muted px-3.5 py-2.5 text-sm font-semibold text-brand"
      >
        Lanjut ke toko pilihanmu
        <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} strokeWidth={2} />
      </motion.p>
    </div>
  );
}

function AskStage() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <motion.p
        {...rise(0.1)}
        className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
      >
        Budget 4 juta, utamakan kamera
      </motion.p>
      <motion.p
        {...rise(0.9)}
        className="mr-auto max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-foreground"
      >
        Budget 4 juta aku jadikan batas wajib. Kandidatnya aku pilih dari
        katalog CekHarga, lengkap dengan alasan dan komprominya.
      </motion.p>
    </div>
  );
}
