"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

/**
 * Entrance saat elemen memasuki viewport, dipakai untuk daftar/grid berisi
 * data nyata (kartu produk, kartu perbandingan) — bukan diagram konsep.
 *
 * `viewport={{ once: true }}`: sesuai PRD §8 "hindari loop", entrance hanya
 * terjadi sekali per elemen, tidak berulang tiap kali discroll melewatinya.
 * `StaggerList`/`StaggerItem` memakai variants supaya urutan childnya
 * mengalir alih-alih muncul bersamaan — itu yang membedakan "kaya" dari
 * "ramai": urutannya membantu mata memindai, bukan sekadar bergerak.
 *
 * Durasi 360ms masuk rentang entrance PRD §8 (280–420ms). Reduced motion
 * ditangani `MotionConfig reducedMotion="user"` di root: transform dimatikan,
 * opacity tetap, jadi konten tidak pernah tersangkut tak terlihat.
 *
 * `data-reveal` bukan hiasan: state awal Motion dirender ikut ke HTML server
 * (opacity 0), jadi kalau JavaScript gagal dimuat, isinya akan tetap tak
 * terlihat selamanya. Atribut ini menjadi pegangan aturan <noscript> di
 * layout yang memaksa semuanya terlihat kembali. Situs ini memang berjanji
 * tetap terbaca tanpa JS, dan animasi tidak boleh membatalkan janji itu.
 */

const listVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: "easeOut" },
  },
};

export function StaggerList({
  children,
  className,
  as = "ul",
}: {
  children: ReactNode;
  className?: string;
  as?: "ul" | "div" | "dl";
}) {
  const Component =
    as === "div" ? motion.div : as === "dl" ? motion.dl : motion.ul;
  return (
    <Component
      className={className}
      data-reveal=""
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-64px" }}
      variants={listVariants}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className,
  as = "li",
}: {
  children: ReactNode;
  className?: string;
  as?: "li" | "div";
}) {
  const Component = as === "div" ? motion.div : motion.li;
  return (
    <Component className={className} data-reveal="" variants={itemVariants}>
      {children}
    </Component>
  );
}

/** Entrance tunggal untuk elemen yang bukan bagian dari daftar. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      data-reveal=""
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-64px" }}
      transition={{ duration: 0.36, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
