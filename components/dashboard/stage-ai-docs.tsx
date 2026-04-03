"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DocViewer } from "@/components/documents/doc-viewer";
import type { Document } from "@/types";
import type { StageDocConfig } from "@/lib/stage-config";
import { Lock, FileText } from "lucide-react";

interface StageAiDocsProps {
  docConfigs: StageDocConfig[];
  documents: Document[];
}

function StatusBadge({ status }: { status: string }) {
  if (status === "review_needed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
        <span className="w-[5px] h-[5px] rounded-full bg-amber-600" />
        Review Needed
      </span>
    );
  }
  if (status === "ready" || status === "reviewed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
        <span className="w-[5px] h-[5px] rounded-full bg-emerald-600" />
        Ready
      </span>
    );
  }
  return null;
}

export function StageAiDocs({ docConfigs, documents }: StageAiDocsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  if (viewingDoc) {
    return (
      <DocViewer document={viewingDoc} onClose={() => setViewingDoc(null)} />
    );
  }

  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
        AI-Generated Documents
      </h3>
      {docConfigs.map((cfg) => {
        const doc = documents.find(
          (d) =>
            d.type === "generated" &&
            d.name.includes(cfg.matchName)
        );
        const isLocked = cfg.locked && !doc;
        const isExpanded = expandedId === cfg.id;

        return (
          <div
            key={cfg.id}
            className={`bg-white border border-gray-200 rounded-xl shadow-sm mb-2.5 overflow-hidden ${
              isLocked ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center justify-between p-3.5 px-5">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center ${
                    isLocked ? "bg-gray-100" : "bg-blue-50"
                  }`}
                >
                  {isLocked ? (
                    <Lock className="h-4 w-4 text-gray-400" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {cfg.name}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {isLocked
                      ? "Will be generated when requirements are met"
                      : doc?.status === "review_needed"
                        ? "Review needed"
                        : "Ready"}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 items-center">
                {doc && <StatusBadge status={doc.status} />}
                {!isLocked && doc && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : cfg.id)
                    }
                  >
                    {isExpanded ? "Collapse" : "Preview"}
                  </Button>
                )}
              </div>
            </div>

            {/* Expanded preview */}
            {isExpanded && doc && (
              <div className="px-5 pb-4 pt-0 bg-gray-50 border-t border-gray-100">
                <p className="text-sm text-foreground leading-relaxed mt-3 line-clamp-4 font-serif">
                  {doc.content?.substring(0, 300)}...
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs">
                    Download
                  </Button>
                  {doc.status === "review_needed" && (
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => setViewingDoc(doc)}
                    >
                      Review & Edit
                    </Button>
                  )}
                  {doc.status !== "review_needed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setViewingDoc(doc)}
                    >
                      View
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Locked message */}
            {isLocked && cfg.lockedMessage && (
              <div className="px-5 pb-4 pt-0 bg-gray-50 border-t border-gray-100">
                <p className="text-sm text-gray-500 leading-relaxed mt-3">
                  {cfg.lockedMessage}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
