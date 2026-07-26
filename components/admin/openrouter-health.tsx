"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { SettingsPanel, SettingsRow, StatusPill } from "./settings-panel";

/**
 * The OpenRouter key/credit proxy.
 *
 * This page was built before the route existed, so it probed a list of
 * candidate paths and used whichever answered. The route has since landed, so
 * this is now the single real endpoint — kept as an array only so the probe
 * loop below is unchanged, and deliberately not allowed to accumulate
 * speculative paths again.
 */
export const OPENROUTER_HEALTH_ENDPOINTS = ["/api/admin/ai-health"] as const;

interface RateLimit {
  requests?: number | null;
  interval?: string | null;
}

interface KeyInfo {
  label: string | null;
  usage: number | null;
  limit: number | null;
  limitRemaining: number | null;
  isFreeTier: boolean | null;
  rateLimit: RateLimit | null;
}

type State =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error"; message: string }
  | { kind: "ready"; info: KeyInfo };

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Normalize whatever the proxy returns into our display shape.
 *
 * Tolerates: the raw OpenRouter envelope (`{ data: { ... } }`), a flattened
 * body, and both snake_case (OpenRouter's own naming) and camelCase keys.
 */
function normalize(payload: unknown): KeyInfo | null {
  if (!payload || typeof payload !== "object") return null;

  const outer = payload as Record<string, unknown>;
  const inner =
    outer.data && typeof outer.data === "object"
      ? (outer.data as Record<string, unknown>)
      : outer.key && typeof outer.key === "object"
        ? (outer.key as Record<string, unknown>)
        : outer;

  const rawRateLimit =
    (inner.rate_limit ?? inner.rateLimit) &&
    typeof (inner.rate_limit ?? inner.rateLimit) === "object"
      ? ((inner.rate_limit ?? inner.rateLimit) as Record<string, unknown>)
      : null;

  const info: KeyInfo = {
    label: str(inner.label) ?? str(inner.name),
    usage: num(inner.usage),
    limit: num(inner.limit),
    limitRemaining: num(inner.limit_remaining ?? inner.limitRemaining),
    isFreeTier:
      typeof (inner.is_free_tier ?? inner.isFreeTier) === "boolean"
        ? Boolean(inner.is_free_tier ?? inner.isFreeTier)
        : null,
    rateLimit: rawRateLimit
      ? {
          requests: num(rawRateLimit.requests),
          interval: str(rawRateLimit.interval),
        }
      : null,
  };

  const hasAnything =
    info.label !== null ||
    info.usage !== null ||
    info.limit !== null ||
    info.limitRemaining !== null ||
    info.isFreeTier !== null ||
    info.rateLimit !== null;

  return hasAnything ? info : null;
}

function usd(value: number | null): string {
  if (value === null) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

export function OpenRouterHealth({ configured }: { configured: boolean }) {
  const [state, setState] = useState<State>(
    configured ? { kind: "loading" } : { kind: "unavailable" }
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!configured) return;

    let cancelled = false;

    (async () => {
      let lastError: string | null = null;

      for (const endpoint of OPENROUTER_HEALTH_ENDPOINTS) {
        let res: Response;
        try {
          res = await fetch(endpoint, {
            cache: "no-store",
            headers: { Accept: "application/json" },
          });
        } catch {
          continue;
        }
        if (cancelled) return;

        // Route not deployed on this branch — try the next candidate.
        if (res.status === 404) continue;

        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          continue;
        }
        if (cancelled) return;

        if (!res.ok) {
          const fromBody =
            body && typeof body === "object"
              ? str((body as Record<string, unknown>).error)
              : null;
          lastError = fromBody ?? `Request failed (${res.status})`;
          continue;
        }

        const info = normalize(body);
        if (info) {
          setState({ kind: "ready", info });
          return;
        }
      }

      if (cancelled) return;
      setState(
        lastError ? { kind: "error", message: lastError } : { kind: "unavailable" }
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [configured, nonce]);

  const action =
    state.kind === "unavailable" ? null : (
      <button
        type="button"
        onClick={() => {
          setState({ kind: "loading" });
          setNonce((n) => n + 1);
        }}
        disabled={state.kind === "loading"}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 hover:text-foreground disabled:opacity-50"
      >
        <RefreshCw
          className={`h-3 w-3 ${state.kind === "loading" ? "animate-spin" : ""}`}
        />
        Refresh
      </button>
    );

  return (
    <SettingsPanel
      title="OpenRouter Account Health"
      description="Credit usage and rate limits for the configured API key"
      action={action}
    >
      {state.kind === "loading" && (
        <div className="px-6 py-8 flex items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking OpenRouter…
        </div>
      )}

      {state.kind === "unavailable" && (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-gray-500">
            {configured
              ? "Live credit reporting isn't available in this deployment."
              : "OPENROUTER_API_KEY is not configured, so there is no account to report on."}
          </p>
          {configured && (
            <p className="text-[11px] text-gray-400 mt-1">
              The account-health endpoint did not respond. Usage can be checked
              directly at openrouter.ai.
            </p>
          )}
        </div>
      )}

      {state.kind === "error" && (
        <div className="px-6 py-8 text-center">
          <StatusPill tone="error">Unavailable</StatusPill>
          <p className="text-sm text-gray-500 mt-2">{state.message}</p>
        </div>
      )}

      {state.kind === "ready" && (
        <div>
          <SettingsRow label="Key label">
            <span className="text-sm text-foreground">
              {state.info.label ?? "—"}
            </span>
          </SettingsRow>
          <SettingsRow label="Credits used">
            <span className="text-sm font-medium text-foreground">
              {usd(state.info.usage)}
            </span>
          </SettingsRow>
          <SettingsRow
            label="Credit limit"
            hint={state.info.limit === null ? "No limit set on this key" : undefined}
          >
            <span className="text-sm text-foreground">
              {state.info.limit === null ? "Unlimited" : usd(state.info.limit)}
            </span>
          </SettingsRow>
          <SettingsRow label="Remaining">
            {state.info.limitRemaining === null ? (
              <span className="text-sm text-gray-500">—</span>
            ) : (
              <span
                className={`text-sm font-semibold ${
                  state.info.limitRemaining <= 0
                    ? "text-red-600"
                    : state.info.limitRemaining < 5
                      ? "text-amber-600"
                      : "text-emerald-600"
                }`}
              >
                {usd(state.info.limitRemaining)}
              </span>
            )}
          </SettingsRow>
          {state.info.rateLimit && (
            <SettingsRow label="Rate limit">
              <span className="text-sm text-foreground">
                {state.info.rateLimit.requests ?? "—"} req /{" "}
                {state.info.rateLimit.interval ?? "—"}
              </span>
            </SettingsRow>
          )}
          {state.info.isFreeTier !== null && (
            <SettingsRow label="Tier">
              <StatusPill tone={state.info.isFreeTier ? "warn" : "ok"}>
                {state.info.isFreeTier ? "Free tier" : "Paid"}
              </StatusPill>
            </SettingsRow>
          )}
        </div>
      )}
    </SettingsPanel>
  );
}
