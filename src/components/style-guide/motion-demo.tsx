"use client";

import { useState } from "react";

import { CountUp } from "@/components/motion/count-up";
import { SegmentedControl } from "@/components/motion/segmented-control";

/*
  Demo komponen motion untuk /style-guide (halaman internal, noindex).
  Angka harga di sini sengaja diberi label "contoh": bukan data pasar.
*/

const VARIANTS = [
  { value: "8-128", label: "8/128 GB", price: 3_999_000 },
  { value: "8-256", label: "8/256 GB", price: 4_399_000 },
  { value: "12-256", label: "12/256 GB", price: 4_799_000 },
  { value: "12-512", label: "12/512 GB", price: 5_499_000, disabled: true },
] as const;

type VariantValue = (typeof VARIANTS)[number]["value"];

export function CountUpDemo() {
  const [variant, setVariant] = useState<VariantValue>("8-256");
  const active = VARIANTS.find((item) => item.value === variant) ?? VARIANTS[1];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">Mulai dari (angka contoh)</p>
      <p className="mt-1 flex items-baseline gap-1 font-extrabold text-card-foreground">
        <span className="text-xl text-muted-foreground">Rp</span>
        <CountUp value={active.price} format="number" className="text-4xl tracking-tight" />
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Varian {active.label} · diperiksa 7 jam lalu (contoh)</p>
      <SegmentedControl
        label="Pilih varian contoh"
        className="mt-4"
        value={variant}
        onValueChange={setVariant}
        options={VARIANTS.map((item) => ({
          value: item.value,
          label: item.label,
          disabled: "disabled" in item ? item.disabled : false,
        }))}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        12/512 GB nonaktif untuk memperlihatkan pilihan yang dilewati keyboard.
      </p>
    </div>
  );
}

const COLORS = ["Hitam Malam", "Putih Salju", "Hijau Daun", "Biru Laut", "Ungu Senja", "Emas", "Perak"] as const;

export function WrapDemo() {
  const [color, setColor] = useState<string>(COLORS[2]);
  return (
    <div className="max-w-sm">
      <SegmentedControl
        label="Pilih warna contoh"
        value={color}
        onValueChange={setColor}
        options={COLORS.map((name) => ({ value: name, label: name }))}
      />
      <p className="mt-2 text-xs text-muted-foreground">Bawaan: pilihan yang tidak muat membungkus ke baris berikutnya.</p>
    </div>
  );
}

const SORTS = [
  { value: "relevansi", label: "Relevansi" },
  { value: "harga-naik", label: "Harga naik" },
  { value: "harga-turun", label: "Harga turun" },
  { value: "diperiksa", label: "Terakhir diperiksa" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

export function CollapseDemo() {
  const [sort, setSort] = useState<SortValue>("relevansi");
  return (
    <div>
      <SegmentedControl label="Urutkan produk (contoh)" value={sort} onValueChange={setSort} options={SORTS} collapseBelow="sm" />
      <p className="mt-2 text-xs text-muted-foreground">
        collapseBelow=&quot;sm&quot;: di bawah 640px menjadi select native (urutan katalog di HP).
      </p>
    </div>
  );
}
