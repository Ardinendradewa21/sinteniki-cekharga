import { createRefreshAuthRouter } from "@insforge/sdk/ssr";

/**
 * Titik penyegaran sesi (PRD §10).
 *
 * Refresh token disimpan httpOnly dan dimiliki server, jadi penyegarannya harus
 * terjadi di endpoint server seperti ini, bukan di browser. Dipanggil oleh
 * helper SSR InsForge saat access token sudah dekat kedaluwarsa.
 */
export const { POST } = createRefreshAuthRouter({
  baseUrl: process.env.INSFORGE_URL,
  anonKey: process.env.INSFORGE_ANON_KEY,
});
