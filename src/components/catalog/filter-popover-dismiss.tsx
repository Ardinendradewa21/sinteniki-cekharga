"use client";

import { useEffect, useRef } from "react";

/**
 * Peningkatan kecil untuk chip filter katalog yang berbasis `<details>`.
 *
 * Tanpa JavaScript, chip tetap berfungsi: klik membuka dan menutup panel, dan
 * semua isian tetap ikut terkirim. Dengan JavaScript, panel berperilaku seperti
 * popover: hanya satu yang terbuka, Escape dan klik di luar (termasuk latar
 * redup di ponsel) menutupnya, halaman di belakang lembar ponsel tidak ikut
 * tergulir, dan mengganti urutan langsung menerapkan pencarian.
 */
export function FilterPopoverDismiss() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const pops = () => Array.from(form.querySelectorAll<HTMLDetailsElement>("details[data-filter-pop]"));
    // Di ponsel panel tampil sebagai lembar bawah; gulir halaman dikunci selama terbuka.
    const phone = window.matchMedia("(max-width: 39.999rem)");
    const syncScrollLock = () => {
      const locked = phone.matches && pops().some((pop) => pop.open);
      document.documentElement.style.overflow = locked ? "hidden" : "";
    };

    const onToggle = (event: Event) => {
      const target = event.target as HTMLDetailsElement;
      if (!target.matches?.("details[data-filter-pop]")) return;
      if (target.open) for (const other of pops()) if (other !== target) other.open = false;
      syncScrollLock();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const open = pops().find((pop) => pop.open);
      if (!open) return;
      open.open = false;
      open.querySelector("summary")?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      for (const pop of pops()) {
        if (pop.open && !pop.contains(event.target as Node)) pop.open = false;
      }
    };
    // Latar redup ditutup saat `click`, bukan `pointerdown`: bila ditutup lebih
    // awal, ketukan yang sama jatuh ke tautan produk di bawah latar.
    const onClick = (event: MouseEvent) => {
      const backdrop = (event.target as Element).closest?.("[data-filter-backdrop]");
      const pop = backdrop?.closest<HTMLDetailsElement>("details[data-filter-pop]");
      if (!pop) return;
      event.preventDefault();
      pop.open = false;
    };
    const onChange = (event: Event) => {
      if ((event.target as HTMLElement).matches?.("select[data-auto-submit]")) form.requestSubmit();
    };

    form.addEventListener("toggle", onToggle, true);
    form.addEventListener("change", onChange);
    form.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      form.removeEventListener("toggle", onToggle, true);
      form.removeEventListener("change", onChange);
      form.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.documentElement.style.overflow = "";
    };
  }, []);

  return <span ref={ref} hidden />;
}
