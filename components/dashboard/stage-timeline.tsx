import type { Document } from "@/types";
import type { StageTimelineStep } from "@/lib/stage-config";

interface StageTimelineProps {
  steps: StageTimelineStep[];
  documents: Document[];
  stageNum: number;
}

export function StageTimeline({
  steps,
  documents,
  stageNum,
}: StageTimelineProps) {
  // Determine which steps are done based on documents
  const generatedDocs = documents.filter(
    (d) => d.type === "generated" && d.stage === stageNum
  );
  const uploadedDocs = documents.filter(
    (d) => d.type === "uploaded" && d.stage === stageNum
  );

  // Simple heuristic: mark steps as done based on doc count
  const doneCount = Math.min(
    generatedDocs.length + uploadedDocs.length,
    steps.length
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
      <h3 className="text-[15px] font-semibold text-foreground mb-3.5">
        Progress
      </h3>
      <div className="relative pl-5">
        <div className="absolute left-[4.5px] top-1 bottom-1 w-0.5 bg-gray-200" />
        {steps.map((step, i) => {
          const isDone = i < doneCount;
          const isCurrent = i === doneCount;

          return (
            <div
              key={i}
              className={`relative ${i < steps.length - 1 ? "mb-3.5" : ""}`}
            >
              <div
                className={`w-[11px] h-[11px] rounded-full absolute -left-5 top-[3px] border-2 ${
                  isDone
                    ? "bg-emerald-600 border-emerald-200"
                    : isCurrent
                      ? "bg-primary border-blue-300"
                      : "bg-gray-300 border-gray-200"
                }`}
              />
              <div
                className={`text-xs ${
                  isDone
                    ? "text-foreground"
                    : isCurrent
                      ? "text-foreground font-medium"
                      : "text-gray-400 italic"
                }`}
              >
                {step.text}
                {isCurrent && (
                  <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-primary align-middle">
                    CURRENT
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
