/**
 * Client-safe helpers for consuming the 402 responses produced by
 * `checkStagePaid` (lib/billing/guard.ts).
 *
 * The guard has always returned `{ error, redirectUrl: "/dashboard/billing?stage=N" }`
 * with HTTP 402, but nothing on the client read `redirectUrl` — the only
 * handling anywhere was a hardcoded sentence in the file upload component that
 * told the user to go find the Billing page themselves. Every surface that can
 * receive a 402 now renders a real "Pay now" link built from this.
 *
 * NOTE: no `next/server` import here — this module is pulled into client
 * components.
 */

export const BILLING_URL = "/dashboard/billing";

/**
 * Describes an unpaid stage fee that is blocking work. Server components build
 * this from the billing table and hand it to client components, which then show
 * a blocking pay card instead of a spinner and stop polling.
 */
export interface StagePaymentGate {
  caseId: string;
  stage: number;
  /** Stage fee in cents. */
  amount: number;
}

export interface PaymentRequiredInfo {
  message: string;
  /** Deep link to the billing page, pre-focused on the stage that needs paying. */
  redirectUrl: string;
}

const DEFAULT_MESSAGE =
  "This step is locked until the stage fee is paid. Pay now to continue.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Returns payment-required details when `res` is a payment gate rejection, or
 * `null` for any other response. Handles both the guard's 402 and the checkout
 * route's 409 sequential-unlock rejection, which also carries a `redirectUrl`.
 */
export function paymentRequiredFrom(
  res: { status: number },
  body: unknown
): PaymentRequiredInfo | null {
  const payload = isRecord(body) ? body : {};
  const redirectUrl =
    typeof payload.redirectUrl === "string" ? payload.redirectUrl : null;

  if (res.status !== 402 && !(res.status === 409 && redirectUrl)) {
    return null;
  }

  return {
    message:
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : DEFAULT_MESSAGE,
    redirectUrl: redirectUrl ?? BILLING_URL,
  };
}

/** Billing deep link for a known stage. */
export function billingUrlForStage(stage: number): string {
  return `${BILLING_URL}?stage=${stage}`;
}
