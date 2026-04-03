"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { STAGE_LABELS } from "@/lib/constants";
import type { StageNumber, StageStatus } from "@/types";

const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: "Formal request to your MLTC for more hours",
  2: "Challenge the MLTC's adverse determination",
  3: "Present your case before a NYS judge",
};

interface StageTrackerProps {
  currentStage: StageNumber;
  stageStatus: StageStatus;
  caseNumber: string;
}

export function StageTracker({
  currentStage,
  stageStatus,
  caseNumber,
}: StageTrackerProps) {
  const stages = [1, 2, 3] as const;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-foreground">
          Case Progress
        </h3>
        <span className="text-xs text-gray-400">Case #{caseNumber}</span>
      </div>
      <div className="flex gap-2.5">
        {stages.map((num) => {
          const isActive = num === currentStage;
          const isDone = num < currentStage;
          const isFuture = num > currentStage;

          let statusLabel: string;
          let statusClasses: string;
          let cardClasses: string;
          let badgeClasses: string;

          if (isDone) {
            statusLabel = "Complete";
            statusClasses = "bg-emerald-50 text-emerald-600 border-emerald-200";
            cardClasses = "bg-gray-50 border-emerald-200";
            badgeClasses = "bg-emerald-600";
          } else if (isActive) {
            statusLabel =
              stageStatus === "submitted"
                ? "Submitted"
                : stageStatus === "responded"
                  ? "Responded"
                  : "In Progress";
            statusClasses = "bg-amber-50 text-amber-600 border-amber-200";
            cardClasses = "bg-blue-50 border-blue-300";
            badgeClasses = "bg-primary";
          } else {
            statusLabel = "Not Started";
            statusClasses = "bg-gray-100 text-gray-400 border-gray-200";
            cardClasses = "bg-gray-50 border-gray-200 opacity-45";
            badgeClasses = "bg-gray-300";
          }

          return (
            <Link
              key={num}
              href={`/dashboard/stage/${num}`}
              className={`flex-1 rounded-lg p-4 border-[1.5px] transition-all hover:shadow-sm cursor-pointer ${cardClasses}`}
            >
              <div
                className={`w-[26px] h-[26px] rounded-full mb-2 flex items-center justify-center text-xs font-bold text-white ${badgeClasses}`}
              >
                {isDone ? <Check className="h-3 w-3" /> : num}
              </div>
              <div className="text-sm font-semibold text-foreground mb-0.5">
                {STAGE_LABELS[num]}
              </div>
              <div className="text-[11px] text-gray-500 mb-2.5 leading-snug">
                {STAGE_DESCRIPTIONS[num]}
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusClasses}`}
              >
                <span
                  className={`w-[5px] h-[5px] rounded-full ${
                    isDone
                      ? "bg-emerald-600"
                      : isActive
                        ? "bg-amber-600"
                        : "bg-gray-400"
                  }`}
                />
                {statusLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
