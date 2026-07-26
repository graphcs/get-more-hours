import { expect, test } from "@playwright/test";

/**
 * Regression test for the reported bug: on the Medical Conditions step,
 * "What has changed recently?" is marked required but the wizard let the user
 * click Continue anyway. The failure only surfaced at final submit, which
 * rejected the whole request and lost the entire intake.
 *
 * Requires a seeded account that does NOT already have a case (an existing case
 * redirects /intake to /dashboard).
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("intake step validation", () => {
  test.skip(
    !email || !password,
    "Set E2E_EMAIL / E2E_PASSWORD to a seeded account with no case."
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/login?callbackUrl=%2Fintake");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/intake");
    await expect(page.getByTestId("intake-form")).toBeVisible();
  });

  async function fillPersonalInfo(page: import("@playwright/test").Page) {
    await page.locator("#firstName").fill("Jane");
    await page.locator("#lastName").fill("Doe");
    await page.locator("#dob").fill("1948-04-11");
    await page.locator("#phone").fill("(212) 555-0000");
    await page.locator("#address").fill("123 Main Street, Apt 4B");
    await page.locator("#city").fill("Brooklyn");
    await page.locator("#zip").fill("11201");
    await page.locator("#mltc").selectOption("healthfirst");
    await page.locator("#currentHours").selectOption("4");
    await page.locator("#currentDays").selectOption("5");
    await page.locator("#requestedHours").selectOption("8");
    await page.locator("#requestedDays").selectOption("7");
  }

  test("blocks Continue when the required change description is blank", async ({
    page,
  }) => {
    const form = page.getByTestId("intake-form");

    // Step 0 — complete, so Continue is allowed.
    await fillPersonalInfo(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(form).toHaveAttribute("data-step", "1");

    // Step 1 — fill only the optional parts, leave changeDescription blank.
    await page.getByRole("button", { name: "Diabetes" }).first().click();
    await page.locator("#otherConditions").fill("Fibromyalgia");
    await page.getByRole("button", { name: "Continue" }).click();

    // Still on step 1, with a visible inline error on the offending field.
    await expect(form).toHaveAttribute("data-step", "1");
    await expect(page.getByTestId("error-changeDescription")).toBeVisible();
    await expect(page.getByTestId("error-changeDescription")).toHaveText(
      "Please describe what has changed recently"
    );
    await expect(page.locator("#changeDescription")).toHaveAttribute(
      "aria-invalid",
      "true"
    );

    // No data loss: what was already entered on this step is intact...
    await expect(page.locator("#otherConditions")).toHaveValue("Fibromyalgia");

    // ...and so is step 0.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(form).toHaveAttribute("data-step", "0");
    await expect(page.locator("#firstName")).toHaveValue("Jane");
    await expect(page.locator("#zip")).toHaveValue("11201");
    await expect(page.locator("#requestedHours")).toHaveValue("8");

    // Filling the field clears the error and unblocks the step.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(form).toHaveAttribute("data-step", "1");
    await page
      .locator("#changeDescription")
      .fill("She fell in January and can no longer walk unassisted.");
    await expect(page.getByTestId("error-changeDescription")).toBeHidden();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(form).toHaveAttribute("data-step", "2");
  });

  test("blocks Continue on step 0 until every required field is filled", async ({
    page,
  }) => {
    const form = page.getByTestId("intake-form");

    await page.locator("#firstName").fill("Jane");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(form).toHaveAttribute("data-step", "0");
    await expect(page.getByTestId("error-lastName")).toBeVisible();
    // The blank hours dropdown must not read as "must be positive".
    await expect(page.getByTestId("error-requestedHours")).toHaveText(
      "Requested hours per day is required"
    );
    await expect(page.locator("#firstName")).toHaveValue("Jane");
  });

  test("restores the draft after a reload", async ({ page }) => {
    const form = page.getByTestId("intake-form");

    await fillPersonalInfo(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(form).toHaveAttribute("data-step", "1");
    await page.locator("#otherConditions").fill("Fibromyalgia");

    await page.reload();

    await expect(page.getByTestId("intake-form")).toHaveAttribute(
      "data-step",
      "1"
    );
    await expect(page.locator("#otherConditions")).toHaveValue("Fibromyalgia");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.locator("#firstName")).toHaveValue("Jane");
  });
});
