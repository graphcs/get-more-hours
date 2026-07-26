import { expect, test } from "@playwright/test";

// End-to-end cover for the two things a screenshot can't lie about:
//   1. the OpenRouter credits modal actually appears, with a working link, when
//      generation fails for insufficient credit;
//   2. the stale-job reaper endpoint is not open to the world.
//
// The UI spec needs a signed-in ADMIN and a document to open — the credits
// modal is deliberately admin-only (clients can't top up our vendor account
// and shouldn't see our billing state). Supply credentials via env to run it;
// it skips cleanly otherwise so CI without secrets stays green.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
/** Path of a page that renders a DocViewer, e.g. /dashboard/documents. */
const DOCS_PATH = process.env.E2E_DOCS_PATH ?? "/dashboard/documents";

const CREDITS_URL = "https://openrouter.ai/settings/credits";

test.describe("OpenRouter credits modal", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run the credits modal spec"
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL!);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|admin)/);
  });

  test("shows the credits modal and links to the OpenRouter credits page", async ({
    page,
  }) => {
    // Simulate OpenRouter rejecting the request for insufficient credit. The
    // API surfaces the classification as `errorCode`, never as a bare 402 —
    // a bare 402 is the app's OWN unpaid-stage response and must not be
    // confused with this.
    await page.route("**/api/ai/generate", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Document generation is paused because the AI provider account is out of credits.",
          errorCode: "insufficient_credits",
          errorTitle: "AI credits exhausted",
        }),
      })
    );

    // Serve every document poll as a credits failure so the failure panel
    // renders regardless of which document the account happens to have.
    await page.route("**/api/documents/*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const body = await response.json().catch(() => null);
      if (!body?.document) return route.fulfill({ response });
      body.document.generation_status = "failed";
      body.document.generation_error =
        "[ai:insufficient_credits] 402 Insufficient credits";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto(DOCS_PATH);

    // Open the first generated document.
    await page.getByRole("button", { name: /view/i }).first().click();

    const panel = page.getByTestId("doc-failure-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-error-code", "insufficient_credits");

    // Admin-only remediation affordance.
    await page.getByTestId("doc-fix-credits-button").click();

    const modal = page.getByTestId("ai-credits-modal");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/credits/i);
    await expect(page.getByTestId("ai-credits-modal-link")).toHaveAttribute(
      "href",
      CREDITS_URL
    );

    // And the escape hatch is genuinely reachable, not just decorative.
    await expect(page.getByTestId("doc-retry-button")).toBeEnabled();
  });
});

test.describe("stale-job reaper endpoint", () => {
  test("is not publicly invokable", async ({ request }) => {
    const res = await request.get("/api/cron/reap-stale-jobs");
    // 401 when CRON_SECRET is configured, 503 when it isn't. Either way the
    // sweep must not run for an anonymous caller.
    expect([401, 503]).toContain(res.status());
  });

  test("rejects a wrong bearer token", async ({ request }) => {
    const res = await request.get("/api/cron/reap-stale-jobs", {
      headers: { Authorization: "Bearer definitely-not-the-secret" },
    });
    expect([401, 503]).toContain(res.status());
  });
});
