import type { Document, StageStatus } from "@/types";
import type { StagePaymentGate } from "@/lib/billing/payment-required";

/**
 * Derivation for the two client-facing progress panels: the dashboard
 * `Timeline` and the per-stage `Progress` panel.
 *
 * Split out of the components so the "does this entry claim something true?"
 * rules are unit-testable. The bug this exists to prevent: intake creates BOTH
 * Stage 1 documents as `generation_status: 'pending'` placeholders, and both
 * panels treated the mere existence of a row as proof of generation — the
 * dashboard by setting `done: true` on any matching row, the stage panel by
 * counting rows (`generatedDocs.length + uploadedDocs.length`). On an unpaid
 * case they said "Request letter generated" / "LOMN template generated" next to
 * a card explaining that nothing was generating and a documents list showing
 * both as "Locked".
 */

/** Visual/semantic state of a timeline entry. */
export type TimelineState =
  | "done"
  | "in_progress"
  | "blocked"
  | "failed"
  | "upcoming";

export interface TimelineEntry {
  /** Small caption above the entry: a date, or a status word ("Pending", "—"). */
  date: string;
  text: string;
  state: TimelineState;
}

export interface DeriveTimelineInput {
  documents: Document[];
  caseCreatedAt: string;
  /** Current stage's workflow status, used for the submit/determination steps. */
  stageStatus?: StageStatus;
  currentStage?: number;
  /**
   * Set when the current stage's fee is unpaid (from `getStagePaymentGate`).
   * A pending document at that stage is blocked on payment, not in flight.
   */
  paymentGate?: StagePaymentGate | null;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * True only when the document really has generated content. `generation_status`
 * is nullable for rows predating migration 009, which backfilled `ready` for
 * anything that had content — so a null status with content is also generated.
 */
function isGenerated(doc: Document): boolean {
  if (doc.generation_status === "ready") return true;
  return doc.generation_status == null && !!doc.content;
}

function findGenerated(documents: Document[], nameFragment: string) {
  return documents.find(
    (d) =>
      d.type === "generated" &&
      d.stage === 1 &&
      d.name.includes(nameFragment)
  );
}

/** True once the case has moved beyond `stage`, or that stage was submitted. */
function isStageSubmitted(
  stageStatus: StageStatus | undefined,
  currentStage: number,
  stage: number
): boolean {
  if (currentStage > stage) return true;
  if (currentStage < stage) return false;
  return (
    stageStatus === "submitted" ||
    stageStatus === "responded" ||
    stageStatus === "complete"
  );
}

/** True once the MLTC/judge has come back on `stage`. */
function isStageDetermined(
  stageStatus: StageStatus | undefined,
  currentStage: number,
  stage: number
): boolean {
  if (currentStage > stage) return true;
  if (currentStage < stage) return false;
  return stageStatus === "responded" || stageStatus === "complete";
}

/**
 * One timeline entry per Stage 1 generated document, reflecting its real
 * generation state. A placeholder that cannot generate because the stage fee is
 * unpaid, one that is actually running, and one that failed are three different
 * situations and must not all read as "generated".
 */
function generatedDocEntry(
  doc: Document | undefined,
  label: string,
  gated: boolean
): TimelineEntry | null {
  if (!doc) return null;

  if (isGenerated(doc)) {
    // The row is created at intake, so `created_at` is the intake date, not the
    // date it was written. `updated_at` is when generation completed.
    return {
      date: formatDate(doc.updated_at || doc.created_at),
      text: `${label} generated`,
      state: "done",
    };
  }

  if (doc.generation_status === "failed") {
    return {
      date: "Failed",
      text: `${label} couldn't be generated — our team has been notified`,
      state: "failed",
    };
  }

  if (doc.generation_status === "generating") {
    return {
      date: "In progress",
      text: `${label} being written now`,
      state: "in_progress",
    };
  }

  // pending (or an unknown/null status with no content): not started.
  return gated
    ? {
        date: "Pending",
        text: `${label} — starts when the stage fee is paid`,
        state: "blocked",
      }
    : {
        date: "Pending",
        text: `${label} not generated yet`,
        state: "upcoming",
      };
}

export function deriveTimeline({
  documents,
  caseCreatedAt,
  stageStatus,
  currentStage = 1,
  paymentGate,
}: DeriveTimelineInput): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // The dashboard only renders this panel for an existing case, and intake
  // rolls the case back if the intake row fails to save — so this one is true.
  entries.push({
    date: formatDate(caseCreatedAt),
    text: "Intake completed",
    state: "done",
  });

  const gated = !!paymentGate && paymentGate.stage === 1;

  const requestEntry = generatedDocEntry(
    findGenerated(documents, "Request for Increase"),
    "Request letter",
    gated
  );
  if (requestEntry) entries.push(requestEntry);

  const lomnEntry = generatedDocEntry(
    findGenerated(documents, "LOMN"),
    "LOMN template",
    gated
  );
  if (lomnEntry) entries.push(lomnEntry);

  const uploadedDocs = documents.filter((d) => d.type === "uploaded");
  uploadedDocs.forEach((d) => {
    // The row is only written after the file lands in storage, so "uploaded" is
    // always true here regardless of OCR state.
    entries.push({
      date: formatDate(d.created_at),
      text: `${d.name} uploaded`,
      state: "done",
    });
  });

  if (!uploadedDocs.some((d) => d.name.toLowerCase().includes("lomn"))) {
    entries.push({
      date: "Pending",
      text: "Upload signed LOMN",
      state: "upcoming",
    });
  }

  // A case that has moved past this stage, or been marked submitted/responded,
  // has demonstrably been submitted — showing those steps as never-started is
  // the same class of untruth in the other direction.
  const submitted = isStageSubmitted(stageStatus, currentStage, 1);
  const determined = isStageDetermined(stageStatus, currentStage, 1);

  entries.push({
    date: submitted ? "Completed" : "—",
    text: "Finalize & submit to MLTC",
    state: submitted ? "done" : "upcoming",
  });

  entries.push({
    date: determined ? "Completed" : submitted ? "In progress" : "—",
    text: determined
      ? "MLTC determination received"
      : "Await MLTC determination (2–4 wks)",
    state: determined ? "done" : submitted ? "in_progress" : "upcoming",
  });

  return entries;
}

/**
 * ─── Per-stage Progress panel ────────────────────────────────────────────────
 *
 * The stage panel's steps are fixed prose per stage (lib/stage-config.ts) and
 * cover things the dashboard timeline doesn't — reviewing a letter, uploading a
 * specific MLTC notice, attending a hearing. Rather than force them through
 * `deriveTimeline`, each step declares what would make it true and is evaluated
 * against the same `TimelineState` vocabulary. A step with no observable signal
 * (`manual`) is never marked done off the back of unrelated activity.
 */
export type StageStepRequirement =
  /** Always true — the case exists. */
  | { kind: "intake" }
  /** A generated document with this name fragment has content. */
  | { kind: "generated"; match: string }
  /** …and the client has marked it reviewed. */
  | { kind: "reviewed"; match: string }
  /** An uploaded document matching any of these keywords exists. */
  | { kind: "uploaded"; match: string[] }
  /** The stage has been submitted (or the case has moved past it). */
  | { kind: "submitted" }
  /** A determination/decision has come back. */
  | { kind: "determined" }
  /** Happens outside the product; only a stage completing can imply it. */
  | { kind: "manual" };

export interface StageTimelineStepInput {
  text: string;
  requires?: StageStepRequirement;
}

export interface DeriveStageTimelineInput {
  steps: StageTimelineStepInput[];
  /** Documents for this stage only. */
  documents: Document[];
  stageNum: number;
  currentStage: number;
  stageStatus?: StageStatus;
  /** Unpaid fee for this stage, from `getStagePaymentGate`. */
  paymentGate?: StagePaymentGate | null;
}

export interface StageTimelineEntry {
  text: string;
  state: TimelineState;
  /** Highlighted as the step the client is on. Never set on a done step. */
  current: boolean;
}

function findStageGenerated(documents: Document[], match: string) {
  return documents.find((d) => d.type === "generated" && d.name.includes(match));
}

function hasUpload(documents: Document[], keywords: string[]): boolean {
  return documents.some(
    (d) =>
      d.type === "uploaded" &&
      keywords.some((kw) => d.name.toLowerCase().includes(kw.toLowerCase()))
  );
}

function stageStepState(
  requires: StageStepRequirement | undefined,
  input: DeriveStageTimelineInput,
  gated: boolean
): TimelineState {
  const { documents, stageNum, currentStage, stageStatus } = input;

  switch (requires?.kind) {
    case "intake":
      return "done";

    case "generated": {
      const doc = findStageGenerated(documents, requires.match);
      if (doc && isGenerated(doc)) return "done";
      if (doc?.generation_status === "failed") return "failed";
      if (doc?.generation_status === "generating") return "in_progress";
      // Pending placeholder, or no row at all — nothing has been written.
      return gated ? "blocked" : "upcoming";
    }

    case "reviewed": {
      const doc = findStageGenerated(documents, requires.match);
      if (doc?.status === "reviewed") return "done";
      // Can't review a letter that doesn't exist yet.
      if (!doc || !isGenerated(doc)) return gated ? "blocked" : "upcoming";
      return "upcoming";
    }

    case "uploaded":
      return hasUpload(documents, requires.match) ? "done" : "upcoming";

    case "submitted":
      return isStageSubmitted(stageStatus, currentStage, stageNum)
        ? "done"
        : "upcoming";

    case "determined":
      if (isStageDetermined(stageStatus, currentStage, stageNum)) return "done";
      return isStageSubmitted(stageStatus, currentStage, stageNum)
        ? "in_progress"
        : "upcoming";

    // "manual" and unconfigured steps have no signal to read.
    default:
      return "upcoming";
  }
}

export function deriveStageTimeline(
  input: DeriveStageTimelineInput
): StageTimelineEntry[] {
  const { steps, stageNum, currentStage, paymentGate } = input;

  // A stage the case has moved beyond is finished, whatever its rows look like.
  if (currentStage > stageNum) {
    return steps.map((s) => ({ text: s.text, state: "done", current: false }));
  }

  // A stage the case hasn't reached has not started. Nothing there is done.
  if (currentStage < stageNum) {
    return steps.map((s) => ({
      text: s.text,
      state: "upcoming",
      current: false,
    }));
  }

  const gated = !!paymentGate && paymentGate.stage === stageNum;

  const states = steps.map((s) => stageStepState(s.requires, input, gated));
  // Highlight the first unfinished step, unless it already carries its own
  // signal (blocked / generating / failed all say more than "CURRENT" does).
  const currentIndex = states.findIndex((s) => s !== "done");

  return steps.map((s, i) => ({
    text: s.text,
    state: states[i],
    current: i === currentIndex && states[i] === "upcoming",
  }));
}
