import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  AI_ATTEMPT_TIMEOUT_MS,
  AI_MAX_ATTEMPTS,
  AI_REQUEST_BUDGET_MS,
  AI_RETRY_BASE_DELAY_MS,
} from "./ai-limits";
import { tagAiError, type AiErrorCode } from "./ai-errors";

// One client, one config, used by BOTH document generation and OCR. Previously
// the OCR route built its own OpenAI instance with no timeout and no retry
// setting, so it silently inherited the SDK defaults (10 minutes, 2 retries)
// while generation ran with 90s / 0 retries. Under a 60s function limit a
// 10-minute client timeout is meaningless — the platform kills the function
// first, which is exactly how rows got stranded mid-claim.
//
// Retries are handled by us, not the SDK (maxRetries: 0), because the SDK has
// no concept of an overall deadline: 2 SDK retries at a 45s timeout each would
// blow straight past the function limit. callWithBudget below tracks remaining
// wall-clock and refuses to start an attempt it cannot finish.
//
// Constructed lazily: the SDK throws when apiKey is undefined, and this module
// is imported by pure-logic consumers (tests, error classification) that never
// make a request.
let _client: OpenAI | undefined;
function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      timeout: AI_ATTEMPT_TIMEOUT_MS,
      maxRetries: 0,
    });
  }
  return _client;
}

/**
 * Generation default. Haiku 4.5 is the approved default ($1/$5 per M tokens,
 * ~5s per document). Production may override via OPENROUTER_MODEL.
 */
export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5";

/** OCR/vision default. Flash-lite is cheap and well suited to extraction. */
export const OCR_MODEL =
  process.env.OPENROUTER_OCR_MODEL || "google/gemini-3.1-flash-lite";

/**
 * A provider failure that has already been classified. `message` carries the
 * `[ai:<code>]` tag so the classification survives being persisted to
 * documents.generation_error / ocr_error as plain text.
 */
export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    code: AiErrorCode,
    detail: string,
    opts: { status?: number; retryable?: boolean } = {}
  ) {
    super(tagAiError(code, detail));
    this.name = "AiProviderError";
    this.code = code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? true;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Classify a thrown error by the SDK error object's own properties rather than
 * by string matching. `status` is authoritative; the body's `error.code` is a
 * secondary signal (OpenRouter mirrors the upstream code there).
 */
export function classifyProviderError(err: unknown): AiProviderError {
  if (err instanceof AiProviderError) return err;

  const rec = asRecord(err);
  const message =
    (err instanceof Error && err.message) ||
    (typeof rec?.message === "string" ? rec.message : "") ||
    "AI request failed";

  // Numeric HTTP status off the SDK error (OpenAI.APIError#status), or the
  // nested body code some providers use.
  const status =
    typeof rec?.status === "number"
      ? rec.status
      : typeof asRecord(rec?.error)?.code === "number"
        ? (asRecord(rec?.error)!.code as number)
        : undefined;

  if (err instanceof OpenAI.APIUserAbortError) {
    return new AiProviderError("timeout", message, { retryable: false });
  }
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new AiProviderError("timeout", message, { retryable: true });
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new AiProviderError("upstream_unavailable", message, {
      retryable: true,
    });
  }

  if (status === 402) {
    // OpenRouter's out-of-credits signal. Distinct from the app's own 402
    // (unpaid stage) — that one never reaches this code path, and the tag
    // keeps the two from ever being confused downstream.
    return new AiProviderError("insufficient_credits", message, {
      status,
      retryable: false,
    });
  }
  if (status === 429) {
    return new AiProviderError("rate_limited", message, {
      status,
      retryable: true,
    });
  }
  if (status === 408 || status === 504) {
    return new AiProviderError("timeout", message, { status, retryable: true });
  }
  if (typeof status === "number" && status >= 500) {
    return new AiProviderError("upstream_unavailable", message, {
      status,
      retryable: true,
    });
  }
  if (typeof status === "number" && status >= 400) {
    // 400/401/403/404 — a request or credentials problem. Retrying won't help.
    return new AiProviderError("upstream_unavailable", message, {
      status,
      retryable: false,
    });
  }

  return new AiProviderError("unknown", message, { retryable: false });
}

/**
 * OpenRouter sometimes returns HTTP 200 with an `error` object in the body
 * instead of a non-2xx status. The SDK does not treat that as an error, and it
 * used to surface only as the useless "No content returned from AI model".
 */
function throwIfBodyError(response: unknown): void {
  const body = asRecord(response);
  const bodyError = asRecord(body?.error);
  if (!bodyError) return;

  const code =
    typeof bodyError.code === "number"
      ? bodyError.code
      : typeof bodyError.code === "string"
        ? Number(bodyError.code)
        : undefined;
  const message =
    typeof bodyError.message === "string"
      ? bodyError.message
      : "AI provider returned an error";

  throw classifyProviderError({
    status: Number.isFinite(code) ? code : undefined,
    message: `OpenRouter error in 200 response: ${message}`,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run `attempt` with bounded retries inside an overall wall-clock budget.
 * Retries only classified-retryable failures, and never starts an attempt that
 * cannot plausibly finish before the budget (and therefore the function limit)
 * runs out.
 */
async function callWithBudget<T>(
  attempt: (timeoutMs: number) => Promise<T>
): Promise<T> {
  const deadline = Date.now() + AI_REQUEST_BUDGET_MS;
  let lastError: AiProviderError | undefined;

  for (let i = 0; i < AI_MAX_ATTEMPTS; i++) {
    const remaining = deadline - Date.now();
    if (remaining <= 2_000) break;

    try {
      return await attempt(Math.min(remaining, AI_ATTEMPT_TIMEOUT_MS));
    } catch (err) {
      lastError = classifyProviderError(err);
      if (!lastError.retryable) throw lastError;

      const backoff =
        AI_RETRY_BASE_DELAY_MS * 2 ** i + Math.floor(Math.random() * 250);
      // Only sleep-and-retry if there's room for the backoff plus a real try.
      if (deadline - Date.now() < backoff + 5_000) break;
      await sleep(backoff);
    }
  }

  throw (
    lastError ??
    new AiProviderError("timeout", "AI request budget exhausted", {
      retryable: false,
    })
  );
}

async function complete(
  messages: ChatCompletionMessageParam[],
  { model, maxTokens }: { model: string; maxTokens: number }
): Promise<string> {
  return callWithBudget(async (timeoutMs) => {
    const response = await client().chat.completions.create(
      { model, messages, max_tokens: maxTokens, temperature: 0.3 },
      { timeout: timeoutMs }
    );

    throwIfBodyError(response);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      // Empty completion with no error body: treat as a transient upstream
      // hiccup so the bounded retry gets a second shot at it.
      throw new AiProviderError(
        "upstream_unavailable",
        "No content returned from AI model",
        { retryable: true }
      );
    }
    return content;
  });
}

export async function generateDocument(
  systemPrompt: string,
  userPrompt: string,
  model?: string
): Promise<string> {
  return complete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { model: model || DEFAULT_MODEL, maxTokens: 4000 }
  );
}

/** Vision extraction. Same client, same budget, same error taxonomy. */
export async function extractTextFromImage({
  prompt,
  dataUrl,
  model,
}: {
  prompt: string;
  dataUrl: string;
  model?: string;
}): Promise<string> {
  return complete(
    [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    { model: model || OCR_MODEL, maxTokens: 8000 }
  );
}

/** Shape returned by OpenRouter's `GET /api/v1/key`. */
export interface OpenRouterKeyStatus {
  label: string | null;
  usage: number | null;
  limit: number | null;
  limit_remaining: number | null;
  is_free_tier: boolean | null;
  is_provisioning_key?: boolean | null;
  rate_limit?: { requests: number; interval: string } | null;
}

/**
 * Cheap liveness/balance probe. Used by the admin AI health route so a low
 * balance is visible BEFORE it breaks generation. Kept here so the base URL
 * and API key live in exactly one place.
 */
export async function fetchOpenRouterKeyStatus(
  signal?: AbortSignal
): Promise<OpenRouterKeyStatus> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw classifyProviderError({
      status: res.status,
      message: `OpenRouter key check failed (${res.status}): ${detail.slice(0, 200)}`,
    });
  }

  const body = (await res.json()) as { data?: Partial<OpenRouterKeyStatus> };
  const data = body.data ?? {};
  return {
    label: data.label ?? null,
    usage: typeof data.usage === "number" ? data.usage : null,
    limit: typeof data.limit === "number" ? data.limit : null,
    limit_remaining:
      typeof data.limit_remaining === "number" ? data.limit_remaining : null,
    is_free_tier:
      typeof data.is_free_tier === "boolean" ? data.is_free_tier : null,
    is_provisioning_key: data.is_provisioning_key ?? null,
    rate_limit: data.rate_limit ?? null,
  };
}
