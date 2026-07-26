import { describe, expect, it } from "vitest";
import { AiProviderError, classifyProviderError } from "@/lib/openrouter";
import {
  AI_ATTEMPT_TIMEOUT_MS,
  AI_MAX_ATTEMPTS,
  AI_MAX_DURATION_SECONDS,
  AI_REQUEST_BUDGET_MS,
  AI_RETRY_BASE_DELAY_MS,
  MAX_POLL_ATTEMPTS,
  MAX_POLL_MS,
  POLL_INTERVAL_MS,
  STALE_CLAIM_SECONDS,
} from "@/lib/ai-limits";
import { parseAiErrorCode } from "@/lib/ai-errors";

/** Stand-in for an OpenAI SDK APIError, which carries a numeric `status`. */
function sdkError(status: number, message = "boom") {
  return Object.assign(new Error(message), { status });
}

describe("classifyProviderError", () => {
  it("classifies by the SDK error's status property, not by string matching", () => {
    // The message deliberately contains no digits at all.
    expect(classifyProviderError(sdkError(402, "nope")).code).toBe(
      "insufficient_credits"
    );
    expect(classifyProviderError(sdkError(429, "nope")).code).toBe("rate_limited");
    expect(classifyProviderError(sdkError(503, "nope")).code).toBe(
      "upstream_unavailable"
    );
    expect(classifyProviderError(sdkError(408, "nope")).code).toBe("timeout");
  });

  it("marks credits failures non-retryable — retrying a dry account is waste", () => {
    const err = classifyProviderError(sdkError(402));
    expect(err.retryable).toBe(false);
    expect(err.status).toBe(402);
  });

  it("marks 5xx and 429 retryable, and other 4xx not", () => {
    expect(classifyProviderError(sdkError(500)).retryable).toBe(true);
    expect(classifyProviderError(sdkError(429)).retryable).toBe(true);
    expect(classifyProviderError(sdkError(401)).retryable).toBe(false);
    expect(classifyProviderError(sdkError(400)).retryable).toBe(false);
  });

  it("tags the thrown message so the code survives the DB round-trip", () => {
    const err = classifyProviderError(sdkError(402));
    expect(parseAiErrorCode(err.message)).toBe("insufficient_credits");
  });

  it("reads a nested body error code when there is no top-level status", () => {
    const err = classifyProviderError({
      message: "OpenRouter error in 200 response: Insufficient credits",
      error: { code: 402, message: "Insufficient credits" },
    });
    expect(err.code).toBe("insufficient_credits");
  });

  it("is idempotent on an already-classified error", () => {
    const original = new AiProviderError("rate_limited", "429");
    expect(classifyProviderError(original)).toBe(original);
  });

  it("falls back to unknown for an unrecognised throw", () => {
    expect(classifyProviderError(new Error("weird")).code).toBe("unknown");
    expect(classifyProviderError("a string").code).toBe("unknown");
  });
});

// These four constants only work as a set. Each invariant below corresponds to
// a concrete failure mode, and they are easy to break by tuning one number in
// isolation — which is exactly what happened when the limits were raised for
// the Pro plan.
describe("time budgets", () => {
  it("finishes inside the declared function limit", () => {
    // If this ever inverts, a provider hang gets the function killed mid-claim
    // — the exact failure mode that stranded rows in 'generating'.
    expect(AI_REQUEST_BUDGET_MS).toBeLessThan(AI_MAX_DURATION_SECONDS * 1000);
  });

  it("leaves room for at least two full attempts plus backoff", () => {
    // A budget that can't fit a second try makes AI_MAX_ATTEMPTS a lie and
    // silently reduces the retry policy to "no retries".
    expect(AI_ATTEMPT_TIMEOUT_MS * 2 + AI_RETRY_BASE_DELAY_MS).toBeLessThanOrEqual(
      AI_REQUEST_BUDGET_MS
    );
    expect(AI_MAX_ATTEMPTS).toBeGreaterThanOrEqual(2);
  });

  it("never reclaims a claim that could still belong to a live function", () => {
    // A function may run for the full maxDuration. Reclaiming sooner would let
    // two workers generate the same document concurrently.
    expect(STALE_CLAIM_SECONDS).toBeGreaterThan(AI_MAX_DURATION_SECONDS);
  });

  it("polls past the reclaim threshold so the offered retry actually works", () => {
    // The viewer shows "Try again" once polling is exhausted. If it gave up
    // before the claim went stale, that button would just return 409.
    expect(MAX_POLL_MS).toBeGreaterThan(STALE_CLAIM_SECONDS * 1000);
    expect(MAX_POLL_ATTEMPTS).toBe(Math.ceil(MAX_POLL_MS / POLL_INTERVAL_MS));
  });
});
