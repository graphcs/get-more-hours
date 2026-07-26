import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { PRICING } from "@/lib/constants";
import {
  NAME_MAP,
  runDocumentGeneration,
  type DocumentType,
} from "@/lib/document-generation";
import type { StagePaymentGate } from "@/lib/billing/payment-required";

export type { StagePaymentGate };

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONLY SUPPORTED WAY TO MARK A STAGE FEE PAID.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Marking a stage `paid` is never just a billing write — it is also the event
 * that unblocks document generation for that stage. Prior to this module the
 * Stripe webhook did both and the admin "comp" route did only the billing
 * write, so comping a stage unlocked the payment gate but never started any
 * work: the client sat on a "GENERATING" spinner indefinitely while the admin
 * UI showed "paid". Two production cases were stranded this way (one for 26
 * days).
 *
 * To make that class of bug non-reintroducible:
 *   1. `markStagePaid()` performs the billing write AND schedules generation as
 *      a single indivisible operation. There is no exported way to do one
 *      without the other.
 *   2. Direct `status: "paid"` writes to the `billing` table are banned outside
 *      this directory by an ESLint `no-restricted-syntax` rule (see
 *      eslint.config.mjs). Any new "mark it paid" code path fails lint until it
 *      routes through here.
 */

// Single source of truth for per-stage pricing. Never hardcode cent amounts.
export const STAGE_FEE_AMOUNTS: Record<number, number> = {
  1: PRICING.stage1,
  2: PRICING.stage2,
  3: PRICING.stage3,
};

export const MAX_STAGE = 3;

export function stageFeeAmount(stage: number): number {
  const amount = STAGE_FEE_AMOUNTS[stage];
  if (!amount) throw new Error(`Invalid stage: ${stage}`);
  return amount;
}

export function isValidStage(stage: number): boolean {
  return Number.isInteger(stage) && stage >= 1 && stage <= MAX_STAGE;
}

/** Schedules post-response work. Injectable so tests don't need a request scope. */
export type Scheduler = (task: () => Promise<void>) => void;

const defaultScheduler: Scheduler = (task) => {
  after(task);
};

const NAME_TO_TYPE: Record<string, DocumentType> = Object.fromEntries(
  Object.entries(NAME_MAP).map(([type, name]) => [name, type as DocumentType])
);

/**
 * Looks up placeholder documents at the given (case, stage) whose generation
 * hasn't completed yet, and runs generation for any whose name matches a known
 * document type. Stage 1 placeholders are created at intake; Stage 2/3 are
 * usually created by the OCR auto-detect flow — this catches both paths.
 *
 * Exported for the reaper / retry paths; normal payment flows should call
 * `markStagePaid`, which invokes this for you.
 */
export async function triggerStageGeneration(
  caseId: string,
  stage: number
): Promise<void> {
  const client = await createServiceClient();
  const { data: docs, error } = await client
    .from("documents")
    .select("id, name, generation_status")
    .eq("case_id", caseId)
    .eq("stage", stage)
    .eq("type", "generated")
    .neq("generation_status", "ready");

  if (error) {
    console.error("triggerStageGeneration: lookup failed", error);
    return;
  }

  // runDocumentGeneration now reports a GenerationOutcome rather than void, so
  // the outcome is deliberately discarded here — a document that was already
  // ready, or is mid-flight under another claim, is not an error for the payment
  // path. Real failures are recorded on the row itself.
  const jobs: Promise<unknown>[] = [];
  for (const d of docs || []) {
    const documentType = NAME_TO_TYPE[d.name as string];
    if (!documentType) continue;
    jobs.push(
      runDocumentGeneration({ caseId, documentType, documentId: d.id as string })
    );
  }
  // allSettled so one failed generation doesn't drop sibling generations;
  // runDocumentGeneration records failed status internally on throw.
  await Promise.allSettled(jobs);
}

/**
 * Idempotently creates the `pending` stage_fee row for a stage so the client is
 * actually asked to pay. Called when a stage becomes *reachable* — at intake
 * (stage 1), when the previous stage is paid, and when an upload advances the
 * case — rather than after generation. Creating it after generation was
 * circular for stages 2/3: generation is gated on the fee being paid, but the
 * fee row that prompts payment was only written by generation.
 */
export async function ensureStageFeeRow(
  client: SupabaseClient,
  caseId: string,
  stage: number
): Promise<void> {
  if (!isValidStage(stage)) return;

  const { data: existing, error: lookupErr } = await client
    .from("billing")
    .select("id")
    .eq("case_id", caseId)
    .eq("stage", stage)
    .eq("type", "stage_fee")
    .limit(1);

  if (lookupErr) {
    console.error("ensureStageFeeRow: lookup failed", lookupErr);
    return;
  }
  if (existing && existing.length > 0) return;

  const { error } = await client.from("billing").insert({
    case_id: caseId,
    stage,
    amount: stageFeeAmount(stage),
    type: "stage_fee",
    status: "pending",
  });

  // A concurrent writer may have inserted the same row; that's fine.
  if (error) console.error("ensureStageFeeRow: insert failed", error);
}

/**
 * Server-side companion to the client `PayToGenerateCard`: returns the gate
 * details when this stage's fee is unpaid, or `null` when there is nothing to
 * pay. White Glove bypasses every per-stage gate, exactly like
 * `checkStagePaid` (lib/billing/guard.ts).
 */
export async function getStagePaymentGate(
  client: SupabaseClient,
  caseRow: { id: string; tier?: string | null },
  stage: number
): Promise<StagePaymentGate | null> {
  if (!isValidStage(stage)) return null;
  if (caseRow.tier === "white_glove") return null;

  const { data: paid } = await client
    .from("billing")
    .select("id")
    .eq("case_id", caseRow.id)
    .eq("stage", stage)
    .eq("type", "stage_fee")
    .eq("status", "paid")
    .maybeSingle();

  if (paid) return null;

  return { caseId: caseRow.id, stage, amount: stageFeeAmount(stage) };
}

/**
 * Records a paid White Glove add-on and flips the case to the white_glove tier.
 * White Glove bypasses the per-stage gate entirely (lib/billing/guard.ts), so
 * unlike a stage fee there is no per-stage generation to schedule here.
 */
export async function recordWhiteGloveUpgrade({
  client,
  caseId,
  stage = 1,
  stripePaymentId = null,
  stripeEvent = null,
}: {
  client: SupabaseClient;
  caseId: string;
  stage?: number;
  stripePaymentId?: string | null;
  stripeEvent?: Record<string, unknown> | null;
}): Promise<void> {
  await client.from("billing").insert({
    case_id: caseId,
    stage,
    amount: PRICING.whiteGlove,
    type: "white_glove",
    status: "paid",
    stripe_payment_id: stripePaymentId,
    stripe_event: stripeEvent,
  });

  await client.from("cases").update({ tier: "white_glove" }).eq("id", caseId);
}

export interface MarkStagePaidOptions {
  /** Supabase client used for the billing write (service client or an admin RLS client). */
  client: SupabaseClient;
  caseId: string;
  stage: number;
  /** Stripe payment intent id, when this came from a real payment. */
  stripePaymentId?: string | null;
  /** Audit payload stored on the billing row (raw Stripe event, or comp metadata). */
  stripeEvent?: Record<string, unknown> | null;
  /** Override the post-response scheduler. Tests only. */
  schedule?: Scheduler;
}

export type MarkStagePaidResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Marks a stage fee paid AND schedules generation of that stage's documents.
 *
 * Both halves always happen together — this is the invariant the payment gate
 * depends on. Generation is scheduled via `after()` so it never blocks the
 * response (Stripe webhooks in particular must return promptly).
 */
export async function markStagePaid({
  client,
  caseId,
  stage,
  stripePaymentId = null,
  stripeEvent = null,
  schedule = defaultScheduler,
}: MarkStagePaidOptions): Promise<MarkStagePaidResult> {
  if (!isValidStage(stage)) {
    return { ok: false, error: `Invalid stage: ${stage}` };
  }

  const { data: existing } = await client
    .from("billing")
    .select("id")
    .eq("case_id", caseId)
    .eq("stage", stage)
    .eq("type", "stage_fee")
    .maybeSingle();

  const patch: Record<string, unknown> = { status: "paid" };
  if (stripePaymentId) patch.stripe_payment_id = stripePaymentId;
  if (stripeEvent) patch.stripe_event = stripeEvent;

  if (existing) {
    const { error } = await client
      .from("billing")
      .update(patch)
      .eq("id", existing.id);
    if (error) {
      console.error("markStagePaid: update failed", error);
      return { ok: false, error: "Failed to record payment" };
    }
  } else {
    const { error } = await client.from("billing").insert({
      case_id: caseId,
      stage,
      amount: stageFeeAmount(stage),
      type: "stage_fee",
      ...patch,
    });
    if (error) {
      console.error("markStagePaid: insert failed", error);
      return { ok: false, error: "Failed to record payment" };
    }
  }

  // The next stage is now unlocked (sequential unlock), so surface its fee to
  // the client instead of leaving them with nothing to act on.
  if (stage < MAX_STAGE) {
    await ensureStageFeeRow(client, caseId, stage + 1);
  }

  // NON-NEGOTIABLE: paying for a stage starts the work for that stage.
  schedule(() => triggerStageGeneration(caseId, stage));

  return { ok: true };
}
