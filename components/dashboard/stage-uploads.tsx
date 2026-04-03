"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { FileUpload } from "@/components/documents/file-upload";
import type { Document } from "@/types";
import type { StageUploadSlot } from "@/lib/stage-config";

interface StageUploadsProps {
  uploadSlots: StageUploadSlot[];
  documents: Document[];
  stageNum: number;
  caseId: string;
}

export function StageUploads({
  uploadSlots,
  documents,
  stageNum,
  caseId,
}: StageUploadsProps) {
  const router = useRouter();
  const uploadedDocs = documents.filter(
    (d) => d.type === "uploaded" && d.stage === stageNum
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3.5">
        Documents to Upload
      </h3>
      <div className="grid gap-2.5">
        {uploadSlots.map((slot) => {
          const uploaded = uploadedDocs.find((d) =>
            d.name
              .toLowerCase()
              .includes(
                slot.name.toLowerCase().split("(")[0].trim().toLowerCase()
              )
          );

          return (
            <div
              key={slot.id}
              className={`p-3.5 px-4 rounded-lg border-[1.5px] ${
                uploaded
                  ? "border-emerald-200 border-solid bg-emerald-50"
                  : slot.critical
                    ? "border-blue-300 border-dashed bg-white"
                    : "border-gray-300 border-dashed bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      {slot.name}
                    </span>
                    {slot.required && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${
                          slot.critical ? "bg-primary" : "bg-gray-500"
                        }`}
                      >
                        REQUIRED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 leading-snug">
                    {slot.desc}
                  </div>
                  {uploaded && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 font-medium">
                      <Check className="h-3.5 w-3.5" />
                      {uploaded.name} · Uploaded{" "}
                      {new Date(uploaded.created_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      )}
                    </div>
                  )}
                </div>
                {!uploaded && (
                  <FileUpload
                    caseId={caseId}
                    documentName={slot.name}
                    stage={stageNum}
                    variant="compact"
                    onUploaded={() => router.refresh()}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
