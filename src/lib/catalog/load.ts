import "server-only";

/**
 * Menjalankan pemuatan data dan mengubah kegagalan menjadi nilai, bukan
 * lemparan.
 *
 * Alasannya ada di PRD §9 dan §8 sekaligus. Ketika Server Component di dalam
 * <Suspense> melempar, React membatalkan SSR bagian itu dan mengirim fallback;
 * UI error baru muncul setelah hydration. Pengunjung tanpa JavaScript hanya
 * melihat skeleton yang tidak pernah selesai, dan PRD melarang skeleton yang
 * tidak mewakili proses nyata. Dengan mengembalikan null, komponen bisa
 * merender panel kegagalan langsung di HTML server.
 *
 * `notFound()` dan `redirect()` bekerja dengan melempar error khusus, jadi
 * keduanya diteruskan apa adanya. Tanpa ini, slug tidak dikenal akan berubah
 * menjadi "gagal memuat data" padahal seharusnya 404.
 *
 * Error aslinya dicatat di server saja, tidak pernah sampai ke browser.
 */
export async function loadOrNull<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    console.error("[data] pemuatan gagal:", error);
    return null;
  }
}

function isNextControlFlowError(error: unknown): boolean {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest ?? "")
      : "";
  return (
    digest === "NEXT_NOT_FOUND" ||
    digest.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
  );
}
