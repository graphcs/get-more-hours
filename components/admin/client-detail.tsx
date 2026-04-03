"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DocViewer } from "@/components/documents/doc-viewer";
import { MLTC_OPTIONS, STAGE_LABELS, STATUS_MAP } from "@/lib/constants";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import type { Case, IntakeData, Document, BillingRecord, CRMNote } from "@/types";

interface ClientDetailProps {
  caseData: Case & { profile: { name: string } };
  intake: IntakeData | null;
  documents: Document[];
  billing: BillingRecord[];
  crmNotes: CRMNote[];
}

export function ClientDetail({
  caseData,
  intake,
  documents,
  billing,
  crmNotes: initialNotes,
}: ClientDetailProps) {
  const router = useRouter();
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [notes, setNotes] = useState(initialNotes);
  const [newNote, setNewNote] = useState("");
  const [posting, setPosting] = useState(false);

  const mltcLabel =
    MLTC_OPTIONS.find((o) => o.value === caseData.mltc)?.label ?? caseData.mltc;
  const sm = STATUS_MAP[caseData.stage_status] ?? STATUS_MAP.pending;
  const conditions = (intake?.conditions as string[]) || [];

  const handlePostNote = async () => {
    if (!newNote.trim()) return;
    setPosting(true);
    try {
      const res = await fetch("/api/crm-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: caseData.id, text: newNote }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes([data.note, ...notes]);
        setNewNote("");
      }
    } catch (err) {
      console.error("Note error:", err);
    } finally {
      setPosting(false);
    }
  };

  if (viewingDoc) {
    return (
      <DocViewer
        document={viewingDoc}
        onClose={() => setViewingDoc(null)}
        isAdmin
        clientName={caseData.profile.name}
      />
    );
  }

  const totalBilled = billing.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="max-w-5xl">
      {/* Back button */}
      <Button
        variant="outline"
        size="sm"
        className="mb-4 gap-1.5"
        onClick={() => router.push("/admin")}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Clients
      </Button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-foreground">
                {caseData.profile.name}
              </h1>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                style={{ background: sm.bg, color: sm.color, borderColor: sm.border }}
              >
                Stage {caseData.current_stage} · {sm.label}
              </span>
              {caseData.tier === "white_glove" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-600">
                  <Sparkles className="h-3 w-3" />
                  White Glove
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {caseData.case_number} · Last active{" "}
              {new Date(caseData.updated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Left column */}
        <div>
          {/* Case details */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
            <h3 className="text-[15px] font-semibold text-foreground mb-3">
              Case Details
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
              <div>
                <span className="text-gray-500">MLTC:</span>{" "}
                <span className="font-medium">{mltcLabel}</span>
              </div>
              <div>
                <span className="text-gray-500">Hours:</span>{" "}
                <span className="font-medium">
                  {caseData.current_hours}→{caseData.requested_hours} hrs/day
                </span>
              </div>
              <div>
                <span className="text-gray-500">Phone:</span>{" "}
                <span className="font-medium">{intake?.phone || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>{" "}
                <span className="font-medium">{intake?.email || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>{" "}
                <span className="font-medium">
                  {new Date(caseData.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            {conditions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {conditions.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 bg-blue-50 text-primary rounded text-xs font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
            <h3 className="text-[15px] font-semibold text-foreground mb-3">
              Documents
            </h3>
            {documents.length === 0 ? (
              <p className="text-sm text-gray-400">No documents yet</p>
            ) : (
              <div className="grid gap-1">
                {documents.map((d) => {
                  const docSm =
                    d.status === "review_needed"
                      ? "bg-amber-50 text-amber-600 border-amber-200"
                      : d.status === "reviewed"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                        : "bg-blue-50 text-primary border-blue-200";
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-2.5 py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm">
                        {d.type === "generated" ? "📄" : "📎"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate block">
                          {d.name}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          Stage {d.stage} ·{" "}
                          {new Date(d.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${docSm}`}
                      >
                        {d.status === "review_needed"
                          ? "Review"
                          : d.status === "reviewed"
                            ? "Reviewed"
                            : d.status}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setViewingDoc(d)}
                      >
                        View
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Billing */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-foreground">
                Billing
              </h3>
              <span className="text-sm font-bold text-foreground">
                Total: ${(totalBilled / 100).toFixed(2)}
              </span>
            </div>
            {billing.length === 0 ? (
              <p className="text-sm text-gray-400">No billing records</p>
            ) : (
              <div className="grid gap-1">
                {billing.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <span className="text-sm text-foreground">
                        {STAGE_LABELS[b.stage]} — {b.type === "white_glove" ? "White Glove" : "Stage Fee"}
                      </span>
                      <span className="text-[11px] text-gray-400 block">
                        {new Date(b.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        ${(b.amount / 100).toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                          b.status === "paid"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — CRM Notes */}
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm">
            <h3 className="text-[15px] font-semibold text-foreground mb-3">
              CRM Notes
            </h3>
            <Textarea
              placeholder="Add a note about this client..."
              rows={3}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="text-sm mb-2"
            />
            <Button
              size="sm"
              onClick={handlePostNote}
              disabled={posting || !newNote.trim()}
              className="w-full mb-4"
            >
              {posting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Add Note
            </Button>

            {notes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No notes yet
              </p>
            ) : (
              <div className="grid gap-3">
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className="border-b border-gray-100 pb-3 last:border-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        {(n as CRMNote & { author?: { name: string } }).author?.name ?? "Admin"}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(n.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {n.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
