"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LetterViewer } from "./letter-viewer";
import { PdfViewer } from "./pdf-viewer";
import { DocDetailsPanel } from "./doc-details-panel";
import {
  AlertCircle,
  ChevronLeft,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import type { Document } from "@/types";

interface DocViewerProps {
  document: Document;
  onClose: () => void;
  isAdmin?: boolean;
  clientName?: string;
}

type DerivedStatus =
  | "generating"
  | "failed"
  | "review_needed"
  | "ready"
  | "uploaded"
  | "reviewed"
  | "pending";

function deriveStatus(doc: Document): DerivedStatus {
  if (doc.generation_status === "failed") return "failed";
  if (
    doc.generation_status === "pending" ||
    doc.generation_status === "generating"
  ) {
    return "generating";
  }
  return doc.status as DerivedStatus;
}

function isNonTerminal(doc: Document): boolean {
  const g = doc.generation_status;
  const o = doc.ocr_status;
  return g === "pending" || g === "generating" || o === "pending" || o === "processing";
}

const DOC_NAME_TO_TYPE: Record<string, string> = {
  "Request for Increase in Plan of Care": "stage1_request",
  "LOMN Request Template (for your Doctor)": "stage1_lomn",
  "Internal Appeal Letter": "stage2_appeal",
  "Fair Hearing Request": "stage3_hearing",
  "Memo of Law": "stage3_memo",
};

function StatusBadge({ status }: { status: DerivedStatus }) {
  if (status === "generating") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50 text-amber-600 border-amber-200">
        <Loader2 className="h-3 w-3 animate-spin" />
        Generating...
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-red-50 text-red-600 border-red-200">
        <AlertCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }

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
    pending: "Pending",
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
  const [retrying, setRetrying] = useState(false);

  const derived = deriveStatus(doc);
  const polling = isNonTerminal(doc);

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

  const latestDocRef = useRef(doc);
  latestDocRef.current = doc;

  useEffect(() => {
    if (!polling) return;
    const controller = new AbortController();
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${doc.id}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        const fresh = data.document as Document;
        setDoc((prev) => ({ ...prev, ...fresh }));
        if (!isNonTerminal(fresh)) {
          clearInterval(interval);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Poll error:", err);
      }
    }, 3000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [doc.id, polling]);

  const documentType = useMemo(
    () => DOC_NAME_TO_TYPE[doc.name],
    [doc.name]
  );

  const handleRetry = useCallback(async () => {
    if (!documentType) {
      toast.error("Cannot retry — unknown document type");
      return;
    }
    setRetrying(true);
    setDoc((prev) => ({
      ...prev,
      generation_status: "generating",
      generation_error: null,
    }));
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: doc.case_id,
          documentType,
          documentId: doc.id,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Retry failed");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Retry failed"
      );
      setDoc((prev) => ({
        ...prev,
        generation_status: "failed",
        generation_error:
          err instanceof Error ? err.message : "Retry failed",
      }));
    } finally {
      setRetrying(false);
    }
  }, [doc.case_id, doc.id, documentType]);

  const showPdf = doc.format === "pdf" || doc.type === "uploaded";
  const downloadDisabled = polling || derived === "failed";

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
          <StatusBadge status={derived} />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && doc.status !== "reviewed" && derived !== "generating" && derived !== "failed" && (
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
          <Button variant="outline" size="sm" disabled={downloadDisabled}>
            Download
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {derived === "failed" ? (
          <div className="flex-1 flex items-center justify-center p-10">
            <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <h3 className="text-base font-semibold">Generation failed</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">
                {doc.generation_error ||
                  "Something went wrong while generating this document."}
              </p>
              <Button
                onClick={handleRetry}
                disabled={retrying || !documentType}
                className="gap-1.5"
              >
                {retrying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" />
                )}
                Retry generation
              </Button>
              {!documentType && (
                <p className="text-xs text-gray-400 mt-2">
                  Unknown document type — cannot retry automatically.
                </p>
              )}
            </div>
          </div>
        ) : derived === "generating" ? (
          <div className="flex-1 flex items-center justify-center p-10">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Generating your document...</p>
              <p className="text-xs text-gray-400">
                This usually takes 10–30 seconds.
              </p>
            </div>
          </div>
        ) : showPdf ? (
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
