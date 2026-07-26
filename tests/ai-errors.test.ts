import { describe, expect, it } from "vitest";
import {
  aiErrorInfoForCode,
  describeAiError,
  friendlyAiError,
  isAiUnavailable,
  isCreditsError,
  parseAiErrorCode,
  stripAiErrorTag,
  tagAiError,
  type AiErrorCode,
  OPENROUTER_CREDITS_URL,
} from "@/lib/ai-errors";

const UNAVAILABLE_TITLE = "Service temporarily unavailable";
const CREDITS_TITLE = "AI credits exhausted";
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

  // ── Upstream 5xx codes now match at any digit boundary ────────────────────
  // These used to be listed as " 500", " 502", " 503", " 529" — space-prefixed
  // — so a message *starting* with the status code, or one where the code was
  // preceded by a colon or a newline, silently fell through to the generic
  // "couldn't generate document" copy. They are now matched with digit
  // boundaries, which keeps the original intent (don't match a code buried in
  // a longer number) without depending on the surrounding punctuation.
  describe("5xx status codes match at any digit boundary", () => {
    it.each([" 500", " 502", " 503", " 529"])(
      "still matches when the code is space-prefixed: %s",
      (code) => {
        expect(isAiUnavailable(`Provider returned${code} Internal Server Error`)).toBe(true);
      }
    );

    it.each(["500", "502", "503", "529"])(
      "now ALSO matches when the code starts the string: %s",
      (code) => {
        expect(isAiUnavailable(`${code} Internal Server Error`)).toBe(true);
      }
    );

    it("now matches when the code is preceded by a colon or newline", () => {
      expect(isAiUnavailable("status:503 upstream")).toBe(true);
      expect(isAiUnavailable("upstream error\n503")).toBe(true);
      expect(isAiUnavailable("HTTP500")).toBe(true);
    });

    it("covers 504 on the status code itself, not just the reason phrase", () => {
      // 504 was absent from the old list entirely; it only got classified when
      // the reason phrase happened to contain the word "Timeout".
      expect(isAiUnavailable("upstream returned 504")).toBe(true);
      expect(describeAiError("upstream returned 504").code).toBe("upstream_unavailable");
    });

    it("classifies a 504 whose reason phrase says Timeout as a timeout", () => {
      // Timeout wording is checked before the status-code regex, so the more
      // specific classification wins. Either way it is a transient outage.
      const info = describeAiError("Gateway returned 504 Gateway Timeout");
      expect(info.code).toBe("timeout");
      expect(isAiUnavailable("Gateway returned 504 Gateway Timeout")).toBe(true);
    });

    it("still refuses to match a status code buried inside a longer number", () => {
      expect(isAiUnavailable("prompt used 15000 tokens")).toBe(false);
      expect(isAiUnavailable("request id 5029 failed")).toBe(false);
    });
  });

  // ── The 402 collision is gone ─────────────────────────────────────────────
  // This is the most important behaviour in this file. "402" used to be a bare
  // substring in the signals list. It was meant to catch OpenRouter's
  // "402 Payment Required" (out of credits), but 402 is ALSO the status the app
  // itself returns from lib/billing/guard.ts for an unpaid stage. The two were
  // indistinguishable, so a genuine out-of-credits outage was flattened into
  // the generic "temporarily unavailable" copy and nobody ever learned the
  // provider account was dry.
  //
  // Classification is now tag-first: lib/openrouter.ts inspects the SDK error's
  // numeric `status` and prefixes the stored message with `[ai:<code>]`. The
  // billing guard never writes into generation_error, so it can never produce
  // that tag.
  describe("the app's own 402 no longer collides with OpenRouter credit failures", () => {
    it("classifies a tagged OpenRouter credits failure as insufficient_credits", () => {
      const stored = tagAiError("insufficient_credits", "402 Payment Required");
      expect(isCreditsError(stored)).toBe(true);
      expect(describeAiError(stored).title).toBe(CREDITS_TITLE);
      // And it is distinct from the generic outage copy, so it is actionable.
      expect(describeAiError(stored).title).not.toBe(UNAVAILABLE_TITLE);
    });

    it("does NOT classify the app's own unpaid-stage 402 as an AI failure", () => {
      // guard.ts returns { status: 402 } with this message shape.
      const unpaidStage =
        "Request failed with status 402: Stage 2 requires payment before processing";
      expect(isCreditsError(unpaidStage)).toBe(false);
      expect(isAiUnavailable(unpaidStage)).toBe(false);
      expect(describeAiError(unpaidStage).code).toBe("unknown");
    });

    it("does not fire on an incidental occurrence of the digits 402", () => {
      for (const raw of ["document 402 not found", "prompt used 1402 tokens", "402"]) {
        expect(isCreditsError(raw)).toBe(false);
        expect(isAiUnavailable(raw)).toBe(false);
      }
    });

    it("still recognises unambiguous credit wording in untagged legacy rows", () => {
      // Rows written before tagging existed must not silently downgrade.
      expect(isCreditsError("402 Payment Required: insufficient credits")).toBe(true);
      expect(isCreditsError("Insufficient credit on the OpenRouter account")).toBe(true);
      expect(isCreditsError("OpenRouter: out of credits")).toBe(true);
    });

    it("prefers the tag over misleading text in the message body", () => {
      // A rate-limit failure whose text happens to mention 500 stays a rate
      // limit — the tag is authoritative, the substrings are only a fallback.
      const stored = tagAiError("rate_limited", "429 after upstream returned 500");
      expect(describeAiError(stored).code).toBe("rate_limited");
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
    // The title is now the accurate credits title rather than the generic
    // outage one: this raw text IS an out-of-credits failure, and flattening it
    // into "temporarily unavailable" is exactly the bug that meant nobody ever
    // learned the provider account was dry. The copy is still fully static —
    // see the exhaustive check below — so nothing from `raw` reaches the user.
    expect(info.title).toBe(CREDITS_TITLE);
    expect(info.title).not.toBe(UNAVAILABLE_TITLE);
  });

  // Every client-facing string is a fixed constant, so the only way raw
  // provider text could reach a user is if someone interpolated it into the
  // copy. Assert that for every code, not just the one sampled above.
  const ALL_CODES: AiErrorCode[] = [
    "insufficient_credits",
    "rate_limited",
    "timeout",
    "upstream_unavailable",
    "missing_input",
    "stalled",
    "unknown",
  ];

  it.each(ALL_CODES)(
    "keeps client-facing copy free of URLs, vendor names and identifiers: %s",
    (code) => {
      const info = aiErrorInfoForCode(code);
      for (const text of [info.title, info.message]) {
        expect(text).not.toMatch(/https?:\/\//i);
        expect(text).not.toMatch(/openrouter/i);
        expect(text).not.toMatch(/\borg_/i);
        expect(text).not.toMatch(/sk-or-/i);
        expect(text.length).toBeGreaterThan(0);
      }
    }
  );

  it("confines the vendor link to operatorAction, which only the credits case has", () => {
    // operatorAction is the one field that names the vendor and carries a URL.
    // It is rendered behind `isAdmin` in doc-viewer.tsx and in the admin-only
    // AiCreditsModal — it is never part of the API's client-facing payload,
    // which sends only { title, message, code }.
    for (const code of ALL_CODES) {
      const info = aiErrorInfoForCode(code);
      if (code === "insufficient_credits") {
        expect(info.operatorAction?.href).toBe(OPENROUTER_CREDITS_URL);
      } else {
        expect(info.operatorAction).toBeUndefined();
      }
    }
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

// The `[ai:<code>]` tag is how a classification made server-side in
// lib/openrouter.ts survives being persisted to documents.generation_error /
// ocr_error, which is a plain TEXT column with nowhere else to put it.
describe("error tagging round-trip", () => {
  it("survives being written to and read back from a TEXT column", () => {
    const stored = tagAiError("insufficient_credits", "402 Insufficient credits");
    expect(parseAiErrorCode(stored)).toBe("insufficient_credits");
    expect(stripAiErrorTag(stored)).toBe("402 Insufficient credits");
    expect(describeAiError(stored).code).toBe("insufficient_credits");
  });

  it("ignores an unknown or malformed tag and falls back to the heuristics", () => {
    // Forward compatibility: a tag written by a newer deploy must degrade to
    // substring classification rather than crashing or returning nonsense.
    expect(parseAiErrorCode("[ai:not_a_real_code] fetch failed")).toBeNull();
    expect(describeAiError("[ai:not_a_real_code] fetch failed").code).toBe(
      "upstream_unavailable"
    );
    expect(parseAiErrorCode("no tag here")).toBeNull();
  });

  it("strips the tag for the staff-only detail line", () => {
    // doc-viewer renders `Staff detail: {stripAiErrorTag(...)}` for admins.
    expect(stripAiErrorTag(tagAiError("timeout", "socket hang up"))).toBe(
      "socket hang up"
    );
    expect(stripAiErrorTag(null)).toBe("");
    expect(stripAiErrorTag(undefined)).toBe("");
  });
});

describe("stale-job reaper output", () => {
  it("describes a reaped row as recoverable so 'Try again' is offered", () => {
    // The reaper writes this tag onto rows whose worker died mid-flight. The
    // whole point is to reach a *failed* state, because doc-viewer only renders
    // the retry affordance for a failed (or stalled) document.
    const info = describeAiError(
      tagAiError("stalled", "Reclaimed by the stale-job reaper.")
    );
    expect(info.code).toBe("stalled");
    expect(info.transient).toBe(true);
    expect(info.message).toMatch(/try again/i);
  });
});
