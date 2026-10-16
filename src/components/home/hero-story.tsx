"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PauseIcon, PlayIcon, RepeatIcon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

/**
 * Cerita singkat di layar ponsel hero: apa itu CekHarga dan apa yang bisa
 * dilakukan, dalam empat adegan (masukan PO 16 Okt 2026).
 *
 * Aturan motion PRD §8 tetap dipegang: cerita berjalan SEKALI lalu berhenti
 * di adegan terakhir, tidak berulang sendiri. Karena gerakannya lebih dari
 * lima detik, ada tombol jeda (WCAG 2.2.2) dan tombol per langkah supaya
 * pengguna bisa membaca sesuai kecepatannya. Pengguna dengan
 * `prefers-reduced-motion` tidak diputarkan otomatis; mereka memilih langkah
 * sendiri.
 *
 * Isi layar sengaja abstrak (balok dan ikon, tanpa angka atau merek), sama
 * seperti ilustrasi sebelumnya, supaya tidak disangka data nyata. Informasi
 * sebenarnya ada di teks keterangan di bawah ponsel.
 */

const SCENE_MS = 3600;

const SCENES = [
  { tab: "Cari", title: "Cari HP dari kebutuhanmu", body: "Saring katalog menurut merek, RAM, penyimpanan, dan rentang harga." },
  { tab: "Bandingkan", title: "Bandingkan 2 sampai 3 HP", body: "Spesifikasi berdampingan, lengkap dengan kompromi tiap pilihan." },
  { tab: "Harga", title: "Harga per varian, ada waktunya", body: "Setiap harga menyebut varian acuan dan kapan terakhir diperiksa. Bukan real-time." },
  { tab: "Toko", title: "Beli di toko pilihanmu", body: "Tautan menuju marketplace dan situs resmi. Transaksi terjadi di sana, bukan di CekHarga." },
] as const;

export function HeroStory({ overlay }: { overlay?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const autoplay = playing && !reduceMotion;

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => {
      if (scene < SCENES.length - 1) {
        setScene(scene + 1);
      } else {
        setPlaying(false);
        setFinished(true);
      }
    }, SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, scene]);

  const control = finished
    ? { label: "Putar ulang cerita", icon: RepeatIcon }
    : autoplay
      ? { label: "Jeda cerita", icon: PauseIcon }
      : { label: "Putar cerita", icon: PlayIcon };

  const onControl = () => {
    if (finished) {
      setScene(0);
      setFinished(false);
      setPlaying(true);
    } else {
      setPlaying(!autoplay);
    }
  };

  const current = SCENES[scene];

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative flex w-full items-center justify-center py-6">
        <div aria-hidden className="animate-in fade-in zoom-in-95 absolute aspect-square w-[85%] rounded-full bg-muted duration-300" />
        <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative delay-75 duration-300">
          <svg aria-hidden viewBox="0 0 280 560" className="h-104 w-auto sm:h-120" fill="none">
            <rect
              x="20"
              y="10"
              width="240"
              height="540"
              rx="38"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1}
              className="draw-outline fill-card stroke-border-strong"
              strokeWidth="2"
              style={{ animationDelay: "260ms" }}
            />
            <rect x="32" y="22" width="216" height="516" rx="28" className="fill-background" />
            <rect x="258" y="150" width="4" height="54" rx="2" className="fill-border-strong" />
            <rect x="258" y="220" width="4" height="34" rx="2" className="fill-border-strong" />

            {/* Penanda kemajuan ala cerita: satu ruas per adegan. */}
            {SCENES.map((_, index) => {
              const x = 50 + index * 46;
              return (
                <g key={index}>
                  <rect x={x} y="38" width="42" height="4" rx="2" className="fill-muted" />
                  {index < scene || (index === scene && !autoplay) ? (
                    <rect x={x} y="38" width="42" height="4" rx="2" className="fill-brand" />
                  ) : index === scene ? (
                    <motion.rect
                      key={`${scene}-${playing}`}
                      x={x}
                      y="38"
                      height="4"
                      rx="2"
                      className="fill-brand"
                      initial={{ width: 0 }}
                      animate={{ width: 42 }}
                      transition={{ duration: SCENE_MS / 1000, ease: "linear" }}
                    />
                  ) : null}
                </g>
              );
            })}

            <AnimatePresence mode="wait" initial={false}>
              <motion.g
                key={scene}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {scene === 0 ? <SearchScene /> : scene === 1 ? <CompareScene /> : scene === 2 ? <PriceScene /> : <StoreScene />}
              </motion.g>
            </AnimatePresence>
          </svg>
        </div>
        {overlay}
      </div>

      <div className="w-full max-w-sm">
        <div role="group" aria-label="Langkah cerita CekHarga" className="flex items-center gap-1">
          <button
            type="button"
            onClick={onControl}
            aria-label={control.label}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <HugeiconsIcon icon={control.icon} size={16} strokeWidth={2} aria-hidden />
          </button>
          {SCENES.map((item, index) => (
            <button
              key={item.tab}
              type="button"
              aria-current={index === scene ? "step" : undefined}
              onClick={() => {
                setScene(index);
                setPlaying(false);
                setFinished(false);
              }}
              className={cn(
                "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full px-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                index === scene ? "bg-brand-muted text-brand" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.tab}
            </button>
          ))}
        </div>
        <div className="mt-2 min-h-[4.25rem] px-2 text-center">
          <p className="text-sm font-bold text-foreground">
            <span className="sr-only">Langkah {scene + 1} dari {SCENES.length}: </span>
            {current.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
        </div>
      </div>
    </div>
  );
}

/* Adegan: hanya bentuk abstrak. Setiap elemen masuk sekali, bertingkat. */

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: "easeOut" as const },
});

function MiniPhone({ x, y, w = 14, h = 30 }: { x: number; y: number; w?: number; h?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={4} className="fill-card stroke-border-strong" strokeWidth="1.5" />;
}

function SearchScene() {
  return (
    <g>
      <motion.g {...rise(0)}>
        <rect x="50" y="62" width="180" height="32" rx="16" className="fill-card stroke-border" strokeWidth="2" />
        <circle cx="70" cy="78" r="6" className="stroke-muted-foreground" strokeWidth="2" />
        <path d="M74.5 82.5 79 87" className="stroke-muted-foreground" strokeWidth="2" strokeLinecap="round" />
        <motion.rect
          x="88"
          y="73"
          height="10"
          rx="5"
          className="fill-foreground/70"
          initial={{ width: 0 }}
          animate={{ width: 84 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        />
      </motion.g>
      {[0, 1, 2].map((index) => (
        <motion.rect
          key={index}
          x={50 + index * 62}
          y="106"
          width="54"
          height="22"
          rx="11"
          strokeWidth="1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.9 + index * 0.12 }}
          className={index === 1 ? "fill-brand stroke-brand" : "fill-card stroke-border"}
        />
      ))}
      {[0, 1, 2, 3].map((index) => {
        const x = 50 + (index % 2) * 94;
        const y = 142 + Math.floor(index / 2) * 124;
        return (
          <motion.g key={index} {...rise(1.4 + index * 0.15)}>
            <rect x={x} y={y} width="86" height="114" rx="14" className="fill-card stroke-border" strokeWidth="2" />
            <rect x={x + 8} y={y + 8} width="70" height="56" rx="10" className="fill-muted" />
            <MiniPhone x={x + 36} y={y + 21} />
            <rect x={x + 8} y={y + 74} width="44" height="7" rx="3.5" className="fill-muted-foreground/40" />
            <rect x={x + 8} y={y + 90} width="58" height="10" rx="5" className="fill-foreground/80" />
          </motion.g>
        );
      })}
    </g>
  );
}

function CompareScene() {
  const rows = [
    [96, 70, "success"],
    [60, 92, "warning"],
    [84, 84, "success"],
    [52, 76, "warning"],
  ] as const;
  return (
    <g>
      {[0, 1].map((side) => (
        <motion.g
          key={side}
          initial={{ opacity: 0, x: side === 0 ? -16 : 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        >
          <rect x={50 + side * 96} y="62" width="84" height="104" rx="14" className="fill-card stroke-border" strokeWidth="2" />
          <rect x={58 + side * 96} y="70" width="68" height="60" rx="10" className="fill-muted" />
          <MiniPhone x={85 + side * 96} y={85} />
          <rect x={58 + side * 96} y="140" width="50" height="9" rx="4.5" className="fill-foreground/80" />
        </motion.g>
      ))}
      <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.5 }} style={{ transformOrigin: "140px 114px" }}>
        <circle cx="140" cy="114" r="13" className="fill-brand" />
        <path d="M134 110h12l-3-3M146 118h-12l3 3" className="stroke-brand-foreground" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      {rows.map(([left, right, tone], index) => {
        const y = 186 + index * 40;
        return (
          <motion.g key={index} {...rise(0.8 + index * 0.2)}>
            <rect x="50" y={y} width="180" height="30" rx="10" className="fill-card stroke-border" strokeWidth="1.5" />
            <rect x={136 - left * 0.8} y={y + 11} width={left * 0.8} height="8" rx="4" className="fill-foreground/70" />
            <rect x="144" y={y + 11} width={right * 0.8} height="8" rx="4" className="fill-foreground/70" />
            <circle cx={tone === "success" ? 60 : 220} cy={y + 15} r="4" className={tone === "success" ? "fill-success" : "fill-warning"} />
          </motion.g>
        );
      })}
    </g>
  );
}

function PriceScene() {
  return (
    <g>
      <motion.g {...rise(0)}>
        <rect x="50" y="62" width="180" height="104" rx="16" className="fill-card stroke-border" strokeWidth="2" />
        <rect x="64" y="76" width="58" height="20" rx="10" className="fill-brand-muted stroke-brand" strokeWidth="1.5" />
        <rect x="74" y="83" width="38" height="6" rx="3" className="fill-brand" />
        <rect x="64" y="108" width="110" height="16" rx="8" className="fill-foreground/85" />
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.3 }}>
          <circle cx="71" cy="145" r="7" className="stroke-success" strokeWidth="1.8" />
          <motion.path
            d="M71 145V140.5"
            className="stroke-success"
            strokeWidth="1.8"
            strokeLinecap="round"
            initial={{ rotate: 0 }}
            animate={{ rotate: 270 }}
            transition={{ delay: 0.6, duration: 1.2, ease: "easeInOut" }}
            style={{ transformOrigin: "71px 145px" }}
          />
          <rect x="84" y="141" width="76" height="8" rx="4" className="fill-success/60" />
        </motion.g>
      </motion.g>
      <motion.g {...rise(0.9)}>
        <rect x="50" y="182" width="180" height="150" rx="16" className="fill-card stroke-border" strokeWidth="2" />
        {[0, 1, 2].map((index) => (
          <line key={index} x1="64" x2="216" y1={210 + index * 36} y2={210 + index * 36} className="stroke-border" strokeWidth="1" strokeDasharray="3 4" />
        ))}
        <motion.path
          d="M64 236 L94 244 L122 230 L150 262 L178 270 L216 258"
          className="stroke-brand"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 1.2, duration: 1.1, ease: "easeInOut" }}
        />
        <motion.circle cx="216" cy="258" r="5" className="fill-brand stroke-card" strokeWidth="2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.3, duration: 0.2 }} />
        <rect x="64" y="304" width="64" height="8" rx="4" className="fill-muted-foreground/40" />
      </motion.g>
    </g>
  );
}

function StoreScene() {
  return (
    <g>
      {[0, 1, 2].map((index) => {
        const y = 62 + index * 66;
        const first = index === 0;
        return (
          <motion.g key={index} {...rise(0.1 + index * 0.18)}>
            <rect
              x="50"
              y={y}
              width="180"
              height="56"
              rx="14"
              strokeWidth={first ? 2.5 : 2}
              className={first ? "fill-brand-muted stroke-brand" : "fill-card stroke-border"}
            />
            <circle cx="72" cy={y + 28} r="12" className="fill-muted" />
            <rect x="92" y={y + 16} width="56" height="8" rx="4" className="fill-muted-foreground/50" />
            <rect x="92" y={y + 32} width="72" height="10" rx="5" className="fill-foreground/80" />
            <path
              d={`M206 ${y + 22}h8v8M214 ${y + 22}l-11 11`}
              className={first ? "stroke-brand" : "stroke-muted-foreground"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.g>
        );
      })}
      {/* Ketukan sekali pada baris pertama: pengguna pindah ke toko. */}
      <motion.circle
        cx="210"
        cy="88"
        r="16"
        className="fill-brand/20"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 1.4] }}
        transition={{ delay: 1.1, duration: 0.8, ease: "easeOut" }}
        style={{ transformOrigin: "210px 88px" }}
      />
      <motion.g {...rise(1.5)}>
        <rect x="50" y="270" width="180" height="40" rx="12" className="fill-muted" />
        <rect x="64" y="282" width="120" height="7" rx="3.5" className="fill-muted-foreground/50" />
        <rect x="64" y="294" width="84" height="7" rx="3.5" className="fill-muted-foreground/30" />
      </motion.g>
    </g>
  );
}
