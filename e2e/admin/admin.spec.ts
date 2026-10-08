import { randomBytes } from "node:crypto";

import { expect, test, type APIRequestContext } from "@playwright/test";

// FR-07 Admin data, Pusat Impor, dan pembatasan peran staf.

test.describe("Dasbor admin", () => {
  test("TC-ADM-01 metrik kesehatan dan celah data tampil @smoke", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Harga masih segar")).toBeVisible();
    await expect(page.getByText("Terbit tanpa harga")).toBeVisible();
    for (const group of ["tanpa-penawaran", "tanpa-foto", "spesifikasi-kosong"]) {
      await expect(page.getByTestId(`gap-${group}`)).toBeVisible();
    }
  });

  test("TC-ADM-02 tautan Tarik ulang memilih merek dan model @regression", async ({ page }) => {
    await page.goto("/admin");
    await page.getByTestId("gap-tanpa-penawaran").locator("summary").click();
    const rescrape = page.getByTestId("gap-tanpa-penawaran").getByRole("link", { name: "Tarik ulang" }).first();
    test.skip((await rescrape.count()) === 0, "tidak ada produk terbit tanpa penawaran dari merek yang didukung");
    const href = (await rescrape.getAttribute("href"))!;
    const params = new URL(href, "http://x").searchParams;
    await rescrape.click();
    await expect(page).toHaveURL(/tab=tarik/);
    await expect(page.locator("select").first()).toHaveValue(params.get("merek")!);
  });

  test("TC-ADM-03 riwayat dasbor tidak memuat batch terjadwal @regression", async ({ page }) => {
    await page.goto("/admin");
    const history = page.locator("section[aria-labelledby=riwayat-impor]");
    await expect(history).toBeVisible();
    // Subjudul panel sengaja menyebut pemeriksaan harian; yang diuji isi daftarnya.
    await expect(history.locator("li").filter({ hasText: /Pemeriksaan harga harian/ })).toHaveCount(0);
  });
});

test.describe("Pusat Impor", () => {
  test("TC-IMP-01 empat tab tersedia dan tab riwayat menampilkan asal batch @smoke", async ({ page }) => {
    await page.goto("/admin/import");
    const nav = page.getByRole("navigation", { name: "Sumber impor" });
    for (const tab of [/unggah/i, /tarik/i, /foto/i, /riwayat/i]) await expect(nav.getByRole("link", { name: tab })).toBeVisible();
    await nav.getByRole("link", { name: /riwayat/i }).click();
    await expect(page.locator("main")).toContainText(/CSV|Tarik otomatis|Pemeriksaan harian/);
  });

  test("TC-IMP-02 /admin/scrape dialihkan ke tab Tarik otomatis @regression", async ({ page }) => {
    await page.goto("/admin/scrape");
    await expect(page).toHaveURL(/\/admin\/import\?tab=tarik/);
  });
});

// ---------------------------------------------------------------- peran staf

const backend = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;

async function createStaff(request: APIRequestContext, role: string) {
  const email = `qa-${role}-${Date.now()}@example.com`;
  const password = `${randomBytes(18).toString("base64url")}A1!`;
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  const created = await request.post(`${backend}/api/auth/users`, { headers, data: { email, password, autoConfirm: true } });
  expect(created.ok(), await created.text()).toBe(true);
  const listed = await (await request.get(`${backend}/api/auth/users?search=${encodeURIComponent(email)}`, { headers })).json();
  const userId: string = (listed.data ?? listed.users ?? listed).find((user: { email: string }) => user.email === email).id;
  const granted = await request.post(`${backend}/api/database/records/admin_users`, {
    headers,
    data: [{ user_id: userId, email, role, note: "QA Playwright sementara" }],
  });
  expect(granted.ok(), await granted.text()).toBe(true);
  return { email, password, userId };
}

async function deleteStaff(request: APIRequestContext, userId: string) {
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  await request.delete(`${backend}/api/database/records/admin_users?user_id=eq.${userId}`, { headers });
  await request.delete(`${backend}/api/auth/users`, { headers, data: { userIds: [userId] } });
}

test.describe("Peran staf non-admin", () => {
  test.skip(!backend || !apiKey, "INSFORGE_URL / INSFORGE_API_KEY tidak tersedia");
  test.use({ storageState: { cookies: [], origins: [] } });

  let staff: { email: string; password: string; userId: string } | null = null;
  test.beforeAll(async ({ request }) => {
    staff = await createStaff(request, "sales");
  });
  test.afterAll(async ({ request }) => {
    if (staff) await deleteStaff(request, staff.userId);
  });

  test("TC-ROLE-01 sales masuk ke beranda staf, ditolak dari impor dan produk @smoke", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(staff!.email);
    await page.getByLabel("Kata sandi").fill(staff!.password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL(/\/admin$/);
    await expect(page.locator("main")).toContainText(/Modul yang tersedia untuk Anda/);
    for (const path of ["/admin/import", "/admin/products", "/admin/products/baru"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/alasan=akses-ditolak/);
    }
    await page.goto("/admin/iklan");
    await expect(page).toHaveURL(/\/admin\/iklan$/);
  });
});
