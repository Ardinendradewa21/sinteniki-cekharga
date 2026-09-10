import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

/**
 * Kerangka "composer" untuk asisten.
 *
 * Bentuknya mengambil anatomi antarmuka Claude yang dijadikan referensi: satu
 * kotak menonjol berisi pertanyaan, dengan kontrolnya terselip di baris bawah
 * kotak yang sama, bukan tersebar sebagai form panjang. Efeknya halaman terasa
 * tenang dan fokusnya jelas pada satu hal yang sedang ditanyakan.
 *
 * Yang TIDAK diambil dari referensi adalah skema warna gelapnya. Tema gelap
 * belum ditetapkan di PRD §8; palet CekHarga adalah canvas abu muda dengan
 * permukaan putih. Menyalin latar gelap berarti mengambil keputusan brand yang
 * belum ada, jadi yang dipinjam hanya tata letak dan ketenangannya.
 */
export function Composer({
  children,
  controls,
  submitLabel,
  className,
}: {
  /** Isi utama: pertanyaan dan kontrol jawabannya. */
  children: React.ReactNode;
  /** Keterangan kecil di kiri baris bawah, mis. status atau petunjuk. */
  controls?: React.ReactNode;
  submitLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm",
        className
      )}
    >
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">{children}</div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0 text-xs text-muted-foreground">{controls}</div>

        <button
          type="submit"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {submitLabel}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={16}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}

/**
 * Opsi berbentuk pill di dalam composer.
 *
 * Memakai input native yang disembunyikan secara visual lalu digayakan lewat
 * `peer-checked`, sehingga seluruh kontrol tetap form HTML biasa: bisa dipakai
 * keyboard, terbaca pembaca layar, dan berfungsi tanpa JavaScript. Fokusnya
 * dipindahkan ke pill lewat `peer-focus-visible` supaya tetap terlihat meski
 * input aslinya tidak tampak.
 */
export function OptionPill({
  type,
  name,
  value,
  label,
  defaultChecked,
  required,
}: {
  type: "checkbox" | "radio";
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
  required?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        className="peer sr-only"
      />
      <span className="flex min-h-11 items-center rounded-pill border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
        {label}
      </span>
    </label>
  );
}
