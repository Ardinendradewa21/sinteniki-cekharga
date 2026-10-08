import { expect, test } from "@playwright/test";

// FR-07: "pengguna biasa tidak dapat membaca/mengubah data admin melalui API;
// draft tidak tampil ke publik". Plus gerbang endpoint terjadwal.

const backend = process.env.INSFORGE_URL;
const anonKey = process.env.INSFORGE_ANON_KEY;

test.describe("Gerbang admin dan login", () => {
  test("TC-SEC-01 halaman admin tanpa sesi dialihkan ke login @smoke", async ({ page }) => {
    for (const path of ["/admin", "/admin/import", "/admin/products", "/admin/iklan"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/login/);
    }
  });

  test("TC-SEC-02 email login kosong dan bisa diisi (DEF-001) @smoke", async ({ page }) => {
    await page.goto("/admin/login");
    const email = page.getByLabel("Email");
    await expect(email).toHaveValue("");
    await expect(email).toBeEditable();
    await expect(email).toHaveAttribute("autocomplete", "username");
    await expect(page.getByLabel("Kata sandi")).toHaveAttribute("autocomplete", "current-password");
  });

  test("TC-SEC-03 kata sandi salah memberi pesan seragam @regression", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(`tidak-terdaftar-${Date.now()}@example.com`);
    await page.getByLabel("Kata sandi").fill("salah-sekali-123");
    await page.getByRole("button", { name: "Masuk" }).click();
    // Pesan tidak membedakan email salah dan sandi salah (cegah enumerasi akun).
    // Route announcer Next juga ber-role alert, jadi pilih pesan form-nya.
    await expect(page.locator("form").getByRole("alert")).toHaveText("Email atau kata sandi tidak cocok.");
  });
});

test.describe("Endpoint terjadwal", () => {
  for (const [method, path] of [
    ["GET", "/api/cron/daily"],
    ["POST", "/api/admin/import/worker"],
    ["POST", "/api/ads/maintenance"],
  ] as const) {
    test(`TC-SEC-04 ${method} ${path} menolak tanpa atau dengan token salah @smoke`, async ({ request }) => {
      const call = (headers: Record<string, string>) =>
        method === "GET" ? request.get(path, { headers }) : request.post(path, { headers });
      expect((await call({})).status()).toBe(401);
      expect((await call({ Authorization: "Bearer salah" })).status()).toBe(401);
    });
  }
});

test.describe("API database dengan anon key (RLS)", () => {
  test.skip(!backend || !anonKey, "INSFORGE_URL / INSFORGE_ANON_KEY tidak tersedia");

  const read = async (request: import("@playwright/test").APIRequestContext, table: string, query = "") => {
    const response = await request.get(`${backend}/api/database/records/${table}?select=*&limit=5${query}`, {
      headers: { Authorization: `Bearer ${anonKey}` },
    });
    const body = response.ok() ? await response.json() : [];
    return { status: response.status(), rows: Array.isArray(body) ? body : [] };
  };

  for (const table of ["admin_users", "admin_audit", "import_batches", "import_items", "photo_jobs", "scrape_sessions", "ad_events", "invoices"]) {
    test(`TC-SEC-05 anon tidak bisa membaca ${table} @regression`, async ({ request }) => {
      const { rows } = await read(request, table);
      expect(rows).toHaveLength(0);
    });
  }

  test("TC-SEC-06 produk draft tidak terbaca anon @smoke", async ({ request }) => {
    const { rows } = await read(request, "products", "&status=eq.draft");
    expect(rows).toHaveLength(0);
  });

  test("TC-SEC-07 anon tidak bisa menulis produk @regression", async ({ request }) => {
    const response = await request.post(`${backend}/api/database/records/products`, {
      headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      data: [{ slug: `qa-anon-${Date.now()}`, brand: "QA", model: "Anon", status: "published" }],
    });
    expect(response.ok()).toBe(false);
  });
});
