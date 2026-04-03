import { MLTC_OPTIONS } from "@/lib/constants";
import type { Case } from "@/types";

interface CaseSummaryProps {
  caseData: Case;
}

export function CaseSummary({ caseData }: CaseSummaryProps) {
  const mltcLabel =
    MLTC_OPTIONS.find((o) => o.value === caseData.mltc)?.label ?? caseData.mltc;

  const hoursDiff = caseData.requested_hours - caseData.current_hours;
  const progressPct = Math.round(
    (caseData.current_hours / caseData.requested_hours) * 100
  );

  const rows = [
    { label: "MLTC", value: mltcLabel },
    {
      label: "Started",
      value: new Date(caseData.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    },
    {
      label: "Current",
      value: `${caseData.current_hours} hrs/day, ${caseData.current_days} days/wk`,
    },
    {
      label: "Requesting",
      value: `${caseData.requested_hours} hrs/day, ${caseData.requested_days} days/wk`,
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
      <h3 className="text-[15px] font-semibold text-foreground mb-3">
        Case Summary
      </h3>
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex justify-between py-1.5 border-b border-gray-100 last:border-0"
        >
          <span className="text-xs text-gray-500">{r.label}</span>
          <span className="text-xs font-medium text-foreground">
            {r.value}
          </span>
        </div>
      ))}
      <div className="mt-3.5 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex justify-between mb-1.5">
          <span className="text-[11px] text-gray-500">Hours increase</span>
          <span className="text-sm font-bold text-primary">
            +{hoursDiff} hrs/day
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-500">
            <b className="text-foreground">{caseData.current_hours}</b>→
            <b className="text-primary">{caseData.requested_hours}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
