import { expect, test } from "@playwright/test";

/**
 * Regression coverage for the "Settings button 404s" bug.
 *
 * Requires a seeded admin account. Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 * (the address must be in ADMIN_EMAILS so sign-in grants role='admin').
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe("admin settings", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin e2e tests"
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/login?callbackUrl=%2Fadmin");
    await page.getByLabel("Email").fill(ADMIN_EMAIL!);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(
      page.getByRole("heading", { name: "Admin Dashboard" })
    ).toBeVisible();
  });

  test("Settings in the sidebar opens the settings page, not a 404", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Settings" }).click();

    await expect(page).toHaveURL(/\/admin\/settings$/);

    // The bug: this used to fall through to app/not-found.tsx.
    await expect(page.getByText("404")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Page Not Found" })
    ).toHaveCount(0);

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Admin Access")).toBeVisible();
    await expect(page.getByText("AI Model Configuration")).toBeVisible();
    await expect(page.getByText("Stage Pricing")).toBeVisible();
    await expect(
      page.getByText("Environment & Configuration")
    ).toBeVisible();
  });

  test("settings page never renders secret values", async ({ page }) => {
    await page.goto("/admin/settings");
    const body = (await page.locator("body").innerText()).toLowerCase();

    // Credential prefixes that must never reach the browser.
    for (const needle of ["sk-or-", "sk_test_", "sk_live_", "whsec_"]) {
      expect(body).not.toContain(needle);
    }
  });

  test("clients index lists cases and links to the detail page", async ({
    page,
  }) => {
    const response = await page.goto("/admin/clients");
    expect(response?.status()).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Page Not Found" })
    ).toHaveCount(0);

    const firstCase = page.locator('a[href^="/admin/clients/"]').first();
    if ((await firstCase.count()) > 0) {
      await firstCase.click();
      await expect(page).toHaveURL(/\/admin\/clients\/[^/]+$/);
    } else {
      await expect(page.getByText("No cases yet")).toBeVisible();
    }
  });
});
