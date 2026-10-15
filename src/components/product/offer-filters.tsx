"use client";

import { useState } from "react";

/**
 * Pilihan pengguna di daftar penawaran (PB-27): sembunyikan stok habis, dan
 * hanya garansi resmi Indonesia. Ini filter pilihan pengguna, bukan aturan
 * katalog (PRD §3), jadi bawaannya semua penawaran tampil.
 *
 * Kartu disembunyikan lewat atribut data di pembungkus, tanpa memuat ulang
 * halaman. Tanpa JavaScript, semua penawaran tetap tampil. Pilihan garansi
 * hanya muncul bila ada penawaran yang garansinya tercatat resmi; kalau tidak,
 * filter itu akan mengosongkan daftar padahal datanya yang belum ada.
 */
export function OfferFilters({
  outOfStockCount,
  officialCount,
  total,
  children,
}: {
  outOfStockCount: number;
  officialCount: number;
  total: number;
  children: React.ReactNode;
}) {
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [officialOnly, setOfficialOnly] = useState(false);
  const shown = total - (hideOutOfStock ? outOfStockCount : 0);

  return (
    <div data-hide-oos={hideOutOfStock} data-official-only={officialOnly} className="group/offers">
      {outOfStockCount > 0 || officialCount > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {outOfStockCount > 0 ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={hideOutOfStock}
                onChange={(event) => setHideOutOfStock(event.target.checked)}
                className="size-4 accent-brand"
              />
              Sembunyikan stok habis ({outOfStockCount})
            </label>
          ) : null}
          {officialCount > 0 ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={officialOnly}
                onChange={(event) => setOfficialOnly(event.target.checked)}
                className="size-4 accent-brand"
              />
              Hanya garansi resmi Indonesia ({officialCount})
            </label>
          ) : null}
        </div>
      ) : null}
      {children}
      {hideOutOfStock && shown === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Semua penawaran varian ini sedang habis.</p>
      ) : null}
    </div>
  );
}
