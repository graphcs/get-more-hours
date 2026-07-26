import { describe, expect, it } from "vitest";
import { describeAiError, friendlyAiError, isAiUnavailable } from "@/lib/ai-errors";

const UNAVAILABLE_TITLE = "Service temporarily unavailable";
const MISSING_INPUT_TITLE = "Missing required documents";
const GENERIC_TITLE = "Couldn't generate document";

describe("isAiUnavailable", () => {
  it("returns false for nullish/empty input", () => {
    expect(isAiUnavailable(undefined)).toBe(false);
    expect(isAiUnavailable(null)).toBe(false);
    expect(isAiUnavailable("")).toBe(false);
  });

  it.each([
    "Insufficient credit on the OpenRouter account",
    "429 Rate limit exceeded",
    "Request timeout after 60s",
    "The operation timed out",
    "ETIMEDOUT connecting to openrouter.ai",
    "ECONNRESET",
    "socket hang up",
    "network error",
    "fetch failed",
    "Model is overloaded",
    "Upstream temporarily unavailable",
    "No content returned from model",
  ])("matches transient signal: %s", (raw) => {
    expect(isAiUnavailable(raw)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAiUnavailable("FETCH FAILED")).toBe(true);
    expect(isAiUnavailable("OVERLOADED")).toBe(true);
  });

  it("returns false for an unrelated error", () => {
    expect(isAiUnavailable("Malformed prompt template")).toBe(false);
  });

  // ── Sharp edge #1: the 5xx signals require a LEADING SPACE ────────────────
  // The signals list contains " 500", " 502", " 503", " 529" (space-prefixed)
  // so that a bare "500" inside e.g. a token count or an id doesn't match.
  // The consequence is that a message *starting* with the status code, or one
  // where the code is preceded by anything other than a space, does NOT match.
  describe("5xx status codes require a leading space", () => {
    it.each([" 500", " 502", " 503", " 529"])(
      "matches when the code is space-prefixed: %s",
      (code) => {
        expect(isAiUnavailable(`Provider returned${code} Internal Server Error`)).toBe(true);
      }
    );

    it.each(["500", "502", "503", "529"])(
      "does NOT match when the code starts the string: %s",
      (code) => {
        expect(isAiUnavailable(`${code} Internal Server Error`)).toBe(false);
      }
    );

    it("does NOT match when the code is preceded by a colon or newline", () => {
      expect(isAiUnavailable("status:503 upstream")).toBe(false);
      expect(isAiUnavailable("upstream error\n503")).toBe(false);
    });

    it("does NOT match 504 — it is absent from the signals list entirely", () => {
      expect(isAiUnavailable("upstream returned 504")).toBe(false);
    });

    it("504 only matches incidentally, via the unrelated 'timeout' signal", () => {
      // The status code itself is invisible to the matcher; it is the word
      // "Timeout" in the reason phrase that rescues this case.
      expect(isAiUnavailable("Gateway returned 504 Gateway Timeout")).toBe(true);
    });
  });

  // ── Sharp edge #2: "402" is a loose, un-prefixed substring ────────────────
  // Unlike the 5xx codes, "402" has no leading space. It is meant to catch
  // OpenRouter's "402 Payment Required" (out of credits), but it also matches
  // the app's OWN 402 unpaid-stage response from lib/billing/guard.ts, and any
  // string that merely contains the digits 402.
  describe('"402" is a loose substring and collides with the app\'s own 402', () => {
    it("matches OpenRouter's payment-required error (intended)", () => {
      expect(isAiUnavailable("402 Payment Required: insufficient credits")).toBe(true);
    });

    it("ALSO matches the app's own unpaid-stage 402 (collision)", () => {
      // guard.ts returns { status: 402 } with this message shape.
      expect(
        isAiUnavailable("Request failed with status 402: Stage 2 requires payment before processing")
      ).toBe(true);
    });

    it("matches any incidental occurrence of the digits 402", () => {
      expect(isAiUnavailable("document 402 not found")).toBe(true);
      expect(isAiUnavailable("prompt used 1402 tokens")).toBe(true);
    });
  });
});

describe("describeAiError", () => {
  it("returns the generic info for nullish input", () => {
    expect(describeAiError(undefined).title).toBe(GENERIC_TITLE);
    expect(describeAiError(null).title).toBe(GENERIC_TITLE);
    expect(describeAiError("").title).toBe(GENERIC_TITLE);
  });

  it("maps our own OCR prerequisite errors to missing-input", () => {
    expect(describeAiError("FAD and UAS OCR text required for the Memo of Law").title).toBe(
      MISSING_INPUT_TITLE
    );
    expect(
      describeAiError("IAD OCR text not found. Upload and process the IAD first.").title
    ).toBe(MISSING_INPUT_TITLE);
  });

  it('maps the "required" + "upload" pair to missing-input even without "ocr text"', () => {
    expect(describeAiError("A signed LOMN is required — please upload it").title).toBe(
      MISSING_INPUT_TITLE
    );
  });

  it("requires BOTH 'required' and 'upload' for that second branch", () => {
    expect(describeAiError("A signed LOMN is required").title).toBe(GENERIC_TITLE);
    expect(describeAiError("please upload the LOMN").title).toBe(GENERIC_TITLE);
  });

  it("checks missing-input BEFORE transient — the OCR branch wins on overlap", () => {
    // This string contains "fetch failed" (a transient signal) *and* "ocr text",
    // and the missing-input branch is evaluated first.
    const info = describeAiError("ocr text missing after fetch failed");
    expect(info.title).toBe(MISSING_INPUT_TITLE);
    expect(info.transient).toBe(false);
  });

  it("maps transient signals to the unavailable info", () => {
    const info = describeAiError("Model is overloaded, try again");
    expect(info.title).toBe(UNAVAILABLE_TITLE);
    expect(info.transient).toBe(true);
  });

  it("falls back to generic (still transient:true) for unknown errors", () => {
    const info = describeAiError("TypeError: cannot read property 'x' of undefined");
    expect(info.title).toBe(GENERIC_TITLE);
    // Documenting current behaviour: the generic bucket is optimistically
    // marked transient even though a TypeError will not fix itself on retry.
    expect(info.transient).toBe(true);
  });

  it("never leaks the raw provider text into the user-facing message", () => {
    const raw =
      "OpenRouter 402: insufficient credits for org_abc123, top up at https://openrouter.ai/credits";
    const info = describeAiError(raw);
    expect(info.message).not.toContain("openrouter.ai");
    expect(info.message).not.toContain("org_abc123");
    expect(info.title).toBe(UNAVAILABLE_TITLE);
  });
});

describe("friendlyAiError", () => {
  it("returns exactly describeAiError().message", () => {
    for (const raw of [
      undefined,
      "fetch failed",
      "IAD OCR text not found. Upload it first.",
      "something else entirely",
    ]) {
      expect(friendlyAiError(raw)).toBe(describeAiError(raw).message);
    }
  });

  it("always returns a non-empty string", () => {
    expect(friendlyAiError(null).length).toBeGreaterThan(0);
  });
});
