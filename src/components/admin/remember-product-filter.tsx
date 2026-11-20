"use client";

import { useEffect } from "react";

import { ADMIN_PRODUCT_FILTER_COOKIE } from "@/lib/admin/preferences-config";

/**
 * Menyimpan filter Kelola produk yang sedang tampil ke cookie (AV-02).
 *
 * Server Component tidak boleh menulis cookie saat render (dokumentasi Next
 * 16, `cookies`), jadi penulisan dilakukan di sini; halaman server hanya
 * membaca dan memulihkannya. Nilai kosong (filter "Semua merek") menghapus
 * cookie. Hanya preferensi tampilan, bukan data sensitif.
 */
export function RememberProductFilter({ value }: { value: string }) {
  useEffect(() => {
    try {
      document.cookie = value
        ? `${ADMIN_PRODUCT_FILTER_COOKIE}=${encodeURIComponent(value)}; path=/admin; max-age=${30 * 24 * 60 * 60}; samesite=lax`
        : `${ADMIN_PRODUCT_FILTER_COOKIE}=; path=/admin; max-age=0; samesite=lax`;
    } catch {
      // Cookie diblokir browser: filter tidak diingat, halaman tetap jalan.
    }
  }, [value]);
  return null;
}
