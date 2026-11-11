"use client";

import { useEffect, useRef } from "react";

/**
 * Peningkatan kecil untuk chip filter katalog yang berbasis `<details>`.
 *
 * Tanpa JavaScript, chip tetap berfungsi: klik membuka dan menutup panel, dan
 * semua isian tetap ikut terkirim. Dengan JavaScript, panel berperilaku seperti
 * popover: hanya satu yang terbuka, Escape dan klik di luar menutupnya, dan
 * mengganti urutan langsung menerapkan pencarian.
 */
export function FilterPopoverDismiss() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const pops = () => Array.from(form.querySelectorAll<HTMLDetailsElement>("details[data-filter-pop]"));

    const onToggle = (event: Event) => {
      const target = event.target as HTMLDetailsElement;
      if (!target.matches?.("details[data-filter-pop]") || !target.open) return;
      for (const other of pops()) if (other !== target) other.open = false;
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
    const onChange = (event: Event) => {
      if ((event.target as HTMLElement).matches?.("select[data-auto-submit]")) form.requestSubmit();
    };

    form.addEventListener("toggle", onToggle, true);
    form.addEventListener("change", onChange);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      form.removeEventListener("toggle", onToggle, true);
      form.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return <span ref={ref} hidden />;
}
