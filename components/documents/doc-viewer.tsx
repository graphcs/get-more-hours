"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LetterViewer } from "./letter-viewer";
import { PdfViewer } from "./pdf-viewer";
import { DocDetailsPanel } from "./doc-details-panel";
import { ChevronLeft, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { Document } from "@/types";

interface DocViewerProps {
  document: Document;
  onClose: () => void;
  isAdmin?: boolean;
  clientName?: string;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    review_needed: "bg-amber-50 text-amber-600 border-amber-200",
    ready: "bg-emerald-50 text-emerald-600 border-emerald-200",
    uploaded: "bg-blue-50 text-primary border-blue-200",
    reviewed: "bg-emerald-50 text-emerald-600 border-emerald-200",
    pending: "bg-gray-100 text-gray-400 border-gray-200",
  };

  const labels: Record<string, string> = {
    review_needed: "Review Needed",
    ready: "Ready",
    uploaded: "Uploaded",
    reviewed: "Reviewed",
    pending: "Generating...",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        styles[status] ?? styles.pending
      }`}
    >
      <span
        className={`w-[5px] h-[5px] rounded-full ${
          status === "review_needed"
            ? "bg-amber-600"
            : status === "ready" || status === "reviewed"
              ? "bg-emerald-600"
              : status === "uploaded"
                ? "bg-primary"
                : "bg-gray-400"
        }`}
      />
      {labels[status] ?? status}
    </span>
  );
}

export function DocViewer({
  document,
  onClose,
  isAdmin,
  clientName,
}: DocViewerProps) {
  const [showRight, setShowRight] = useState(true);
  const [doc, setDoc] = useState(document);

  const handleContentSaved = (newContent: string) => {
    setDoc({ ...doc, content: newContent, version: doc.version + 1 });
  };

  const handleMarkReviewed = async () => {
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reviewed" }),
      });
      if (res.ok) {
        setDoc({ ...doc, status: "reviewed" });
      }
    } catch (err) {
      console.error("Mark reviewed error:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="gap-1.5"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Button>
          <div className="w-px h-6 bg-gray-200" />
          <h2 className="text-[15px] font-semibold text-foreground">
            {doc.name}
          </h2>
          {clientName && (
            <span className="text-sm text-gray-500">— {clientName}</span>
          )}
          <StatusBadge status={doc.status} />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && doc.status !== "reviewed" && (
            <Button
              size="sm"
              onClick={handleMarkReviewed}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Mark Reviewed
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRight(!showRight)}
          >
            {showRight ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="sm">
            Download
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {doc.format === "pdf" || doc.type === "uploaded" ? (
          <PdfViewer
            storagePath={doc.storage_path}
            ocrProcessed={!!doc.ocr_text}
          />
        ) : (
          <LetterViewer
            content={doc.content || ""}
            documentId={doc.id}
            onContentSaved={handleContentSaved}
          />
        )}

        {showRight && <DocDetailsPanel document={doc} isAdmin={isAdmin} />}
      </div>
    </div>
  );
}
