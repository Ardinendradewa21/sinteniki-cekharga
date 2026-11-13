import Link from "next/link";

import { Container } from "@/components/layout/container";
import { SiteNav } from "@/components/layout/site-nav";
import type { PublicTheme } from "@/lib/public/preferences-config";

/**
 * Glass Header (PRD §8, DESIGN.md §7): wordmark, navigasi kapsul, tombol ikon
 * bulat untuk fungsi yang tersedia. Tidak ada keranjang atau favorit:
 * CekHarga bukan marketplace dan belum punya akun pengguna.
 *
 * Menempel di atas sebagai kapsul kaca mengambang (`glass-text` agar teks
 * lolos 4.5:1 di atas foto terburuk, `glass-float` = backdrop blur 16px, satu
 * dari sedikit elemen yang boleh memakainya). Tingginya sama dengan
 * `--header-h` di globals.css (12/16px + kapsul 56/64px + 8px), yang dipakai
 * scroll-padding supaya fokus keyboard tidak tertutup header.
 *
 * Elemen <header> sendiri transparan dan tidak menangkap klik; hanya kapsul
 * dan menu ponsel yang interaktif, jadi konten di sela-selanya tetap bisa
 * diklik saat menggulir.
 */
export function SiteHeader({ initialTheme }: { initialTheme: PublicTheme }) {
  return (
    <header className="pointer-events-none sticky top-0 z-50 pt-3 pb-2 md:pt-4">
      <Container>
        <div className="glass-text glass-float pointer-events-auto flex h-14 items-center justify-between gap-3 rounded-pill pr-1.5 pl-2 md:h-16 md:pr-2 md:pl-3">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-pill pr-2 text-lg font-extrabold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 items-center justify-center rounded-pill bg-brand text-xs font-extrabold text-brand-foreground">
              CH
            </span>
            <span>CekHarga</span>
          </Link>

          <SiteNav initialTheme={initialTheme} />
        </div>
      </Container>
    </header>
  );
}
