"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
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
        <Button variant="outline" className="w-full">
          Download PDF
        </Button>
        <Button variant="outline" className="w-full">
          Print
        </Button>
      </div>
    </div>
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
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/documents/${documentId}`)
      .then((res) => res.json())
      .then((data) => {
        setVersions(data.versions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [documentId]);

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
