import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import { Container } from "@/components/layout/container";
import { SiteNav } from "@/components/layout/site-nav";

/**
 * Header situs (PRD §8): wordmark, navigasi kapsul, tombol ikon bulat untuk
 * fungsi yang tersedia. Tidak ada keranjang atau favorit: CekHarga bukan
 * marketplace dan belum punya akun pengguna.
 */
export function SiteHeader() {
  return (
    <header className="relative border-b border-border bg-background">
      <Container className="flex h-20 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex min-h-11 items-center rounded-lg text-lg font-extrabold tracking-tight text-foreground"
        >
          CekHarga
        </Link>

        <div className="flex items-center gap-2">
          <SiteNav />

          <Link
            href="/products"
            className="flex size-11 items-center justify-center rounded-pill border border-border bg-card text-foreground transition-colors duration-150 hover:bg-muted"
          >
            <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.8} aria-hidden />
            <span className="sr-only">Cari produk</span>
          </Link>
        </div>
      </Container>
    </header>
  );
}
