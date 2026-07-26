// User-facing mapping for AI / document-service failures.
//
// Raw provider errors (OpenRouter, the model, network) can contain billing
// details, internal URLs, and stack-y text — never show them to clients. The
// underlying raw error is still stored in the DB (documents.generation_error /
// ocr_error) for staff/debugging; this module maps it to friendly copy at the
// display + API boundary. Pure module — safe to import on client and server.
//
// Classification is *tag-first*. lib/openrouter.ts inspects the OpenAI SDK
// error object (its `status` / `error.code` properties) and prefixes the
// message it throws with a machine-readable `[ai:<code>]` tag. That tag
// survives the round-trip through the TEXT column, so classification no longer
// depends on guessing at substrings.
//
// Why the tag matters: the old code substring-matched "402", which collides
// with the app's OWN 402 ("stage requires payment", lib/billing/guard.ts). A
// genuine OpenRouter out-of-credits failure was flattened into the generic
// "temporarily unavailable" copy and nobody ever learned the account was dry.
// The tag is only ever written by the provider wrapper, so there is no
// collision. Substring heuristics are retained only as a fallback for rows
// written before this change.

export type AiErrorCode =
  | "insufficient_credits"
  | "rate_limited"
  | "timeout"
  | "upstream_unavailable"
  | "missing_input"
  | "stalled"
  | "unknown";

export interface AiErrorInfo {
  /** Stable machine code — drives UI branching (e.g. the credits modal). */
  code: AiErrorCode;
  title: string;
  message: string;
  /** Likely to succeed on retry (capacity/credits/network) vs. a hard problem. */
  transient: boolean;
  /**
   * Operator remediation. Present only for failures a staff member can fix.
   * Render to admins only — it is not client-facing copy.
   */
  operatorAction?: { label: string; href: string; detail: string };
}

export const OPENROUTER_CREDITS_URL = "https://openrouter.ai/settings/credits";

const TAG_RE = /^\s*\[ai:([a-z_]+)\]\s*/;

const CODES: readonly AiErrorCode[] = [
  "insufficient_credits",
  "rate_limited",
  "timeout",
  "upstream_unavailable",
  "missing_input",
  "stalled",
  "unknown",
];

/** Prefix a raw provider message with its classification, for storage. */
export function tagAiError(code: AiErrorCode, message: string): string {
  return `[ai:${code}] ${message}`;
}

/** Read back a tag written by tagAiError. Returns null for untagged text. */
export function parseAiErrorCode(raw?: string | null): AiErrorCode | null {
  if (!raw) return null;
  const m = TAG_RE.exec(raw);
  if (!m) return null;
  const code = m[1] as AiErrorCode;
  return CODES.includes(code) ? code : null;
}

/** Strip the tag for display in staff-only debug output. */
export function stripAiErrorTag(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(TAG_RE, "");
}

const INSUFFICIENT_CREDITS: AiErrorInfo = {
  code: "insufficient_credits",
  title: "AI credits exhausted",
  message:
    "Document generation is paused because the AI provider account is out of credits. Our team has been notified — please try again shortly.",
  transient: true,
  operatorAction: {
    label: "Add OpenRouter credits",
    href: OPENROUTER_CREDITS_URL,
    detail:
      "OpenRouter rejected the request for insufficient credit. Open the credits page, add funds (or raise the daily spend cap), then retry the document. Generation resumes immediately — no redeploy needed.",
  },
};

const RATE_LIMITED: AiErrorInfo = {
  code: "rate_limited",
  title: "Service busy",
  message:
    "The document service is handling a burst of requests right now. Please wait a minute and try again.",
  transient: true,
};

const TIMEOUT: AiErrorInfo = {
  code: "timeout",
  title: "Generation timed out",
  message:
    "This document took too long to generate and was stopped. Please try again — most retries succeed.",
  transient: true,
};

const UNAVAILABLE: AiErrorInfo = {
  code: "upstream_unavailable",
  title: "Service temporarily unavailable",
  message:
    "Our document service is temporarily unavailable. This is usually brief — please try again in a few minutes. If it keeps happening, contact support.",
  transient: true,
};

const STALLED: AiErrorInfo = {
  code: "stalled",
  title: "Generation was interrupted",
  message:
    "This document stopped part-way through and didn't finish. Nothing was lost — please try again.",
  transient: true,
};

const MISSING_INPUT: AiErrorInfo = {
  code: "missing_input",
  title: "Missing required documents",
  message:
    "We're still missing some information needed for this document. Please make sure the required documents are uploaded and finished processing, then try again.",
  transient: false,
};

const GENERIC: AiErrorInfo = {
  code: "unknown",
  title: "Couldn't generate document",
  message:
    "We couldn't generate this document. Please try again, or contact support if the problem continues.",
  transient: true,
};

const BY_CODE: Record<AiErrorCode, AiErrorInfo> = {
  insufficient_credits: INSUFFICIENT_CREDITS,
  rate_limited: RATE_LIMITED,
  timeout: TIMEOUT,
  upstream_unavailable: UNAVAILABLE,
  missing_input: MISSING_INPUT,
  stalled: STALLED,
  unknown: GENERIC,
};

export function aiErrorInfoForCode(code: AiErrorCode): AiErrorInfo {
  return BY_CODE[code] ?? GENERIC;
}

// ---------------------------------------------------------------------------
// Legacy fallback heuristics (for rows written before tagging existed).
// ---------------------------------------------------------------------------

/**
 * HTTP status codes meaning "upstream is unhealthy, retry later". Matched with
 * digit boundaries — the old list required a LEADING SPACE, so "HTTP500" or a
 * bare "500" silently fell through to the generic message.
 */
const UPSTREAM_STATUS_RE = /(?<!\d)(500|502|503|504|520|522|524|529)(?!\d)/;

const CREDIT_SIGNALS = [
  "insufficient credit",
  "insufficient_quota",
  "insufficient funds",
  "out of credits",
  "requires more credits",
  "payment required",
  "add more credits",
];

const RATE_LIMIT_SIGNALS = [
  "rate limit",
  "rate-limit",
  "too many requests",
  "429",
];

const TIMEOUT_SIGNALS = ["timeout", "timed out", "etimedout", "aborted"];

const NETWORK_SIGNALS = [
  "econnreset",
  "enotfound",
  "socket hang up",
  "network",
  "fetch failed",
  "overloaded",
  "temporarily unavailable",
  "no content returned",
];

function classifyLegacy(raw: string): AiErrorCode {
  const s = raw.toLowerCase();
  // Our own prerequisite errors, e.g. "FAD and UAS OCR text required…",
  // "IAD OCR text not found. Upload and process the IAD first."
  if (s.includes("ocr text") || (s.includes("required") && s.includes("upload"))) {
    return "missing_input";
  }
  // Deliberately NOT matching a bare "402": that is also the app's own
  // unpaid-stage status code, and conflating the two is the trap this module
  // exists to remove. Only unambiguous credit wording counts.
  if (CREDIT_SIGNALS.some((k) => s.includes(k))) return "insufficient_credits";
  if (RATE_LIMIT_SIGNALS.some((k) => s.includes(k))) return "rate_limited";
  if (TIMEOUT_SIGNALS.some((k) => s.includes(k))) return "timeout";
  if (NETWORK_SIGNALS.some((k) => s.includes(k))) return "upstream_unavailable";
  if (UPSTREAM_STATUS_RE.test(s)) return "upstream_unavailable";
  return "unknown";
}

export function describeAiError(raw?: string | null): AiErrorInfo {
  if (!raw) return GENERIC;
  const tagged = parseAiErrorCode(raw);
  if (tagged) return aiErrorInfoForCode(tagged);
  return aiErrorInfoForCode(classifyLegacy(raw));
}

/** True when the failure is an upstream/provider problem rather than our input. */
export function isAiUnavailable(raw?: string | null): boolean {
  if (!raw) return false;
  const info = describeAiError(raw);
  return info.transient && info.code !== "unknown";
}

/** True when the operator needs to top up the OpenRouter account. */
export function isCreditsError(raw?: string | null): boolean {
  return describeAiError(raw).code === "insufficient_credits";
}

/** Convenience for places that only need the message string. */
export function friendlyAiError(raw?: string | null): string {
  return describeAiError(raw).message;
}
