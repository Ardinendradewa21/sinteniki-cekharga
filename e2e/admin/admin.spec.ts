import { randomBytes } from "node:crypto";
import fs from "node:fs";

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
  // Batch uji (berkas "qa-e2e-*") dihapus setelah suite, bukan hanya dibatalkan,
  // supaya riwayat impor produksi tidak menumpuk batch uji (PB-24).
  test.afterAll(async ({ request }) => {
    const backendUrl = process.env.INSFORGE_URL;
    const key = process.env.INSFORGE_API_KEY;
    if (!backendUrl || !key) return;
    await request.delete(`${backendUrl}/api/database/records/import_batches?source_label=like.qa-e2e*`, {
      headers: { Authorization: `Bearer ${key}` },
    });
  });

  test("TC-IMP-01 empat tab tersedia (galeri melebur ke CSV gabungan) dan tab riwayat menampilkan asal batch @smoke", async ({ page }) => {
    await page.goto("/admin/import");
    const nav = page.getByRole("navigation", { name: "Sumber impor" });
    for (const tab of ["Unggah CSV", "Tarik otomatis", "Antrean foto", "Riwayat batch"]) {
      await expect(nav.getByRole("link", { name: tab, exact: true })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Galeri foto", exact: true })).toHaveCount(0);
    await nav.getByRole("link", { name: /riwayat/i }).click();
    await expect(page.locator("main")).toContainText(/CSV|Tarik otomatis|Pemeriksaan harian/);
  });

  test("TC-IMP-02 /admin/scrape dialihkan ke tab Tarik otomatis @regression", async ({ page }) => {
    await page.goto("/admin/scrape");
    await expect(page).toHaveURL(/\/admin\/import\?tab=tarik/);
  });

  test("TC-IMP-03 hanya templat CSV gabungan (penawaran + foto) yang ditawarkan, tanpa bagian spesifikasi @regression", async ({ page }) => {
    await page.goto("/admin/import?tab=unggah");
    await expect(page.getByRole("button", { name: "Templat spesifikasi" })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /Spesifikasi/ })).toHaveCount(0);
    const cases = [
      { button: "Unduh templat CSV gabungan", file: "templat-csv-gabungan-cekharga.csv", header: /^\uFEFF?brand,model_name,slug,ram_gb,storage_gb,color,image_url,urutan,is_cover,image_source_url,/ },
    ];
    for (const { button, file, header } of cases) {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: button, exact: true }).click(),
      ]);
      expect(download.suggestedFilename()).toBe(file);
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      expect(Buffer.concat(chunks).toString("utf8")).toMatch(header);
    }
  });

  test("TC-IMP-04 satu formulir unggah: berkas penawaran format lama dikenali dari isinya @regression", async ({ page }) => {
    await page.goto("/admin/import?tab=unggah");
    // Tidak ada lagi formulir terpisah untuk spesifikasi dan penawaran.
    await expect(page.getByRole("button", { name: "Buat pratinjau" })).toHaveCount(1);
    const csv =
      "slug,ram_gb,storage_gb,marketplace,seller_name,url,warranty,listing_status,seller_verified,price_idr,observed_at\n" +
      "oppo-a6c,4,128,Blibli,Toko QA E2E,https://www.blibli.com/p/qa-e2e-tc-imp-04,,,,,\n";
    await page.locator("#berkas").setInputFiles({ name: "qa-e2e-satu-formulir.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: "Buat pratinjau" }).click();
    await page.waitForURL(/\/admin\/import\/batch\//, { timeout: 60_000 });
    await expect(page.locator("main")).toContainText("Penawaran dan harga");
    // Batch uji tidak diterapkan; dibatalkan supaya riwayat tetap bersih.
    await page.getByRole("button", { name: "Batalkan batch ini" }).click();
    await page.waitForURL(/\/admin\/import(\?|$)/, { timeout: 60_000 });
  });

  test("TC-IMP-06 CSV gabungan dengan bagian Foto saja menjadi batch galeri foto @regression", async ({ page }) => {
    await page.goto("/admin/import?tab=unggah");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Unduh templat CSV gabungan" }).click(),
    ]);
    await page.getByRole("checkbox", { name: /Penawaran & harga/ }).uncheck();
    await page.locator("#berkas").setInputFiles({ name: "qa-e2e-galeri.csv", mimeType: "text/csv", buffer: fs.readFileSync(await download.path()) });
    await page.getByRole("button", { name: "Buat pratinjau" }).click();
    await page.waitForURL(/\/admin\/import\/batch\//, { timeout: 60_000 });
    await expect(page.locator("main")).toContainText("Galeri foto");
    // Templat contoh tidak memilih dasar hak pakai: fotonya dilewati dengan alasan, tidak diam-diam disimpan.
    await expect(page.locator("main")).toContainText(/hak pakai|tidak ditemukan di katalog/);
    await page.getByRole("button", { name: "Batalkan batch ini" }).click();
    await page.waitForURL(/\/admin\/import(\?|$)/, { timeout: 60_000 });
  });

  test("TC-IMP-05 CSV gabungan: koreksi otomatis tampil, harga ditinjau dulu lalu foto sebagai tahap lanjutan @regression", async ({ page }) => {
    await page.goto("/admin/import?tab=unggah");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Unduh templat CSV gabungan" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("templat-csv-gabungan-cekharga.csv");
    const path = await download.path();
    await page.locator("#berkas").setInputFiles({ name: "qa-e2e-terpadu.csv", mimeType: "text/csv", buffer: fs.readFileSync(path) });
    await page.getByRole("button", { name: "Buat pratinjau" }).click();
    await page.waitForURL(/\/admin\/import\/batch\//, { timeout: 60_000 });
    const panel = page.locator("section[aria-labelledby=koreksi-otomatis]");
    await expect(panel).toContainText("nilai dirapikan");
    await panel.getByText("Lihat rincian").click();
    await expect(panel).toContainText("1999000");
    await expect(page.locator("main")).toContainText("Penawaran dan harga");
    await expect(page.locator("main")).toContainText("menjadi batch foto");
    await expect(page.getByRole("navigation", { name: "Tahapan berkas" })).toContainText("Foto");
    // Pratinjau per produk: kartu produk dan pilihan mode tahap lanjutan.
    await expect(page.getByRole("heading", { name: /OPPO A6c/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Penawaran saja" })).toBeVisible();
    await page.getByRole("button", { name: "Batalkan batch ini" }).click();
    await page.waitForURL(/\/admin\/import(\?|$)/, { timeout: 60_000 });
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
