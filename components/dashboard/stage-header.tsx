import { STAGE_LABELS } from "@/lib/constants";
import type { StageNumber, StageStatus } from "@/types";

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  pending: { label: "Not Started", classes: "bg-gray-100 text-gray-400 border-gray-200" },
  in_progress: { label: "In Progress", classes: "bg-amber-50 text-amber-600 border-amber-200" },
  submitted: { label: "Submitted", classes: "bg-blue-50 text-primary border-blue-200" },
  responded: { label: "Responded", classes: "bg-purple-50 text-purple-600 border-purple-200" },
  complete: { label: "Complete", classes: "bg-emerald-50 text-emerald-600 border-emerald-200" },
};

const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: "Formal request to your MLTC for more hours",
  2: "Challenge the MLTC's adverse determination",
  3: "Present your case before a NYS judge",
};

interface StageHeaderProps {
  stageNum: StageNumber;
  isActive: boolean;
  stageStatus: StageStatus;
}

export function StageHeader({ stageNum, isActive, stageStatus }: StageHeaderProps) {
  const effectiveStatus = isActive ? stageStatus : "pending";
  const status = STATUS_STYLES[effectiveStatus] ?? STATUS_STYLES.pending;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[15px] font-bold text-white ${
              isActive ? "bg-primary" : "bg-gray-300"
            }`}
          >
            {stageNum}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {STAGE_LABELS[stageNum]}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Stage {stageNum} — {STAGE_DESCRIPTIONS[stageNum]}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${status.classes}`}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}
