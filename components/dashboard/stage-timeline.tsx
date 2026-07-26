import { deriveStageTimeline, type TimelineState } from "@/lib/timeline";
import type { Document, StageStatus } from "@/types";
import type { StageTimelineStep } from "@/lib/stage-config";
import type { StagePaymentGate } from "@/lib/billing/payment-required";

interface StageTimelineProps {
  steps: StageTimelineStep[];
  /** Documents for this stage only. */
  documents: Document[];
  stageNum: number;
  currentStage: number;
  stageStatus?: StageStatus;
  /** Unpaid fee for this stage — its documents cannot have been generated. */
  paymentGate?: StagePaymentGate | null;
}

const DOT_CLASSES: Record<TimelineState, string> = {
  done: "bg-emerald-600 border-emerald-200",
  in_progress: "bg-amber-500 border-amber-200",
  blocked: "bg-amber-500 border-amber-200",
  failed: "bg-red-500 border-red-200",
  upcoming: "bg-gray-300 border-gray-200",
};

const TEXT_CLASSES: Record<TimelineState, string> = {
  done: "text-foreground",
  in_progress: "text-gray-600",
  blocked: "text-gray-600",
  failed: "text-red-600",
  upcoming: "text-gray-400 italic",
};

const BADGES: Partial<
  Record<TimelineState, { label: string; classes: string }>
> = {
  in_progress: { label: "IN PROGRESS", classes: "bg-amber-50 text-amber-700" },
  blocked: { label: "PAYMENT REQUIRED", classes: "bg-amber-100 text-amber-700" },
  failed: { label: "FAILED", classes: "bg-red-50 text-red-600" },
};

export function StageTimeline({
  steps,
  documents,
  stageNum,
  currentStage,
  stageStatus,
  paymentGate,
}: StageTimelineProps) {
  const entries = deriveStageTimeline({
    steps,
    documents,
    stageNum,
    currentStage,
    stageStatus,
    paymentGate,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
      <h3 className="text-[15px] font-semibold text-foreground mb-3.5">
        Progress
      </h3>
      <div className="relative pl-5">
        <div className="absolute left-[4.5px] top-1 bottom-1 w-0.5 bg-gray-200" />
        {entries.map((entry, i) => {
          const badge = BADGES[entry.state];

          return (
            <div
              key={i}
              className={`relative ${i < entries.length - 1 ? "mb-3.5" : ""}`}
            >
              <div
                className={`w-[11px] h-[11px] rounded-full absolute -left-5 top-[3px] border-2 ${
                  entry.current
                    ? "bg-primary border-blue-300"
                    : DOT_CLASSES[entry.state]
                }`}
              />
              <div
                className={`text-xs ${
                  entry.current
                    ? "text-foreground font-medium"
                    : TEXT_CLASSES[entry.state]
                }`}
              >
                {entry.text}
                {entry.current && (
                  <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-primary align-middle">
                    CURRENT
                  </span>
                )}
                {badge && (
                  <span
                    className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded align-middle ${badge.classes}`}
                  >
                    {badge.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
