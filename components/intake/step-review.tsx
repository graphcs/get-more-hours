"use client";

import { ADL_CATEGORIES, ADL_LEVELS, MLTC_OPTIONS } from "@/lib/constants";
import type { IntakeFormData } from "@/types";

interface StepProps {
  data: IntakeFormData;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 mb-3.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3.5">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 mr-4">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">
        {value || "—"}
      </span>
    </div>
  );
}

export function StepReview({ data }: StepProps) {
  const adlLevels = data.adlLevels || {};
  const conditions = data.conditions || [];
  const needsHelp = ADL_CATEGORIES.filter(
    (a) =>
      adlLevels[a.id] === "some_help" || adlLevels[a.id] === "full_help"
  );
  const fullHelp = ADL_CATEGORIES.filter(
    (a) => adlLevels[a.id] === "full_help"
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-1.5">
        Review Your Information
      </h2>
      <p className="text-[15px] text-gray-500 mb-7 leading-relaxed">
        Please double-check everything below. Once you submit, we&apos;ll start
        building your case.
      </p>

      {/* Summary stats */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">
            {data.currentHours || "—"} → {data.requestedHours || "—"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            hours/day requested
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            {conditions.length}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            medical conditions
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            {fullHelp.length}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            ADLs needing full help
          </div>
        </div>
      </div>

      <Section title="Personal Information">
        <Row
          label="Name"
          value={
            data.firstName || data.lastName
              ? `${data.firstName} ${data.lastName}`.trim()
              : null
          }
        />
        <Row label="Date of Birth" value={data.dob || null} />
        <Row label="Phone" value={data.phone || null} />
        <Row label="Email" value={data.email || null} />
        <Row
          label="Address"
          value={
            [data.address, data.city, data.zip].filter(Boolean).join(", ") ||
            null
          }
        />
      </Section>

      <Section title="Home Care">
        <Row
          label="MLTC"
          value={
            data.mltc
              ? MLTC_OPTIONS.find((o) => o.value === data.mltc)?.label ??
                data.mltc
              : null
          }
        />
        <Row
          label="Current Hours"
          value={
            data.currentHours && data.currentDays
              ? `${data.currentHours} hrs/day, ${data.currentDays} days/week`
              : null
          }
        />
        <Row
          label="Requesting"
          value={
            data.requestedHours && data.requestedDays
              ? `${data.requestedHours} hrs/day, ${data.requestedDays} days/week`
              : null
          }
        />
      </Section>

      <Section title="Medical Conditions">
        {conditions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {conditions.map((c) => (
              <span
                key={c}
                className="px-3 py-1 bg-blue-50 text-primary rounded-md text-sm font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No conditions selected</p>
        )}
        {data.otherConditions && (
          <p className="mt-2.5 text-sm text-foreground">
            Other: {data.otherConditions}
          </p>
        )}
        {data.changeDescription && (
          <div className="mt-3.5">
            <span className="text-xs font-semibold text-gray-500">
              What changed:
            </span>
            <p className="text-sm text-foreground mt-1 leading-relaxed italic">
              &ldquo;{data.changeDescription}&rdquo;
            </p>
          </div>
        )}
      </Section>

      <Section title="Activities of Daily Living">
        {needsHelp.length > 0 ? (
          <div>
            {needsHelp.map((adl) => {
              const lvl = ADL_LEVELS.find(
                (l) => l.value === adlLevels[adl.id]
              );
              const colorClass =
                adlLevels[adl.id] === "full_help"
                  ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-600";
              return (
                <div
                  key={adl.id}
                  className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-foreground">
                    {adl.icon} {adl.label}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded ${colorClass}`}
                  >
                    {lvl?.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">
            No ADLs marked as needing help
          </p>
        )}
      </Section>
    </div>
  );
}
