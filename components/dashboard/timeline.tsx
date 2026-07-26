import { deriveTimeline, type TimelineState } from "@/lib/timeline";
import type { Document, StageStatus } from "@/types";
import type { StagePaymentGate } from "@/lib/billing/payment-required";

interface TimelineProps {
  documents: Document[];
  caseCreatedAt: string;
  stageStatus?: StageStatus;
  currentStage?: number;
  /** Unpaid stage fee, if any — a pending document is blocked, not in flight. */
  paymentGate?: StagePaymentGate | null;
}

const DOT_CLASSES: Record<TimelineState, string> = {
  done: "bg-emerald-600 border-emerald-200",
  in_progress: "bg-amber-500 border-amber-200",
  blocked: "bg-amber-500 border-amber-200",
  failed: "bg-red-500 border-red-200",
  upcoming: "bg-gray-300 border-gray-200",
};

const CAPTION_CLASSES: Record<TimelineState, string> = {
  done: "text-gray-500",
  in_progress: "text-amber-600",
  blocked: "text-amber-600",
  failed: "text-red-600",
  upcoming: "text-gray-400",
};

const TEXT_CLASSES: Record<TimelineState, string> = {
  done: "text-foreground",
  in_progress: "text-gray-600",
  blocked: "text-gray-600",
  failed: "text-red-600",
  upcoming: "text-gray-400 italic",
};

export function Timeline({
  documents,
  caseCreatedAt,
  stageStatus,
  currentStage,
  paymentGate,
}: TimelineProps) {
  const entries = deriveTimeline({
    documents,
    caseCreatedAt,
    stageStatus,
    currentStage,
    paymentGate,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
      <h3 className="text-[15px] font-semibold text-foreground mb-3.5">
        Timeline
      </h3>
      <div className="relative pl-5">
        <div className="absolute left-[4.5px] top-1 bottom-1 w-0.5 bg-gray-200" />
        {entries.map((t, i) => (
          <div
            key={i}
            className={`relative ${i < entries.length - 1 ? "mb-3.5" : ""}`}
          >
            <div
              className={`w-[11px] h-[11px] rounded-full absolute -left-5 top-[3px] border-2 ${DOT_CLASSES[t.state]}`}
            />
            <div
              className={`text-[10px] font-semibold mb-0.5 ${CAPTION_CLASSES[t.state]}`}
            >
              {t.date}
            </div>
            <div className={`text-xs ${TEXT_CLASSES[t.state]}`}>{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
