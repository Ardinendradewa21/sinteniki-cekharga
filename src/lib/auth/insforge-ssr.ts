import "server-only";

import { cookies } from "next/headers";
import { createAuthActions, createServerClient } from "@insforge/sdk/ssr";
import { z } from "zod";

/**
 * Pembungkus helper SSR InsForge (PRD §10).
 *
 * Kenapa konfigurasinya dioper eksplisit, bukan dibiarkan dibaca otomatis?
 *
 * Helper SSR bawaan membaca `NEXT_PUBLIC_INSFORGE_URL` dan
 * `NEXT_PUBLIC_INSFORGE_ANON_KEY` kalau tidak diberi apa-apa. Prefix
 * NEXT_PUBLIC berarti nilainya ikut ke bundel browser. CekHarga tidak pernah
 * memanggil SDK dari browser: seluruh auth berjalan lewat Server Action dan
 * Route Handler. Dengan mengoper `baseUrl`/`anonKey` dari variabel server
 * biasa, tidak ada satu pun kunci yang perlu dikirim ke klien.
 *
 * Catatan jujur soal cookie: `insforge_access_token` sengaja dibuat terbaca
 * JavaScript oleh SDK agar SDK browser dan Realtime bisa dipakai. CekHarga
 * tidak memakai keduanya, jadi kemampuan itu tidak kita manfaatkan, tetapi
 * cookie-nya tetap ada. Yang penting dan memang terjaga: `insforge_refresh_token`
 * tetap httpOnly dan milik server.
 */

const envSchema = z.object({
  INSFORGE_URL: z.httpUrl(),
  INSFORGE_ANON_KEY: z.string().min(1),
});

function readEnv() {
  const parsed = envSchema.safeParse({
    INSFORGE_URL: process.env.INSFORGE_URL,
    INSFORGE_ANON_KEY: process.env.INSFORGE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "Konfigurasi auth belum lengkap: INSFORGE_URL dan INSFORGE_ANON_KEY wajib " +
        "diisi di .env.local. Ambil anon key dengan " +
        "`npx @insforge/cli secrets get ANON_KEY`."
    );
  }

  return { baseUrl: parsed.data.INSFORGE_URL, anonKey: parsed.data.INSFORGE_ANON_KEY };
}

/** Klien yang membawa sesi pengguna dari cookie. Untuk membaca, bukan mengubah sesi. */
export async function getSessionClient() {
  return createServerClient({ ...readEnv(), cookies: await cookies() });
}

/** Aksi yang MENULIS cookie sesi: masuk dan keluar. */
export async function getAuthActions() {
  return createAuthActions({ ...readEnv(), cookies: await cookies() });
}
