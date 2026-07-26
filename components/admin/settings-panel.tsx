import type { ReactNode } from "react";

/**
 * Shared card shell for the admin settings sections.
 * Matches the panel styling used across the other admin pages
 * (see admin/billing and components/admin/admin-overview).
 */
export function SettingsPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-6 py-3 flex items-center justify-between gap-4 border-b border-gray-100 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <div className="text-right shrink-0">{children}</div>
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "error" | "muted";
  children: ReactNode;
}) {
  const className = {
    ok: "bg-emerald-50 text-emerald-600 border-emerald-200",
    warn: "bg-amber-50 text-amber-600 border-amber-200",
    error: "bg-red-50 text-red-600 border-red-200",
    muted: "bg-gray-100 text-gray-500 border-gray-200",
  }[tone];

  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${className}`}
    >
      {children}
    </span>
  );
}
