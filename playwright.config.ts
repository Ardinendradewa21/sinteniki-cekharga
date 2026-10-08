import { defineConfig, devices } from "@playwright/test";

/**
 * Suite E2E CekHarga (docs/qa/TEST-PLAN.md).
 *
 * - Memakai Chrome yang terpasang (`channel: "chrome"`), jadi tidak perlu
 *   mengunduh browser Playwright.
 * - Kredensial TIDAK pernah ditulis di repo. Akun admin dibaca dari
 *   QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD; kunci backend dibaca dari .env.local
 *   (hanya untuk membuat akun staf sementara di uji peran).
 * - Tag: @smoke (jalur kritis, < 2 menit) dan @regression (lengkap).
 *   `pnpm test:e2e:smoke` menjalankan @smoke saja.
 * - Suite ini hanya MEMBACA data katalog. Uji yang menulis (impor, undo)
 *   ada di uji integrasi `pnpm test:integration` dengan data penanda QAUji.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // Tanpa .env.local, uji yang butuh kunci backend dilewati (lihat fixture).
}

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const hasAdmin = Boolean(process.env.QA_ADMIN_EMAIL && process.env.QA_ADMIN_PASSWORD);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Dev server Next mengompilasi halaman saat pertama dibuka; beri waktu.
  timeout: 90_000,
  // 30 detik: navigasi pertama ke sebuah rute di dev server memicu kompilasi
  // on-demand, dan di bawah beban 3 worker bisa melewati 15 detik (flaky
  // TC-KAT-01/TC-BRD-01/02, 2026-10-07). Di build produksi jauh lebih cepat.
  expect: { timeout: 30_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    channel: "chrome",
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "publik", testMatch: /public\/.*\.spec\.ts/, testIgnore: /\.mobile\.spec\.ts/, use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "publik-mobile", testMatch: /public\/.*\.mobile\.spec\.ts/, use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "keamanan", testMatch: /security\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    ...(hasAdmin
      ? [
          { name: "setup-admin", testMatch: /admin\/auth\.setup\.ts/, use: { channel: "chrome" } },
          {
            name: "admin",
            testMatch: /admin\/.*\.spec\.ts/,
            dependencies: ["setup-admin"],
            use: { ...devices["Desktop Chrome"], channel: "chrome", storageState: "e2e/.auth/admin.json" },
          },
        ]
      : []),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next dev --port ${PORT}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
