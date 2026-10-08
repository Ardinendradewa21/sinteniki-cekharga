import { expect, test as setup } from "@playwright/test";

// Masuk sekali sebagai admin, simpan cookie sesi ke e2e/.auth (di-ignore git).
// Kredensial hanya dari environment: QA_ADMIN_EMAIL dan QA_ADMIN_PASSWORD.
setup("masuk sebagai admin", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(process.env.QA_ADMIN_EMAIL!);
  await page.getByLabel("Kata sandi").fill(process.env.QA_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});
