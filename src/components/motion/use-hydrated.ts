import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` saat render server dan hydration, `true` setelahnya.
 *
 * Dipakai untuk membedakan elemen yang ada sejak halaman dibuka (tanpa
 * animasi masuk) dari elemen yang muncul belakangan karena interaksi, mis.
 * kartu baru setelah filter berubah. Memakai useSyncExternalStore, bukan
 * setState di dalam effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
