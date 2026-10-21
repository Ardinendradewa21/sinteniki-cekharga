"use client";

import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button-variants";

/**
 * Tautan bookmarklet "Salin ke CekHarga" untuk diseret ke bilah bookmark.
 *
 * React memblokir URL `javascript:` di atribut href (perlindungan XSS), jadi
 * href dipasang lewat DOM setelah komponen terpasang. URL-nya berasal dari
 * konstanta server (price-helper.ts), bukan masukan pengguna. Klik biasa di
 * halaman admin dicegah karena alat ini hanya berguna di halaman marketplace.
 */
export function PriceHelperLink({ href }: { href: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", href);
  }, [href]);
  return (
    <a
      ref={ref}
      onClick={(event) => event.preventDefault()}
      draggable
      className={buttonVariants({ className: "cursor-grab" })}
      title="Seret tombol ini ke bilah bookmark browser"
    >
      Salin ke CekHarga
    </a>
  );
}
