// Single source of truth for the time budgets that keep AI work inside the
// serverless function limit, and for how long a claim may sit before the
// reaper considers the worker dead.
//
// Pure constants module — safe to import from client components, route
// handlers, and tests.

/**
 * `export const maxDuration` for every route that talks to OpenRouter.
 *
 * The project is on Vercel Pro (verified against the account), where 300s is
 * the ceiling. The headroom matters for the Memo of Law, which is by far the
 * longest generation, and for a retry after a transient provider failure.
 */
export const AI_MAX_DURATION_SECONDS = 300;

/**
 * Total wall-clock we allow for all attempts at one provider call, including
 * retries and backoff. Deliberately under AI_MAX_DURATION_SECONDS so the
 * function returns a real error instead of being killed mid-flight (a kill is
 * exactly what stranded rows in 'generating' before the reaper existed).
 */
export const AI_REQUEST_BUDGET_MS = 240_000;

/**
 * Per-attempt cap, and the SDK-level timeout for a single try. 90s restores
 * the per-request timeout this project ran in production before retries
 * existed; anything less would make the Memo of Law (the longest generation)
 * time out on every attempt and burn the whole budget doing it.
 *
 * With a 240s budget this leaves room for two full attempts plus backoff.
 */
export const AI_ATTEMPT_TIMEOUT_MS = 90_000;

/** Attempts, not retries: 1 means no retry. Only transient failures retry. */
export const AI_MAX_ATTEMPTS = 3;

/** Base backoff between attempts; doubled each time, plus jitter. */
export const AI_RETRY_BASE_DELAY_MS = 800;

/**
 * How long a `generating` / `processing` claim may sit before it is presumed
 * dead. Must stay comfortably above AI_MAX_DURATION_SECONDS so a slow-but-alive
 * function is never stolen from, while still short enough that a user retrying
 * a stuck document succeeds without waiting for the cron.
 */
export const STALE_CLAIM_SECONDS = 420;

/**
 * Client polling: 3s tick, capped so a broken row can never spin forever.
 *
 * MAX_POLL_MS must stay ABOVE STALE_CLAIM_SECONDS. When the cap is reached the
 * viewer shows the stalled panel with a "Try again" button, and that button
 * only works if the claim has already aged past the staleness threshold — the
 * RPC would otherwise refuse it and the route would answer 409. Polling for
 * slightly longer than the reclaim threshold makes the offered retry real.
 */
export const POLL_INTERVAL_MS = 3_000;
export const MAX_POLL_MS = 8 * 60_000;
export const MAX_POLL_ATTEMPTS = Math.ceil(MAX_POLL_MS / POLL_INTERVAL_MS);
