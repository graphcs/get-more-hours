import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_MODEL,
  OCR_MODEL,
  fetchOpenRouterKeyStatus,
} from "@/lib/openrouter";
import { OPENROUTER_CREDITS_URL } from "@/lib/ai-errors";

// Admin-only AI health probe. Calls OpenRouter's GET /api/v1/key so a low or
// exhausted balance is visible BEFORE it starts failing document generation.
// Self-contained on purpose — PR 5 builds the admin settings page that renders
// this; the response shape below is the contract.

export const dynamic = "force-dynamic";

/** Below this many dollars remaining we surface a warning. */
const LOW_BALANCE_USD = 5;

export type AiHealthStatus =
  | "healthy"
  | "low_balance"
  | "exhausted"
  | "unconfigured"
  | "error";

export interface AiHealthResponse {
  ok: boolean;
  status: AiHealthStatus;
  /** Short human-readable summary, safe to render directly. */
  message: string;
  checkedAt: string;
  creditsUrl: string;
  models: { generation: string; ocr: string };
  key: {
    label: string | null;
    /** Dollars spent on this key. */
    usage: number | null;
    /** Spend cap in dollars, or null when uncapped. */
    limit: number | null;
    /** Dollars left before the cap, or null when uncapped. */
    limitRemaining: number | null;
    isFreeTier: boolean | null;
    rateLimit: { requests: number; interval: string } | null;
  } | null;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const base = {
    checkedAt: new Date().toISOString(),
    creditsUrl: OPENROUTER_CREDITS_URL,
    models: { generation: DEFAULT_MODEL, ocr: OCR_MODEL },
  };

  if (!process.env.OPENROUTER_API_KEY) {
    const body: AiHealthResponse = {
      ...base,
      ok: false,
      status: "unconfigured",
      message: "OPENROUTER_API_KEY is not set — AI features are disabled.",
      key: null,
    };
    return NextResponse.json(body, { status: 200 });
  }

  try {
    // Don't let a hung provider hang the admin page.
    const key = await fetchOpenRouterKeyStatus(AbortSignal.timeout(10_000));

    const remaining = key.limit_remaining;
    let status: AiHealthStatus = "healthy";
    let message = "OpenRouter key is active.";

    if (remaining !== null && remaining <= 0) {
      status = "exhausted";
      message =
        "OpenRouter credits are exhausted. Document generation will fail until credits are added.";
    } else if (remaining !== null && remaining < LOW_BALANCE_USD) {
      status = "low_balance";
      message = `Only $${remaining.toFixed(2)} of OpenRouter credit remains. Top up soon to avoid generation failures.`;
    } else if (remaining !== null) {
      message = `OpenRouter key is active with $${remaining.toFixed(2)} remaining.`;
    }

    const body: AiHealthResponse = {
      ...base,
      ok: status === "healthy" || status === "low_balance",
      status,
      message,
      key: {
        label: key.label,
        usage: key.usage,
        limit: key.limit,
        limitRemaining: key.limit_remaining,
        isFreeTier: key.is_free_tier,
        rateLimit: key.rate_limit ?? null,
      },
    };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("[ai-health] key check failed:", err);
    const body: AiHealthResponse = {
      ...base,
      ok: false,
      status: "error",
      message:
        "Couldn't reach OpenRouter to check the account status. This may be a temporary provider outage.",
      key: null,
    };
    // 200 with status:"error" — the health check itself succeeded in reporting
    // a problem, and the admin page should render it rather than error out.
    return NextResponse.json(body, { status: 200 });
  }
}
