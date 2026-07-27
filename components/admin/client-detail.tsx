"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocViewer } from "@/components/documents/doc-viewer";
import {
  BILLING_STATUS_MAP,
  getMltcLabel,
  getMltcRetirement,
  STAGE_LABELS,
  STATUS_MAP,
} from "@/lib/constants";
import { ArrowLeft, ChevronDown, KeyRound, Loader2, Sparkles } from "lucide-react";
import type {
  BillingRecord,
  Case,
  CRMNote,
  Document,
  IntakeData,
  StageNumber,
  StageStatus,
} from "@/types";

const STAGE_STATUS_OPTIONS: StageStatus[] = [
  "pending",
  "in_progress",
  "submitted",
  "responded",
  "complete",
];

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

  const [stageStatus, setStageStatus] = useState<StageStatus>(
    caseData.stage_status
  );
  const [stageStatusSaving, setStageStatusSaving] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [tier, setTier] = useState(caseData.tier);
  const [tierSaving, setTierSaving] = useState(false);
  const [compingStage, setCompingStage] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);

  const mltcLabel = getMltcLabel(caseData.mltc);
  // Old cases can still point at a plan that has since closed — we never
  // rewrite `cases.mltc`. Say so, so staff know why there is no plan address.
  const mltcRetirement = getMltcRetirement(caseData.mltc);
  const sm = STATUS_MAP[stageStatus] ?? STATUS_MAP.pending;
  const conditions = (intake?.conditions as string[]) || [];
  const canAdvance = caseData.current_stage < 3;
  const nextStage = (caseData.current_stage + 1) as StageNumber;

  async function handleChangeStageStatus(next: StageStatus) {
    if (next === stageStatus) return;
    const prev = stageStatus;
    setStageStatus(next);
    setStageStatusSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseData.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageStatus: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update status");
      }
      toast.success("Stage status updated");
    } catch (err) {
      setStageStatus(prev);
      toast.error(
        err instanceof Error ? err.message : "Failed to update status"
      );
    } finally {
      setStageStatusSaving(false);
    }
  }

  async function handleAdvanceStage() {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/cases/${caseData.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStage: nextStage }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to advance stage");
      }
      toast.success(`Advanced to Stage ${nextStage}`);
      setAdvanceOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to advance stage"
      );
    } finally {
      setAdvancing(false);
    }
  }

  async function handleToggleTier() {
    const next = tier === "white_glove" ? "self_serve" : "white_glove";
    const prev = tier;
    setTier(next);
    setTierSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseData.id}/tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update tier");
      }
      toast.success(
        next === "white_glove" ? "White Glove granted" : "White Glove removed"
      );
      router.refresh();
    } catch (err) {
      setTier(prev);
      toast.error(err instanceof Error ? err.message : "Failed to update tier");
    } finally {
      setTierSaving(false);
    }
  }

  async function handleComp(stage: number, action: "comp" | "uncomp") {
    setCompingStage(stage);
    try {
      const res = await fetch(`/api/cases/${caseData.id}/comp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update billing");
      }
      toast.success(
        action === "comp"
          ? `Stage ${stage} comped (marked paid)`
          : `Stage ${stage} comp removed`
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update billing"
      );
    } finally {
      setCompingStage(null);
    }
  }

  async function handleResetPassword() {
    setResetting(true);
    try {
      const res = await fetch(`/api/cases/${caseData.id}/reset-password`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to send reset email");
      toast.success(`Password reset email sent to ${body.email}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send reset email"
      );
    } finally {
      setResetting(false);
    }
  }

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

      {/* Case Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">
              Case Controls
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Override automated stage state when needed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">
                Stage Status
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 gap-1.5"
                      disabled={stageStatusSaving}
                    >
                      {stageStatusSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      {STATUS_MAP[stageStatus]?.label ?? stageStatus}
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="min-w-40">
                  {STAGE_STATUS_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onClick={() => handleChangeStageStatus(opt)}
                    >
                      {STATUS_MAP[opt]?.label ?? opt}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {canAdvance && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] uppercase tracking-wider text-gray-400">
                  Progress
                </span>
                <Button
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setAdvanceOpen(true)}
                >
                  Advance to Stage {nextStage}
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-2">
          <Button
            variant={tier === "white_glove" ? "outline" : "default"}
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={handleToggleTier}
            disabled={tierSaving}
          >
            {tierSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {tier === "white_glove" ? "Remove White Glove" : "Grant White Glove"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={handleResetPassword}
            disabled={resetting}
          >
            {resetting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <KeyRound className="h-3 w-3" />
            )}
            Send Password Reset
          </Button>
        </div>
      </div>

      {advanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <h3 className="text-base font-semibold text-foreground mb-1.5">
              Advance to Stage {nextStage}?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              This will move the case forward. The client will see the new
              stage immediately.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdvanceOpen(false)}
                disabled={advancing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAdvanceStage}
                disabled={advancing}
              >
                {advancing && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

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
                {mltcRetirement && (
                  <span
                    className="ml-1.5 align-middle inline-block rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                    title={`${mltcRetirement.reason}${
                      mltcRetirement.date
                        ? ` (closed ${mltcRetirement.date})`
                        : ""
                    }`}
                  >
                    Plan closed
                  </span>
                )}
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
                          BILLING_STATUS_MAP[b.status]?.className ??
                          BILLING_STATUS_MAP.pending.className
                        }`}
                      >
                        {BILLING_STATUS_MAP[b.status]?.label ?? b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">
                Comp / Unlock Stages
              </span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {([1, 2, 3] as const).map((s) => {
                  const fee = billing.find(
                    (b) => b.stage === s && b.type === "stage_fee"
                  );
                  const paid = fee?.status === "paid";
                  const isComp = paid && !fee?.stripe_payment_id;
                  const busy = compingStage === s;
                  return (
                    <Button
                      key={s}
                      variant={paid ? "outline" : "default"}
                      size="sm"
                      className="text-xs h-7"
                      disabled={
                        busy || tier === "white_glove" || (paid && !isComp)
                      }
                      onClick={() => handleComp(s, isComp ? "uncomp" : "comp")}
                    >
                      {busy && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                      {paid
                        ? isComp
                          ? `Stage ${s}: Remove comp`
                          : `Stage ${s}: Paid`
                        : `Comp Stage ${s}`}
                    </Button>
                  );
                })}
              </div>
              {tier === "white_glove" && (
                <p className="text-[11px] text-purple-600 mt-1.5">
                  White Glove bypasses all stage gates — per-stage comps
                  aren&apos;t needed.
                </p>
              )}
            </div>
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
