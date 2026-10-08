"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Diagram konsep beranimasi untuk dua section yang menjelaskan CARA KERJA:
 * "Kalau lebih mudah menjelaskan kebutuhan" dan "Supaya kamu tahu angkanya dari
 * mana". Keduanya berisi penjelasan mekanisme, jadi gambar di sini menambah
 * pemahaman — bukan hiasan yang ditempel supaya halaman ramai.
 *
 * Aturan yang dipegang:
 * - Setiap glyph menggambarkan mekanisme yang persis ditulis teks di sebelahnya.
 *   Kalau gambarnya tidak menjelaskan apa pun, gambar itu tidak dibuat.
 * - Sekali jalan saat masuk viewport (`once: true`), tidak loop — PRD §8.
 * - `aria-hidden` pada semuanya: teks di sebelahnya sudah menyampaikan isinya,
 *   jadi mengulanginya untuk pembaca layar hanya menambah kebisingan.
 * - Warna aksen hangat dipakai untuk menandai SATU elemen kunci di tiap glyph
 *   (yang sedang ditanyakan, yang wajib, yang terendah), bukan mewarnai semua.
 */

const VIEWPORT = { once: true, margin: "-40px" } as const;

/** Garis yang menggambar dirinya sendiri; delay dipakai untuk mengurutkan cerita. */
function draw(delay: number, duration = 0.55): Variants {
  return {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { duration, ease: "easeOut", delay },
        opacity: { duration: 0.1, delay },
      },
    },
  };
}

/** Elemen yang muncul utuh (titik, knob), bukan tergambar. */
function pop(delay: number): Variants {
  return {
    hidden: { opacity: 0, scale: 0.5 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.28, ease: "easeOut", delay },
    },
  };
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <motion.svg
      viewBox="0 0 44 44"
      width={40}
      height={40}
      data-reveal=""
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      aria-hidden
      className="shrink-0"
    >
      {children}
    </motion.svg>
  );
}

/* ---------------------------------------------------------------------------
   Section "Kalau lebih mudah menjelaskan kebutuhan"
   --------------------------------------------------------------------------- */

/** Bertanya seperlunya: pertanyaan datang satu per satu, bukan sekaligus. */
export function AskAsNeededGlyph() {
  return (
    <Glyph>
      <motion.path d="M8 13 H35" className="stroke-muted-foreground" variants={draw(0)} />
      <motion.path d="M8 22 H30" className="stroke-muted-foreground" variants={draw(0.16)} />
      <motion.path d="M8 31 H23" className="stroke-accent-warm" variants={draw(0.32)} />
      <motion.circle
        cx="28.5"
        cy="31"
        r="2.2"
        className="fill-accent-warm"
        stroke="none"
        variants={pop(0.58)}
      />
    </Glyph>
  );
}

/** Memisahkan wajib dari preferensi: satu jalur bercabang ke gembok dan ke slider. */
export function RequirementSplitGlyph() {
  return (
    <Glyph>
      <motion.path d="M22 7 V17" className="stroke-muted-foreground" variants={draw(0)} />
      <motion.path
        d="M22 17 C22 24 16 23 14 27.5"
        className="stroke-muted-foreground"
        variants={draw(0.18)}
      />
      <motion.path
        d="M22 17 C22 24 28 23 30 30"
        className="stroke-muted-foreground"
        variants={draw(0.18)}
      />
      {/* Wajib: gembok terkunci, tidak bisa dilanggar */}
      <motion.rect
        x="8.5"
        y="29"
        width="11"
        height="8"
        rx="2"
        className="stroke-accent-warm"
        variants={draw(0.42)}
      />
      <motion.path
        d="M11.5 29 V26.5 a2.5 2.5 0 0 1 5 0 V29"
        className="stroke-accent-warm"
        variants={draw(0.54)}
      />
      {/* Preferensi: slider, boleh digeser */}
      <motion.path d="M25 34 H38" className="stroke-muted-foreground" variants={draw(0.42)} />
      <motion.circle
        cx="31"
        cy="34"
        r="2.6"
        className="fill-card stroke-muted-foreground"
        variants={pop(0.66)}
      />
    </Glyph>
  );
}

/** Menyebut komprominya: timbangan yang memang miring, bukan seimbang sempurna. */
export function CompromiseScaleGlyph() {
  return (
    <Glyph>
      <motion.path d="M14 37 H30" className="stroke-muted-foreground" variants={draw(0)} />
      <motion.path d="M22 37 V15" className="stroke-muted-foreground" variants={draw(0.12)} />
      <motion.g
        style={{ transformOrigin: "22px 15px" }}
        variants={{
          hidden: { rotate: 0 },
          visible: {
            rotate: -8,
            transition: { duration: 0.5, ease: "easeOut", delay: 0.62 },
          },
        }}
      >
        <motion.path d="M9 15 H35" className="stroke-muted-foreground" variants={draw(0.3)} />
        <motion.circle
          cx="9"
          cy="15"
          r="2.8"
          className="fill-accent-warm"
          stroke="none"
          variants={pop(0.5)}
        />
        <motion.circle
          cx="35"
          cy="15"
          r="2.8"
          className="fill-card stroke-muted-foreground"
          variants={pop(0.56)}
        />
      </motion.g>
    </Glyph>
  );
}

/** Mengaku kalau tidak ada: pencarian berhenti di hasil kosong, tidak berputar terus. */
export function HonestEmptyGlyph() {
  return (
    <Glyph>
      <motion.circle
        cx="19"
        cy="19"
        r="10"
        className="stroke-muted-foreground"
        variants={draw(0)}
      />
      <motion.path
        d="M26.4 26.4 L35 35"
        className="stroke-muted-foreground"
        variants={draw(0.34)}
      />
      <motion.path
        d="M15.5 15.5 L22.5 22.5"
        className="stroke-accent-warm"
        variants={draw(0.52, 0.3)}
      />
      <motion.path
        d="M22.5 15.5 L15.5 22.5"
        className="stroke-accent-warm"
        variants={draw(0.64, 0.3)}
      />
    </Glyph>
  );
}

/* ---------------------------------------------------------------------------
   Section "Supaya kamu tahu angkanya dari mana"
   --------------------------------------------------------------------------- */

/** Arti "mulai dari": penunjuk jatuh ke penawaran terendah, bukan ke rata-rata. */
export function LowestPriceGlyph() {
  return (
    <Glyph>
      <motion.path d="M7 36 H37" className="stroke-muted-foreground" variants={draw(0)} />
      <motion.path
        d="M13 36 V20"
        strokeWidth={3.2}
        className="stroke-muted-foreground"
        variants={draw(0.18, 0.35)}
      />
      <motion.path
        d="M22 36 V13"
        strokeWidth={3.2}
        className="stroke-muted-foreground"
        variants={draw(0.28, 0.35)}
      />
      <motion.path
        d="M31 36 V25"
        strokeWidth={3.2}
        className="stroke-accent-warm"
        variants={draw(0.38, 0.35)}
      />
      <motion.path
        d="M27.5 17.5 L31 21 L34.5 17.5"
        className="stroke-accent-warm"
        variants={draw(0.62, 0.3)}
      />
    </Glyph>
  );
}

/** Penawaran yang dihitung: hanya yang lolos syarat yang keluar dari corong. */
export function QualifiedOfferGlyph() {
  return (
    <Glyph>
      <motion.path
        d="M8 12 H36 L26.5 23 V32 L17.5 28.5 V23 Z"
        className="stroke-muted-foreground"
        variants={draw(0.12)}
      />
      <motion.circle
        cx="14"
        cy="6.5"
        r="2"
        className="fill-muted-foreground"
        stroke="none"
        variants={pop(0)}
      />
      <motion.circle
        cx="22"
        cy="5.5"
        r="2"
        className="fill-muted-foreground"
        stroke="none"
        variants={pop(0.08)}
      />
      <motion.circle
        cx="30"
        cy="6.5"
        r="2"
        className="fill-muted-foreground"
        stroke="none"
        variants={pop(0.16)}
      />
      <motion.circle
        cx="22"
        cy="38"
        r="2.4"
        className="fill-accent-warm"
        stroke="none"
        variants={pop(0.72)}
      />
    </Glyph>
  );
}

/** Kalau harga sudah lama: jarum berjalan lalu berhenti di waktu pemeriksaan terakhir. */
export function StalePriceGlyph() {
  return (
    <Glyph>
      <motion.circle
        cx="22"
        cy="22"
        r="13"
        className="stroke-muted-foreground"
        variants={draw(0)}
      />
      <motion.path
        d="M22 22 L28 25"
        className="stroke-muted-foreground"
        variants={draw(0.36, 0.3)}
      />
      <motion.path
        d="M22 22 V13"
        className="stroke-accent-warm"
        style={{ transformOrigin: "22px 22px" }}
        variants={{
          hidden: { pathLength: 0, opacity: 0, rotate: -70 },
          visible: {
            pathLength: 1,
            opacity: 1,
            rotate: 0,
            transition: {
              pathLength: { duration: 0.3, ease: "easeOut", delay: 0.48 },
              opacity: { duration: 0.1, delay: 0.48 },
              rotate: { duration: 0.7, ease: "easeOut", delay: 0.48 },
            },
          },
        }}
      />
    </Glyph>
  );
}

/** Ulasan reviewer: ringkasan yang selalu membawa penandanya, bukan kesimpulan lepas. */
export function ReviewSourceGlyph() {
  return (
    <Glyph>
      <motion.path
        d="M10 9 H34 a4 4 0 0 1 4 4 V25 a4 4 0 0 1 -4 4 H21 l-6 6 V29 H10 a4 4 0 0 1 -4 -4 V13 a4 4 0 0 1 4 -4 Z"
        className="stroke-muted-foreground"
        variants={draw(0)}
      />
      <motion.path d="M12 16.5 H30" className="stroke-muted-foreground" variants={draw(0.42)} />
      <motion.path d="M12 22 H23" className="stroke-muted-foreground" variants={draw(0.52)} />
      <motion.path
        d="M26.5 21.5 L29 24 L33.5 19.5"
        className="stroke-accent-warm"
        variants={draw(0.68, 0.35)}
      />
    </Glyph>
  );
}

/**
 * Titik status statis untuk bagian asisten di beranda.
 *
 * Dulu berdenyut tanpa henti (`repeat: Infinity`) dan selalu berwarna warning,
 * baik saat AI aktif maupun tidak. Keduanya keliru: PRD §8 meminta menghindari
 * loop, dan "aktif" bukan peringatan. Sekarang statis, hijau saat aktif dan
 * amber saat tidak tersedia; arti tetap disampaikan kalimat di sebelahnya,
 * bukan warna saja.
 */
export function StatusDot({ tone }: { tone: "success" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex size-2.5 shrink-0 rounded-pill",
        tone === "success" ? "bg-success" : "bg-warning"
      )}
      aria-hidden
    />
  );
}
