/**
 * `fetch` untuk SDK InsForge: permintaan baca yang macet dicoba ulang sekali.
 *
 * Backend InsForge menutup koneksi HTTP yang menganggur setelah 65 detik.
 * Fungsi Vercel yang hangat bisa memakai ulang soket yang sudah ditutup itu,
 * dan permintaan pertamanya macet sampai timeout SDK (30 detik) lalu gagal
 * tanpa dicoba ulang (SDK tidak mengulang timeout). Inilah galat produksi
 * "[katalog] gagal membaca ... Request timed out after 30000ms".
 *
 * Saran dokumentasi InsForge (Schedules: long-interval callers and
 * keep-alive): batas waktu pendek, lalu coba sekali lagi di koneksi baru.
 * Membatalkan permintaan membuang soketnya, jadi percobaan kedua membuka
 * koneksi baru.
 *
 * Hanya GET/HEAD yang diulang. Tulis (POST/PATCH/DELETE) tidak pernah diulang
 * di sini supaya tidak ada data ganda; batas waktu tulis tetap milik SDK.
 */

/** Batas per percobaan baca; dua percobaan tetap di bawah timeout SDK 30 detik. */
const READ_ATTEMPT_TIMEOUT_MS = 12_000;

export function resilientFetch(
  base: typeof fetch = (input, init) => globalThis.fetch(input, init),
  attemptTimeoutMs = READ_ATTEMPT_TIMEOUT_MS
): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "GET" && method !== "HEAD") return base(input, init);

    for (let attempt = 1; ; attempt += 1) {
      const timeout = AbortSignal.timeout(attemptTimeoutMs);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      try {
        return await base(input, { ...init, signal });
      } catch (error) {
        // Dibatalkan pemanggil (SDK) atau gagal karena hal lain: teruskan apa adanya.
        if (attempt >= 2 || init?.signal?.aborted || !timeout.aborted) throw error;
        console.warn(`[insforge] baca macet > ${attemptTimeoutMs} ms, dicoba ulang di koneksi baru.`);
      }
    }
  };
}
