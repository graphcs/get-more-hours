import { createHash } from "node:crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PRICING, STAGE_LABELS } from "@/lib/constants";
import {
  SettingsPanel,
  SettingsRow,
  StatusPill,
} from "@/components/admin/settings-panel";
import { OpenRouterHealth } from "@/components/admin/openrouter-health";
import type { Profile } from "@/types";

// Defaults must mirror the fallbacks in lib/openrouter.ts and app/api/ai/ocr/route.ts.
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const DEFAULT_OCR_MODEL = "google/gemini-3.1-flash-lite";

/**
 * Env values are read through explicit literal property accesses so that the
 * Next.js build-time replacement works and nothing is resolved dynamically.
 * NOTE: values marked `secret` are NEVER sent to the browser — only presence
 * and a salt-free SHA-256 prefix ("fingerprint") that can be compared between
 * environments without revealing the value.
 */
const ENV_VALUES: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  OPENROUTER_OCR_MODEL: process.env.OPENROUTER_OCR_MODEL,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
};

interface EnvSpec {
  key: string;
  label: string;
  group: "Supabase" | "AI" | "Stripe" | "App";
  required: boolean;
  /** Safe to render verbatim (non-secret configuration, not a credential). */
  showValue?: boolean;
  /** Shown instead of the value when the var is unset. */
  fallback?: string;
}

const ENV_SPECS: EnvSpec[] = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    label: "Supabase URL",
    group: "Supabase",
    required: true,
    showValue: true,
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    label: "Supabase anon key",
    group: "Supabase",
    required: true,
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    label: "Supabase service-role key",
    group: "Supabase",
    required: true,
  },
  {
    key: "OPENROUTER_API_KEY",
    label: "OpenRouter API key",
    group: "AI",
    required: true,
  },
  {
    key: "OPENROUTER_MODEL",
    label: "Document model override",
    group: "AI",
    required: false,
    showValue: true,
    fallback: DEFAULT_MODEL,
  },
  {
    key: "OPENROUTER_OCR_MODEL",
    label: "OCR model override",
    group: "AI",
    required: false,
    showValue: true,
    fallback: DEFAULT_OCR_MODEL,
  },
  {
    key: "STRIPE_SECRET_KEY",
    label: "Stripe secret key",
    group: "Stripe",
    required: true,
  },
  {
    key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    label: "Stripe publishable key",
    group: "Stripe",
    required: true,
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    label: "Stripe webhook secret",
    group: "Stripe",
    required: true,
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    label: "Public app URL",
    group: "App",
    required: true,
    showValue: true,
  },
  {
    key: "ADMIN_EMAILS",
    label: "Admin allowlist",
    group: "App",
    required: true,
  },
];

const ENV_GROUPS = ["Supabase", "AI", "Stripe", "App"] as const;

/** Non-reversible short digest, safe to display. Never returns the value. */
function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

/**
 * `profiles` has no email column — emails live in auth.users, which requires
 * the service-role client. Degrade to "email unavailable" rather than failing
 * the whole page if the key is missing or the call errors.
 */
async function loadAuthEmails(): Promise<Map<string, string> | null> {
  if (!ENV_VALUES.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const service = await createServiceClient();
    const { data, error } = await service.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error || !data) return null;
    const map = new Map<string, string>();
    for (const user of data.users) {
      if (user.email) map.set(user.id, user.email.toLowerCase());
    }
    return map;
  } catch (err) {
    console.error("Admin settings: failed to load auth emails", err);
    return null;
  }
}

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const [{ data: adminProfiles }, emailsById] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, role, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true }),
    loadAuthEmails(),
  ]);

  const admins = ((adminProfiles ?? []) as Pick<
    Profile,
    "id" | "name" | "role" | "created_at"
  >[]).map((profile) => {
    const email = emailsById?.get(profile.id) ?? null;
    return { ...profile, email };
  });

  const allowlist = parseAdminEmails(ENV_VALUES.ADMIN_EMAILS);
  const adminEmailSet = new Set(
    admins.map((a) => a.email).filter((e): e is string => Boolean(e))
  );
  const allowlistedWithoutAccount = emailsById
    ? allowlist.filter((email) => !adminEmailSet.has(email))
    : [];

  const documentModel = ENV_VALUES.OPENROUTER_MODEL || DEFAULT_MODEL;
  const ocrModel = ENV_VALUES.OPENROUTER_OCR_MODEL || DEFAULT_OCR_MODEL;
  const openRouterConfigured = Boolean(ENV_VALUES.OPENROUTER_API_KEY);

  const missingRequired = ENV_SPECS.filter(
    (spec) => spec.required && !ENV_VALUES[spec.key]
  );

  const pricingRows = [
    { label: `Stage 1 — ${STAGE_LABELS[1]}`, amount: PRICING.stage1 },
    { label: `Stage 2 — ${STAGE_LABELS[2]}`, amount: PRICING.stage2 },
    { label: `Stage 3 — ${STAGE_LABELS[3]}`, amount: PRICING.stage3 },
    { label: "White Glove add-on", amount: PRICING.whiteGlove },
  ];

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-0.5">
          Read-only view of how this deployment is configured
        </p>
      </div>

      {missingRequired.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-700">
            {missingRequired.length} required environment variable
            {missingRequired.length === 1 ? " is" : "s are"} missing
          </p>
          <p className="text-xs text-amber-700/80 mt-0.5">
            {missingRequired.map((s) => s.key).join(", ")}
          </p>
        </div>
      )}

      {/* ── Admin access ── */}
      <SettingsPanel
        title="Admin Access"
        description="Who can reach this dashboard, and how they got the role"
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Allowlist (ADMIN_EMAILS)
            </span>
            <StatusPill tone={allowlist.length > 0 ? "ok" : "error"}>
              {allowlist.length} {allowlist.length === 1 ? "entry" : "entries"}
            </StatusPill>
          </div>
          {allowlist.length === 0 ? (
            <p className="text-sm text-gray-400">
              ADMIN_EMAILS is not set — no account will be auto-upgraded to
              admin on sign-in.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {allowlist.map((email) => (
                <li
                  key={email}
                  className="text-xs font-mono text-gray-700 bg-gray-100 border border-gray-200 rounded px-2 py-1"
                >
                  {email}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-gray-400 mt-2">
            Edit via the ADMIN_EMAILS environment variable, then redeploy.
            Changing it here is intentionally not possible.
          </p>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Accounts with role = admin
            </span>
            <StatusPill tone={admins.length > 0 ? "ok" : "warn"}>
              {admins.length}
            </StatusPill>
          </div>
          {admins.length === 0 ? (
            <p className="text-sm text-gray-400">No admin profiles yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Name", "Email", "Allowlisted", "Since"].map((h) => (
                    <th
                      key={h}
                      className="px-0 pr-4 py-2 text-[11px] font-semibold text-gray-500 text-left uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="pr-4 py-2.5 text-sm font-medium text-foreground">
                      {admin.name || "—"}
                    </td>
                    <td className="pr-4 py-2.5 text-xs font-mono text-gray-700">
                      {admin.email ?? (
                        <span className="font-sans text-gray-400">
                          unavailable
                        </span>
                      )}
                    </td>
                    <td className="pr-4 py-2.5">
                      {admin.email === null ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : allowlist.includes(admin.email) ? (
                        <StatusPill tone="ok">Yes</StatusPill>
                      ) : (
                        <StatusPill tone="warn">Not in allowlist</StatusPill>
                      )}
                    </td>
                    <td className="pr-0 py-2.5 text-xs text-gray-500">
                      {new Date(admin.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {emailsById === null && (
            <p className="text-[11px] text-gray-400 mt-2">
              Email addresses are stored in auth.users and need
              SUPABASE_SERVICE_ROLE_KEY to read. They are unavailable in this
              environment.
            </p>
          )}

          {allowlistedWithoutAccount.length > 0 && (
            <p className="text-[11px] text-amber-600 mt-2">
              Allowlisted but no admin account yet:{" "}
              <span className="font-mono">
                {allowlistedWithoutAccount.join(", ")}
              </span>
              . They become admins the first time they sign in.
            </p>
          )}
        </div>
      </SettingsPanel>

      {/* ── AI model configuration ── */}
      <SettingsPanel
        title="AI Model Configuration"
        description="Effective models used for generation and OCR"
      >
        <SettingsRow
          label="Document generation"
          hint={
            ENV_VALUES.OPENROUTER_MODEL
              ? "From OPENROUTER_MODEL"
              : `Default — set OPENROUTER_MODEL to override`
          }
        >
          <span className="text-xs font-mono text-foreground">
            {documentModel}
          </span>
        </SettingsRow>
        <SettingsRow
          label="Document OCR"
          hint={
            ENV_VALUES.OPENROUTER_OCR_MODEL
              ? "From OPENROUTER_OCR_MODEL"
              : "Default — set OPENROUTER_OCR_MODEL to override"
          }
        >
          <span className="text-xs font-mono text-foreground">{ocrModel}</span>
        </SettingsRow>
        <SettingsRow label="API key" hint="Value is never displayed">
          {openRouterConfigured ? (
            <StatusPill tone="ok">Configured</StatusPill>
          ) : (
            <StatusPill tone="error">Missing</StatusPill>
          )}
        </SettingsRow>
        <SettingsRow
          label="Prompts"
          hint="Managed on the System Prompt page"
        >
          <a
            href="/admin/system-prompt"
            className="text-xs font-medium text-primary hover:underline"
          >
            Edit prompts
          </a>
        </SettingsRow>
      </SettingsPanel>

      {/* ── OpenRouter account health (endpoint owned by the AI branch) ── */}
      <OpenRouterHealth configured={openRouterConfigured} />

      {/* ── Pricing ── */}
      <SettingsPanel
        title="Stage Pricing"
        description="Defined in lib/constants.ts — changes require a code deploy"
      >
        {pricingRows.map((row) => (
          <SettingsRow key={row.label} label={row.label}>
            <span className="text-sm font-semibold text-foreground">
              ${(row.amount / 100).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </SettingsRow>
        ))}
      </SettingsPanel>

      {/* ── Environment health ── */}
      <SettingsPanel
        title="Environment & Configuration"
        description="Presence check only — secret values are never rendered"
      >
        {ENV_GROUPS.map((group) => {
          const specs = ENV_SPECS.filter((s) => s.group === group);
          if (specs.length === 0) return null;
          return (
            <div key={group}>
              <div className="px-6 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {group}
                </span>
              </div>
              {specs.map((spec) => {
                const value = ENV_VALUES[spec.key];
                const present = Boolean(value);
                return (
                  <SettingsRow
                    key={spec.key}
                    label={spec.label}
                    hint={spec.key}
                  >
                    <div className="flex items-center justify-end gap-2">
                      {present && spec.showValue ? (
                        <span className="text-xs font-mono text-gray-700 break-all">
                          {value}
                        </span>
                      ) : present ? (
                        <span
                          className="text-[11px] font-mono text-gray-400"
                          title="SHA-256 fingerprint — not the value"
                        >
                          sha256:{fingerprint(value!)}
                        </span>
                      ) : !spec.required && spec.fallback ? (
                        <span className="text-xs font-mono text-gray-400">
                          {spec.fallback}
                        </span>
                      ) : null}
                      {present ? (
                        <StatusPill tone="ok">Set</StatusPill>
                      ) : spec.required ? (
                        <StatusPill tone="error">Missing</StatusPill>
                      ) : (
                        <StatusPill tone="muted">Default</StatusPill>
                      )}
                    </div>
                  </SettingsRow>
                );
              })}
            </div>
          );
        })}
      </SettingsPanel>
    </div>
  );
}
