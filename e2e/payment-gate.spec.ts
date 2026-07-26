import { expect, test } from "@playwright/test";

/**
 * End-to-end coverage for the payment gate.
 *
 * NEVER point this at production — production runs `sk_live_` Stripe keys.
 * These specs require a Stripe **test mode** key and a seeded client account:
 *
 *   E2E_CLIENT_EMAIL     login for a self-serve client with an unpaid Stage 1
 *   E2E_CLIENT_PASSWORD
 *
 * The specs stop at the Stripe Checkout boundary — they assert we hand off to
 * checkout.stripe.com and never submit card details.
 */

const EMAIL = process.env.E2E_CLIENT_EMAIL;
const PASSWORD = process.env.E2E_CLIENT_PASSWORD;

test.skip(
  !EMAIL || !PASSWORD,
  "Set E2E_CLIENT_EMAIL / E2E_CLIENT_PASSWORD (Stripe test mode only)"
);

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/);
});

test("an unpaid stage shows a blocking pay card, not a generating spinner", async ({
  page,
}) => {
  await page.goto("/dashboard");

  // The regression this replaces: a "GENERATING" badge that span forever while
  // generation had not started and never would.
  await expect(
    page.getByRole("heading", { name: /pay to generate your letters/i })
  ).toBeVisible();
  await expect(page.getByText("GENERATING", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/payment required/i).first()).toBeVisible();
});

test("the pay card hands off to Stripe Checkout", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByRole("button", { name: /pay \$\d+ & start now/i }).click();

  // Stop at the Stripe boundary. Do not enter card details here.
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  expect(page.url()).toContain("checkout.stripe.com");
});

test("the billing page honours the guard's ?stage= deep link", async ({
  page,
}) => {
  await page.goto("/dashboard/billing?stage=1");

  await expect(
    page.getByRole("heading", { name: /stage 1 .* is unpaid/i })
  ).toBeVisible();
  await expect(page.locator("#stage-1")).toBeVisible();
});

test("a 402 from the upload gate renders a real Pay now link", async ({
  page,
}) => {
  // Stage 2 is unpaid, so uploading the IAD is gated.
  await page.goto("/dashboard/stage/2");

  await page.route("**/api/upload", (route) =>
    route.fulfill({
      status: 402,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Stage 2 requires payment before processing",
        redirectUrl: "/dashboard/billing?stage=2",
      }),
    })
  );

  await page
    .getByRole("button", { name: /^upload$/i })
    .first()
    .click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "iad.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 test"),
  });

  const payNow = page.getByRole("link", { name: /pay now/i }).first();
  await expect(payNow).toBeVisible();
  await expect(payNow).toHaveAttribute("href", "/dashboard/billing?stage=2");
});
