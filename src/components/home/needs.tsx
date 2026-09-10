import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiMagicIcon,
  ArrowDataTransferHorizontalIcon,
  EyeIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { StaggerItem, StaggerList } from "@/components/motion/reveal";
import { Section } from "@/components/section";

/**
 * "Pilih sesuai kebutuhan": empat pendekatan dari PRD §2.
 *
 * Dua batasan yang harus dijaga:
 * - PRD §2: keempatnya berasal dari pengamatan awal pemilik produk, bukan riset
 *   pengguna formal. Jangan menuliskannya seolah temuan riset.
 * - PRD FR-01: boleh menjelaskan kategori kebutuhan tanpa mengklaim urutan
 *   terbaik. Jadi tidak ada "paling populer", nomor urut, atau rekomendasi.
 */
const APPROACHES = [
  {
    icon: AiMagicIcon,
    approach: "Tahu budget, malas urus spesifikasi",
    support: "Konsultasi dengan bahasa sederhana.",
    href: "/assistant",
    linkLabel: "Tanya AI",
  },
  {
    icon: Search01Icon,
    approach: "Sudah tahu spesifikasi yang dicari",
    support: "Pencarian, filter, dan detail varian.",
    href: "/products",
    linkLabel: "Buka katalog",
  },
  {
    icon: ArrowDataTransferHorizontalIcon,
    approach: "Menimbang harga dengan yang didapat",
    support: "Penawaran sebanding dan komprominya.",
    href: "/compare",
    linkLabel: "Bandingkan",
  },
  {
    icon: EyeIcon,
    approach: "Mengandalkan pengalaman reviewer",
    support: "Ringkasan kurasi dengan sumber dan konteks pengujian.",
    href: "/how-it-works",
    linkLabel: "Cara kurasi review",
  },
];

export function Needs() {
  return (
    <Section
      title="Beberapa cara orang memilih"
      description="Tidak ada urutan terbaik. Satu orang bisa memakai beberapa cara sekaligus."
    >
      <StaggerList className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {APPROACHES.map((item) => (
          <StaggerItem key={item.approach}>
            {/* Micro-interaction 150ms (PRD §8): angkat tipis saat disentuh, tanpa bayangan berlebihan. */}
            <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-border-strong">
              <HugeiconsIcon
                icon={item.icon}
                size={22}
                strokeWidth={1.8}
                className="text-muted-foreground"
                aria-hidden
              />
              <h3 className="mt-4 text-sm font-bold text-foreground">
                {item.approach}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {item.support}
              </p>
              <Link
                href={item.href}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4 transition-colors duration-150 hover:text-foreground"
              >
                {item.linkLabel}
              </Link>
            </div>
          </StaggerItem>
        ))}
      </StaggerList>
    </Section>
  );
}
