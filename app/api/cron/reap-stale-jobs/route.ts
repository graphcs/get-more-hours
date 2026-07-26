import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { STALE_CLAIM_SECONDS } from "@/lib/ai-limits";
import { tagAiError } from "@/lib/ai-errors";

// Backstop reaper.
//
// runDocumentGeneration and the OCR route both flip a row into a non-terminal
// state ('generating' / 'processing') before calling the model. If the function
// dies mid-flight — Vercel timeout, cold kill, deploy — no catch block runs and
// the row stays non-terminal forever: the UI spins and, before migration 017,
// the row could never be claimed again.
//
// Two defences now exist. The primary one is claim_document_generation(), which
// lets a *new* attempt steal a stale claim immediately, so a user pressing
// "Try again" recovers without waiting for anything. This route is the second:
// it flips rows nobody is looking at into 'failed' with an explanatory error,
// which is what makes the existing "Try again" affordance render at all (the
// viewer only offers retry for a failed row).
//
// Safe to run at any frequency and safe to run concurrently: every write is an
// idempotent filtered UPDATE.

export const dynamic = "force-dynamic";
// NOTE: Next.js requires route segment config to be a static literal, so this
// cannot reference AI_MAX_DURATION_SECONDS directly — keep the two in sync.
// 300s is the ceiling on the project's Vercel Pro plan.
export const maxDuration = 300;

const STALLED_GENERATION_MESSAGE = tagAiError(
  "stalled",
  "Generation did not finish — the worker stopped before completing (likely a function timeout or deploy). Reclaimed by the stale-job reaper."
);

const STALLED_OCR_MESSAGE = tagAiError(
  "stalled",
  "Document processing did not finish — the worker stopped before completing. Reclaimed by the stale-job reaper."
);

function authorize(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed. An unauthenticated reaper is a free way for anyone to mark
    // in-flight documents as failed.
    console.error("[reap-stale-jobs] CRON_SECRET is not set — refusing to run");
    return NextResponse.json(
      { error: "Reaper is not configured" },
      { status: 503 }
    );
  }

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the env var is
  // set on the project. Manual invocations use the same header.
  const header = req.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function reap() {
  const serviceClient = await createServiceClient();
  const cutoff = new Date(Date.now() - STALE_CLAIM_SECONDS * 1000).toISOString();

  // `updated_at` is maintained by the documents_updated_at trigger and is
  // bumped by the claim itself, so it is a reliable second bound. The `.or()`
  // also catches legacy rows with a NULL *_started_at (NULL never matches `<`).
  const { data: generation, error: generationError } = await serviceClient
    .from("documents")
    .update({
      generation_status: "failed",
      generation_error: STALLED_GENERATION_MESSAGE,
    })
    .eq("generation_status", "generating")
    .lt("updated_at", cutoff)
    .or(`generation_started_at.lt.${cutoff},generation_started_at.is.null`)
    .select("id");

  if (generationError) {
    console.error("[reap-stale-jobs] generation sweep failed:", generationError);
  }

  const { data: ocr, error: ocrError } = await serviceClient
    .from("documents")
    .update({ ocr_status: "failed", ocr_error: STALLED_OCR_MESSAGE })
    .eq("ocr_status", "processing")
    .lt("updated_at", cutoff)
    .or(`ocr_started_at.lt.${cutoff},ocr_started_at.is.null`)
    .select("id");

  if (ocrError) {
    console.error("[reap-stale-jobs] ocr sweep failed:", ocrError);
  }

  const generationIds = (generation ?? []).map((r) => r.id as string);
  const ocrIds = (ocr ?? []).map((r) => r.id as string);

  if (generationIds.length || ocrIds.length) {
    console.warn(
      `[reap-stale-jobs] reaped ${generationIds.length} generation + ${ocrIds.length} ocr rows stuck since before ${cutoff}`
    );
  }

  return {
    cutoff,
    staleSeconds: STALE_CLAIM_SECONDS,
    generationReaped: generationIds.length,
    ocrReaped: ocrIds.length,
    generationIds,
    ocrIds,
    errors: [generationError?.message, ocrError?.message].filter(Boolean),
  };
}

export async function GET(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;
  return NextResponse.json(await reap());
}

// Vercel Cron issues GET; POST is here for manual/ops invocation.
export async function POST(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;
  return NextResponse.json(await reap());
}
