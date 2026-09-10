import "server-only";

import { createAdminClient } from "@insforge/sdk";
import { z } from "zod";

/**
 * Klien InsForge sisi server (PRD §9 dan §10).
 *
 * Tiga keputusan yang dikunci di sini:
 *
 * 1. `import "server-only"`. Modul ini memegang kunci setara service-role;
 *    kalau sampai ter-import dari Client Component, build harus gagal, bukan
 *    diam-diam mengirim kunci ke browser.
 *
 * 2. Tidak ada variabel ber-prefix `NEXT_PUBLIC`. Seluruh pembacaan data
 *    CekHarga terjadi di Server Component, jadi browser tidak pernah butuh
 *    kredensial apa pun. Ini menutup seluruh kelas kebocoran kunci sejak awal,
 *    bukan menambalnya belakangan.
 *
 * 3. Validasi environment memakai Zod dan dilakukan MALAS (saat klien pertama
 *    kali dipakai), bukan saat modul dimuat. Alasannya: mode demo harus tetap
 *    bisa dijalankan siapa pun tanpa kredensial sama sekali. Kalau validasi
 *    berjalan di level modul, sekadar meng-import file ini dari jalur mana pun
 *    akan mematikan mode demo.
 *
 * Yang TIDAK dilakukan di sini: menyembunyikan kegagalan. Kalau mode live
 * dipilih tetapi konfigurasinya belum ada, fungsi ini melempar error dengan
 * pesan yang menjelaskan cara memperbaikinya. PRD §9 melarang fallback diam-diam
 * ke fixture.
 */

const envSchema = z.object({
  INSFORGE_URL: z
    .httpUrl()
    .describe("Base URL project InsForge, mis. https://<appkey>.<region>.insforge.app"),
  INSFORGE_API_KEY: z
    .string()
    .min(1)
    .describe("Kunci admin project. Setara service-role, server-only."),
});

export type InsforgeAdminClient = ReturnType<typeof createAdminClient>;

let cachedClient: InsforgeAdminClient | null = null;

/**
 * Klien admin InsForge, dibuat sekali lalu dipakai ulang.
 *
 * Melempar error yang menjelaskan langkah perbaikan bila environment belum
 * lengkap. Pesannya sengaja menyebut nama variabel dan perintah CLI-nya, karena
 * ini kegagalan konfigurasi operator, bukan sesuatu yang boleh sampai ke
 * pengunjung situs. Pemanggil di jalur render membungkusnya lewat
 * DataErrorBoundary sehingga pengunjung hanya melihat pesan umum.
 */
export function getInsforgeAdminClient(): InsforgeAdminClient {
  if (cachedClient) return cachedClient;

  const parsed = envSchema.safeParse({
    INSFORGE_URL: process.env.INSFORGE_URL,
    INSFORGE_API_KEY: process.env.INSFORGE_API_KEY,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Konfigurasi InsForge belum lengkap (${missing}). ` +
        "Salin .env.example menjadi .env.local lalu isi INSFORGE_URL dan " +
        "INSFORGE_API_KEY dari .insforge/project.json. " +
        "Selama belum siap, jalankan dengan CEKHARGA_DATA_SOURCE=demo."
    );
  }

  cachedClient = createAdminClient({
    baseUrl: parsed.data.INSFORGE_URL,
    apiKey: parsed.data.INSFORGE_API_KEY,
  });

  return cachedClient;
}

/**
 * Apakah kredensial InsForge tersedia di environment.
 *
 * Dipakai health check untuk membedakan "belum dikonfigurasi" dari "sudah
 * dikonfigurasi tetapi tidak bisa dihubungi". Hanya memeriksa keberadaan, tidak
 * pernah mengembalikan nilainya.
 */
export function hasInsforgeCredentials(): boolean {
  return Boolean(process.env.INSFORGE_URL && process.env.INSFORGE_API_KEY);
}
