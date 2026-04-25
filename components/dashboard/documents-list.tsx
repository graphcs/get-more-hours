"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Upload } from "lucide-react";
import { DocViewer } from "@/components/documents/doc-viewer";
import { FileUpload } from "@/components/documents/file-upload";
import type { Document, StageNumber } from "@/types";

interface DocumentsListProps {
  documents: Document[];
  caseId?: string;
  currentStage?: StageNumber;
}

function isGenerating(doc: Document): boolean {
  return (
    doc.generation_status === "pending" ||
    doc.generation_status === "generating"
  );
}

function StatusDot({ doc }: { doc: Document }) {
  if (isGenerating(doc)) {
    return <Loader2 className="h-3 w-3 animate-spin text-amber-500 shrink-0" />;
  }
  if (doc.generation_status === "failed") {
    return (
      <span className="w-[7px] h-[7px] rounded-full bg-red-500 shrink-0" />
    );
  }
  if (doc.status === "review_needed") {
    return (
      <span className="w-[7px] h-[7px] rounded-full bg-amber-500 shrink-0" />
    );
  }
  return null;
}

export function DocumentsList({
  documents,
  caseId,
  currentStage,
}: DocumentsListProps) {
  const router = useRouter();
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");

  const generated = documents.filter((d) => d.type === "generated");
  const uploaded = documents.filter((d) => d.type === "uploaded");

  if (viewingDoc) {
    return (
      <DocViewer document={viewingDoc} onClose={() => setViewingDoc(null)} />
    );
  }

  const canUpload = !!caseId && !!currentStage;

  function handleUploaded() {
    setTimeout(() => {
      setUploadOpen(false);
      setUploadName("");
      router.refresh();
    }, 800);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-[15px] font-semibold text-foreground">
          Documents
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 gap-1"
          onClick={() => setUploadOpen(true)}
          disabled={!canUpload}
        >
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
                <StatusDot doc={d} />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setViewingDoc(d)}
                  disabled={isGenerating(d)}
                >
                  {isGenerating(d) ? "…" : "View"}
                </Button>
              </div>
            ))
          )}
        </div>
      ))}

      {canUpload && (
        <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Upload a document</SheetTitle>
              <SheetDescription>
                Name your document, then drag a file or click to browse.
              </SheetDescription>
            </SheetHeader>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="doc-name">Document name</Label>
                <Input
                  id="doc-name"
                  placeholder="e.g. IAD Notice, LOMN from Dr. Smith"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                />
              </div>
              {uploadName.trim().length >= 2 ? (
                <FileUpload
                  caseId={caseId!}
                  documentName={uploadName.trim()}
                  stage={currentStage!}
                  onUploaded={handleUploaded}
                />
              ) : (
                <p className="text-xs text-gray-400">
                  Enter a name to enable the upload zone.
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
