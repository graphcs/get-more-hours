"use client";

import { Button } from "@/components/ui/button";
import type { Document } from "@/types";

interface Task {
  id: string;
  text: string;
  action: string;
  done: boolean;
  priority: boolean;
  docId?: string;
}

interface NextStepsProps {
  documents: Document[];
  currentStage: number;
  onViewDoc?: (docId: string) => void;
}

function deriveTasks(documents: Document[], currentStage: number): Task[] {
  const tasks: Task[] = [];

  if (currentStage === 1) {
    const requestLetter = documents.find(
      (d) =>
        d.type === "generated" &&
        d.stage === 1 &&
        d.name.includes("Request for Increase")
    );
    const lomnTemplate = documents.find(
      (d) =>
        d.type === "generated" &&
        d.stage === 1 &&
        d.name.includes("LOMN")
    );
    const uploadedLomn = documents.find(
      (d) =>
        d.type === "uploaded" &&
        d.stage === 1 &&
        d.name.toLowerCase().includes("lomn")
    );

    tasks.push({
      id: "review_request",
      text: "Review your AI-generated Request for Increase letter",
      action: "Review Letter",
      done: requestLetter?.status === "reviewed" || requestLetter?.status === "ready",
      priority: requestLetter?.status === "review_needed",
      docId: requestLetter?.id,
    });

    tasks.push({
      id: "send_lomn",
      text: "Send the LOMN request template to your doctor",
      action: "View Template",
      done: !!uploadedLomn,
      priority: !uploadedLomn && !!lomnTemplate,
      docId: lomnTemplate?.id,
    });

    tasks.push({
      id: "upload_lomn",
      text: "Upload the signed Letter of Medical Necessity from your doctor",
      action: "Upload",
      done: !!uploadedLomn,
      priority: false,
    });

    tasks.push({
      id: "submit_request",
      text: "Submit the request package to your MLTC case manager",
      action: "View Guide",
      done: false,
      priority: false,
    });
  }

  return tasks;
}

export function NextSteps({
  documents,
  currentStage,
}: NextStepsProps) {
  const tasks = deriveTasks(documents, currentStage);
  const remaining = tasks.filter((t) => !t.done).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[15px] font-semibold text-foreground">
          Next Steps
        </h3>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
          {remaining} remaining
        </span>
      </div>
      <div className="grid gap-1.5">
        {tasks.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 p-2.5 px-3 rounded-lg border ${
              t.done
                ? "bg-gray-50 border-gray-200 opacity-55"
                : t.priority
                  ? "bg-blue-50 border-blue-100"
                  : "bg-white border-gray-200"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full shrink-0 border-2 flex items-center justify-center ${
                t.done
                  ? "border-emerald-600 bg-emerald-600"
                  : "border-gray-300 bg-transparent"
              }`}
            >
              {t.done && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                >
                  <path
                    d="M2 5L4 7.5L8 3"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <span
              className={`flex-1 text-sm ${
                t.done
                  ? "text-gray-400 line-through"
                  : t.priority
                    ? "text-foreground font-medium"
                    : "text-foreground"
              }`}
            >
              {t.text}
              {t.priority && !t.done && (
                <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white align-middle">
                  ACTION NEEDED
                </span>
              )}
            </span>
            {!t.done && (
              <Button variant="outline" size="sm" className="text-xs h-7">
                {t.action}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
