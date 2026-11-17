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
  // Satu worker untuk seluruh grup: dengan fullyParallel, afterAll berjalan di
  // setiap worker dan menghapus batch "qa-e2e-*" milik tes yang masih jalan
  // di worker lain (TC-IMP-05 macet "Sedang dianalisis", 2026-10-17).
  test.describe.configure({ mode: "default" });
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

  test("TC-IMP-01 lima tab tersedia (termasuk Salin harga & foto) dan tab riwayat menampilkan asal batch @smoke", async ({ page }) => {
    await page.goto("/admin/import");
    const nav = page.getByRole("navigation", { name: "Sumber impor" });
    for (const tab of ["Unggah CSV", "Tarik otomatis", "Antrean foto", "Salin harga & foto", "Riwayat batch"]) {
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

  test("TC-IMP-07 alat bantu salin harga menyalin satu baris berurutan kolom CSV gabungan dari halaman produk @regression", async ({ page, context }) => {
    await page.goto("/admin/import?tab=salin");
    const link = page.getByRole("link", { name: "Salin ke CekHarga" });
    await expect(link).toHaveAttribute("href", /^javascript:/);
    const code = decodeURIComponent(((await link.getAttribute("href")) ?? "").slice("javascript:".length));

    // Halaman tiruan di host Shopee (dilayani lokal, tidak menyentuh Shopee).
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://shopee.co.id" });
    await page.route("https://shopee.co.id/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><title>vivo Y05 4/128GB</title>
          <script type="application/ld+json">{"@type":"Product","name":"vivo Y05 4/128GB 6500mAh","offers":{"price":"2999000","seller":{"name":"Vivo Official Store"}}}</script>
          </head><body><h1>vivo Y05 4/128GB</h1><p>Rp3.299.000</p><p>Rp2.999.000</p></body></html>`,
      })
    );
    await page.goto("https://shopee.co.id/vivo-y05-i.1.2?sp_atk=abc");
    await page.evaluate(code);
    const panel = page.locator("#cekharga-salin");
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-f="ram_gb"]')).toHaveValue("4");
    await expect(panel.locator('[data-f="storage_gb"]')).toHaveValue("128");
    await expect(panel.locator('[data-f="price_idr"]')).toHaveValue("2999000");
    await expect(panel.locator('[data-f="marketplace"]')).toHaveValue("Shopee");
    await panel.locator('[data-f="brand"]').fill("vivo");
    await panel.locator('[data-f="model_name"]').fill("Y05");
    await panel.locator('[data-f="color"]').fill("Hitam Malam");
    await panel.getByRole("button", { name: "Salin baris" }).click();
    await expect(panel).toContainText("Tersalin");
    const cells = (await page.evaluate(() => navigator.clipboard.readText())).split("	");
    expect(cells).toHaveLength(20);
    expect(cells.slice(0, 6)).toEqual(["vivo", "Y05", "", "4", "128", "Hitam Malam"]);
    expect(cells.slice(12, 16)).toEqual(["Shopee", "Vivo Official Store", "https://shopee.co.id/vivo-y05-i.1.2", "2999000"]);
  });

  test("TC-IMP-08 alat bantu salin foto menyalin galeri per warna dari halaman produk Motorola @regression", async ({ page, context }) => {
    await page.goto("/admin/import?tab=salin");
    const link = page.getByRole("link", { name: "Salin foto ke CekHarga" });
    await expect(link).toHaveAttribute("href", /^javascript:/);
    const code = decodeURIComponent(((await link.getAttribute("href")) ?? "").slice("javascript:".length));

    // Halaman tiruan di host Motorola (dilayani lokal, tidak menyentuh motorola.com).
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://www.motorola.com" });
    const img = (n: number) => `{"t_id":{"t_id":"//p${(n % 2) + 1}-ofp.static.pub//fes/cms/2025/11/04/${n}.png"}}`;
    await page.route("https://www.motorola.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><title>moto g57 power</title></head><body>
          <script>window["moto-product-landing-flip-v2_qa"] = {"data":{"configData":{"design":[
            {"gradientName":{"t_id":"%3Cp%3EPANTONE%20Corsair%3C%2Fp%3E"},"images":[${[1, 2, 3].map(img).join(",")}]},
            {"gradientName":{"t_id":"%3Cp%3EPANTONE%20Regatta%3C%2Fp%3E"},"images":[${[4, 5].map(img).join(",")}]}
          ]}}};</script></body></html>`,
      })
    );
    await page.route("https://p1-ofp.static.pub/**", (route) => route.fulfill({ status: 404 }));
    await page.route("https://p2-ofp.static.pub/**", (route) => route.fulfill({ status: 404 }));
    await page.goto("https://www.motorola.com/id/id/p/phones/moto-g/57-power-5g/pmipmjf43mj");
    await page.evaluate(code);
    const panel = page.locator("#cekharga-salin-foto");
    await expect(panel).toBeVisible();
    const inputs = panel.locator("input:not([type=checkbox])");
    await expect(inputs.nth(0)).toHaveValue("Motorola");
    await expect(inputs.nth(1)).toHaveValue("Moto G57 Power 5G");
    await inputs.nth(1).fill("Moto G57 Power");
    await expect(inputs.nth(2)).toHaveValue("Corsair");
    await panel.getByRole("checkbox", { name: "Sertakan warna Regatta" }).uncheck();
    await panel.getByRole("button", { name: "Salin baris" }).click();
    await expect(panel).toContainText("Tersalin 3 baris");
    const rows = (await page.evaluate(() => navigator.clipboard.readText())).split("\n").map((line) => line.split("	"));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveLength(20);
    expect(rows[0].slice(0, 9)).toEqual(["Motorola", "Moto G57 Power", "", "", "", "Corsair", "https://p2-ofp.static.pub//fes/cms/2025/11/04/1.png", "1", "ya"]);
    expect(rows[2].slice(7, 9)).toEqual(["3", "tidak"]);
  });

  test("TC-IMP-09 salin spesifikasi: bookmarklet menyalin halaman model GSMArena, tempelan diperiksa sebelum jadi sesi @regression", async ({ page, context }) => {
    await page.goto("/admin/import?tab=tarik");
    const section = page.locator("section[aria-labelledby=salin-spek]");
    await expect(section).toBeVisible();
    const link = section.getByRole("link", { name: "Salin spesifikasi" });
    await expect(link).toHaveAttribute("href", /^javascript:/);
    const code = decodeURIComponent(((await link.getAttribute("href")) ?? "").slice("javascript:".length));

    // Tempelan yang bukan dari bookmarklet ditolak dengan pesan, tanpa sesi baru.
    await section.getByLabel("Hasil salinan").fill("Motorola Moto G45 spesifikasi");
    await section.getByRole("button", { name: "Baca spesifikasi" }).click();
    await expect(section.getByRole("alert")).toContainText("bukan salinan dari bookmarklet");

    // Halaman tiruan di host GSMArena (dilayani lokal, tidak menyentuh gsmarena.com).
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://www.gsmarena.com" });
    await page.route("https://www.gsmarena.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><title>Motorola Moto G45</title></head><body><div id="body">
          <h1 class="specs-phone-name-title" data-spec="modelname">Motorola Moto G45</h1>
          <div id="specs-list"><table><tr><td class="ttl">Technology</td><td class="nfo" data-spec="nettech">GSM / LTE / 5G</td></tr></table></div>
        </div></body></html>`,
      })
    );
    await page.route("https://fdn2.gsmarena.com/**", (route) => route.fulfill({ status: 404 }));
    await page.goto("https://www.gsmarena.com/motorola_moto_g45-13202.php");
    await page.evaluate(code);
    await expect(page.locator("#cekharga-salin-spek")).toContainText("Tersalin");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // Clipboard Windows menulis CRLF; pengurai server menerimanya.
    expect(copied.split(/\r?\n/).slice(0, 2)).toEqual(["CEKHARGA-SPEK/1", "motorola_moto_g45-13202.php"]);

    // Merek salah dipilih: ditolak sebelum sesi dibuat, jadi uji ini tidak menulis apa pun.
    await page.goto("/admin/import?tab=tarik");
    await section.getByLabel("Merek").selectOption("samsung");
    await section.getByLabel("Hasil salinan").fill(copied);
    await section.getByRole("button", { name: "Baca spesifikasi" }).click();
    await expect(section.getByRole("alert")).toContainText("bukan model Samsung");
    await expect(page).not.toHaveURL(/sesi=/);
  });

  test("TC-IMP-05 CSV gabungan: koreksi otomatis tampil, harga ditinjau dulu lalu foto sebagai tahap lanjutan @regression", async ({ page }) => {
    test.setTimeout(180_000);
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
    // Analisis berjalan di worker (after + polling); di bawah beban paralel bisa > 30 detik.
    await expect(panel).toContainText("nilai dirapikan", { timeout: 90_000 });
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
