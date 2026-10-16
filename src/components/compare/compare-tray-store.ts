import { parseTrayItems, toggleTrayItem, type TrayItem, type TrayToggle } from "@/lib/catalog/compare-tray-rules";

/**
 * Penyimpanan baki bandingkan di sisi klien. Pilihan disimpan di
 * sessionStorage supaya tetap ada saat pengguna pindah halaman katalog atau
 * mengganti filter, dan hilang saat tab ditutup. Ini hanya kenyamanan per
 * pengunjung; sumber kebenaran perbandingan tetap URL `/compare`.
 */

const KEY = "cekharga:baki-bandingkan";
const EVENT = "cekharga-baki-bandingkan";
const EMPTY: TrayItem[] = [];

let cachedRaw: string | null = null;
let cachedItems: TrayItem[] = EMPTY;

function readRaw(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function readTray(): TrayItem[] {
  const raw = readRaw();
  // useSyncExternalStore butuh referensi yang sama selama isinya sama.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = parseTrayItems(raw);
  }
  return cachedItems;
}

export function readTrayOnServer(): TrayItem[] {
  return EMPTY;
}

function writeTray(items: TrayItem[]): void {
  try {
    if (items.length === 0) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Penyimpanan diblokir (mode privat): pilihan hanya hidup di memori.
    cachedRaw = items.length === 0 ? null : JSON.stringify(items);
    cachedItems = items;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function toggleTray(item: TrayItem): TrayToggle["outcome"] {
  const result = toggleTrayItem(readTray(), item);
  if (result.outcome === "full") {
    window.dispatchEvent(new CustomEvent(`${EVENT}:penuh`));
  } else {
    writeTray(result.items);
  }
  return result.outcome;
}

export function removeFromTray(slug: string): void {
  writeTray(readTray().filter((entry) => entry.slug !== slug));
}

export function clearTray(): void {
  writeTray([]);
}

export function subscribeTray(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

export function subscribeTrayFull(callback: () => void): () => void {
  window.addEventListener(`${EVENT}:penuh`, callback);
  return () => window.removeEventListener(`${EVENT}:penuh`, callback);
}
