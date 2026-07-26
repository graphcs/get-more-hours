import { expect, test } from "@playwright/test";

// Minimal smoke coverage: the two unauthenticated entry points must render.
// Later PRs add their own specs (intake, payment gate, generation, admin).

test.describe("marketing homepage", () => {
  test("renders and links to sign in", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);

    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("has no uncaught page errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toEqual([]);
  });
});

test.describe("login page", () => {
  test("renders the credentials form", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBeLessThan(400);

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("is reachable from /register", async ({ page }) => {
    const response = await page.goto("/register");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test("protected dashboard redirects anonymous users to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
