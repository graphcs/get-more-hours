"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { DocViewer } from "@/components/documents/doc-viewer";
import type { Document } from "@/types";

interface DocumentsListProps {
  documents: Document[];
}

function StatusDot({ status }: { status: string }) {
  if (status === "review_needed") {
    return (
      <span className="w-[7px] h-[7px] rounded-full bg-amber-500 shrink-0" />
    );
  }
  return null;
}

export function DocumentsList({ documents }: DocumentsListProps) {
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  const generated = documents.filter((d) => d.type === "generated");
  const uploaded = documents.filter((d) => d.type === "uploaded");

  if (viewingDoc) {
    return (
      <DocViewer document={viewingDoc} onClose={() => setViewingDoc(null)} />
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[15px] font-semibold text-foreground">
          Documents
        </h3>
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
          <Upload className="h-3 w-3" />
          Upload
        </Button>
      </div>

      {[
        { label: "AI-Generated", docs: generated },
        { label: "Uploaded", docs: uploaded },
      ].map((group) => (
        <div key={group.label}>
          <div
            className={`text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 pb-1 border-b border-gray-100 ${
              group.label === "Uploaded" ? "mt-3.5" : ""
            }`}
          >
            {group.label}
          </div>
          {group.docs.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No documents yet</p>
          ) : (
            group.docs.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2.5 py-2.5 border-b border-gray-100 last:border-0"
              >
                <div
                  className={`w-[30px] h-[30px] rounded-md flex items-center justify-center text-sm shrink-0 ${
                    d.type === "generated" ? "bg-blue-50" : "bg-gray-100"
                  }`}
                >
                  {d.type === "generated" ? "📄" : "📎"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {d.name}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Stage {d.stage} ·{" "}
                    {new Date(d.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <StatusDot status={d.status} />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setViewingDoc(d)}
                >
                  View
                </Button>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
