import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runDocumentGeneration,
  type DocumentType,
  STAGE_MAP,
} from "@/lib/document-generation";
import { checkStagePaid } from "@/lib/billing/guard";
import { describeAiError } from "@/lib/ai-errors";

// Explicit function limit. lib/openrouter.ts budgets its attempts to finish
// inside this, so we return a real error instead of being killed mid-claim.
// NOTE: Next.js requires route segment config to be a static literal, so this
// cannot reference AI_MAX_DURATION_SECONDS directly — keep the two in sync.
// 300s is the ceiling on the project's Vercel Pro plan.
export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { caseId, documentType, documentId } = (await req.json()) as {
    caseId: string;
    documentType: DocumentType;
    documentId: string;
  };

  if (!caseId || !documentType || !documentId) {
    return NextResponse.json(
      { error: "caseId, documentType, and documentId are required" },
      { status: 400 }
    );
  }

  const stage = STAGE_MAP[documentType];
  if (!stage) {
    return NextResponse.json(
      { error: `Unknown documentType: ${documentType}` },
      { status: 400 }
    );
  }

  // NB: a 402 from here is the app's own unpaid-stage gate, NOT an OpenRouter
  // credits problem. The two are kept apart by `errorCode` below, which is only
  // ever set from a tagged provider error.
  const gate = await checkStagePaid(supabase, caseId, stage);
  if (!gate.ok) return gate.response;

  const outcome = await runDocumentGeneration({
    caseId,
    documentType,
    documentId,
  });

  switch (outcome.status) {
    case "ready":
    case "already_ready":
      return NextResponse.json({ message: "Document generated", documentId });

    case "not_found":
      return NextResponse.json({ error: "Document not found" }, { status: 404 });

    case "in_flight":
      // Previously this path re-read the row, saw 'generating', and returned
      // 200 "Document generated" — the user got success plus an eternal
      // spinner. 409 is the truth: another attempt holds the claim.
      return NextResponse.json(
        {
          error:
            "This document is already being generated. It should finish shortly — if it doesn't, try again in a few minutes.",
          errorCode: "in_flight",
        },
        { status: 409 }
      );

    case "failed": {
      // Map the raw provider error to friendly copy — the raw text (which can
      // include billing/credit details) stays in the DB for staff only.
      // `errorCode` lets the client branch (e.g. open the credits modal).
      const info = describeAiError(outcome.error);
      return NextResponse.json(
        { error: info.message, errorCode: info.code, errorTitle: info.title },
        { status: 500 }
      );
    }
  }
}
