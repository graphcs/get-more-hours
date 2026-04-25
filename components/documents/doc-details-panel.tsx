"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Document, DocumentVersion, DocumentComment } from "@/types";

interface DocDetailsPanelProps {
  document: Document;
  isAdmin?: boolean;
}

type Tab = "details" | "comments" | "history";

function DetailsTab({ document }: { document: Document }) {
  const rows = [
    {
      label: "Type",
      value: document.type === "generated" ? "AI Generated" : "Uploaded",
    },
    {
      label: "Format",
      value: document.format === "letter" ? "Letter" : "PDF",
    },
    { label: "Stage", value: `Stage ${document.stage}` },
    {
      label: "Date",
      value: new Date(document.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    },
    { label: "Version", value: `v${document.version}` },
  ];

  return (
    <div>
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex justify-between py-2 border-b border-gray-100"
        >
          <span className="text-sm text-gray-500">{r.label}</span>
          <span className="text-sm font-medium text-foreground">{r.value}</span>
        </div>
      ))}

      {document.type === "uploaded" && document.ocr_text && (
        <div className="mt-4 p-2.5 px-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="text-xs font-semibold text-emerald-600">
            OCR Processing Complete
          </div>
          <div className="text-xs text-foreground mt-0.5">
            Text extracted and available for AI analysis.
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {document.type === "uploaded" ? (
          <UploadedDownloadButton
            storagePath={document.storage_path}
            fileName={document.name}
          />
        ) : (
          <GeneratedLetterActions
            documentId={document.id}
            documentName={document.name}
            disabled={!document.content}
          />
        )}
      </div>
    </div>
  );
}

function GeneratedLetterActions({
  documentId,
  documentName,
  disabled,
}: {
  documentId: string;
  documentName: string;
  disabled?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/pdf`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${documentName}.pdf`;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    window.open(`/api/documents/${documentId}/pdf?mode=inline`, "_blank");
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={handleDownload}
        disabled={disabled || downloading}
      >
        {downloading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
        Save as PDF
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={handlePrint}
        disabled={disabled}
      >
        Print
      </Button>
    </>
  );
}

function UploadedDownloadButton({
  storagePath,
  fileName,
}: {
  storagePath: string | null;
  fileName: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (!storagePath) {
      toast.error("No file attached");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(storagePath, 60);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "Could not create download link");
      }
      const anchor = window.document.createElement("a");
      anchor.href = data.signedUrl;
      anchor.download = fileName;
      anchor.rel = "noopener";
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
      Download
    </Button>
  );
}

function CommentsTab({ documentId }: { documentId: string }) {
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/comments`)
      .then((res) => res.json())
      .then((data) => {
        setComments(data.comments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [documentId]);

  const handlePost = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
      }
    } catch (err) {
      console.error("Comment error:", err);
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      {comments.length === 0 ? (
        <div className="text-center py-7 text-gray-400 text-sm">
          No comments yet
        </div>
      ) : (
        <div className="grid gap-3.5 mb-4">
          {comments.map((c) => (
            <div key={c.id}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-primary flex items-center justify-center text-[9px] font-bold">
                  {(c.author?.name ?? "U").charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {c.author?.name ?? "User"}
                </span>
                {c.author?.role === "admin" && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-primary">
                    STAFF
                  </span>
                )}
              </div>
              <div className="text-sm text-foreground leading-relaxed ml-8">
                {c.text}
              </div>
              <div className="text-[11px] text-gray-400 ml-8 mt-0.5">
                {new Date(c.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-200 pt-3.5">
        <Textarea
          placeholder="Add a comment..."
          rows={3}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="text-sm"
        />
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={handlePost} disabled={posting || !newComment.trim()}>
            {posting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/documents/${documentId}`)
      .then((res) => res.json())
      .then((data) => {
        setVersions(data.versions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [documentId]);

  async function handleRestore(versionId: string, versionNum: number) {
    setRestoringId(versionId);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Restore failed");
      }
      toast.success(`Restored v${versionNum}`);
      // Refresh the server tree so letter body updates.
      router.refresh();
      // Re-fetch versions list to show the new restore entry.
      const fresh = await fetch(`/api/documents/${documentId}`).then((r) =>
        r.json()
      );
      setVersions(fresh.versions || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-7 text-gray-400 text-sm">
        No version history
      </div>
    );
  }

  return (
    <div className="relative pl-5">
      <div className="absolute left-[5px] top-1 bottom-1 w-0.5 bg-gray-200" />
      {versions.map((v, i) => (
        <div
          key={v.id}
          className={`relative ${i < versions.length - 1 ? "mb-5" : ""}`}
        >
          <div
            className={`w-3 h-3 rounded-full absolute -left-5 top-[3px] border-2 ${
              i === 0
                ? "bg-primary border-blue-300"
                : "bg-gray-300 border-gray-200"
            }`}
          />
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-semibold text-foreground">
              Version {v.version}
            </span>
            {i === 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-primary">
                CURRENT
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {new Date(v.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
          <div className="text-xs text-gray-500 mb-0.5">by {v.author}</div>
          {v.note && (
            <div className="text-xs text-foreground italic leading-snug">
              &ldquo;{v.note}&rdquo;
            </div>
          )}
          {i !== 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1.5 h-6 text-[11px] gap-1"
              onClick={() => handleRestore(v.id, v.version)}
              disabled={restoringId !== null}
            >
              {restoringId === v.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Restore
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export function DocDetailsPanel({ document }: DocDetailsPanelProps) {
  const [tab, setTab] = useState<Tab>("details");

  const tabs: { id: Tab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "comments", label: "Comments" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="w-[310px] bg-white border-l border-gray-200 flex flex-col shrink-0">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 px-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "text-primary border-primary font-semibold"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === "details" && <DetailsTab document={document} />}
        {tab === "comments" && <CommentsTab documentId={document.id} />}
        {tab === "history" && <HistoryTab documentId={document.id} />}
      </div>
    </div>
  );
}
