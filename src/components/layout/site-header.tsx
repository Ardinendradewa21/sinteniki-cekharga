import Link from "next/link";

import { Container } from "@/components/layout/container";
import { SiteNav } from "@/components/layout/site-nav";
import type { PublicTheme } from "@/lib/public/preferences-config";

/**
 * Header situs (PRD §8): wordmark, navigasi kapsul, tombol ikon bulat untuk
 * fungsi yang tersedia. Tidak ada keranjang atau favorit: CekHarga bukan
 * marketplace dan belum punya akun pengguna.
 */
export function SiteHeader({ initialTheme }: { initialTheme: PublicTheme }) {
  return (
    <header className="relative z-50 border-b border-white/55 bg-background/78 backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10">
      <Container className="flex h-20 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2.5 rounded-lg text-lg font-extrabold tracking-tight text-foreground"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-xs font-extrabold text-brand-foreground shadow-sm">
            CH
          </span>
          <span>CekHarga</span>
        </Link>

        <SiteNav initialTheme={initialTheme} />
      </Container>
    </header>
  );
}
