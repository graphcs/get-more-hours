import { createServiceClient } from "@/lib/supabase/server";
import { generateDocument } from "@/lib/openrouter";
import {
  getAiSystemPrompt,
  buildStage1RequestPrompt,
  buildStage1LomnPrompt,
  buildStage2AppealPrompt,
  buildStage3HearingPrompt,
  buildStage3MemoPrompt,
} from "@/lib/prompts";
import { STALE_CLAIM_SECONDS } from "@/lib/ai-limits";
import type { Case, IntakeData, Document } from "@/types";

/**
 * Result of one runDocumentGeneration call. Callers that fire-and-forget via
 * `after()` ignore it; POST /api/ai/generate uses it to pick an HTTP status
 * instead of blindly re-reading the row and reporting success.
 */
export type GenerationOutcome =
  | { status: "ready"; documentId: string }
  | { status: "failed"; documentId: string; error: string }
  /** A live generation already holds the claim. */
  | { status: "in_flight"; documentId: string }
  | { status: "already_ready"; documentId: string }
  | { status: "not_found"; documentId: string };

export type DocumentType =
  | "stage1_request"
  | "stage1_lomn"
  | "stage2_appeal"
  | "stage3_hearing"
  | "stage3_memo";

export const STAGE_MAP: Record<DocumentType, number> = {
  stage1_request: 1,
  stage1_lomn: 1,
  stage2_appeal: 2,
  stage3_hearing: 3,
  stage3_memo: 3,
};

export const NAME_MAP: Record<DocumentType, string> = {
  stage1_request: "Request for Increase in Plan of Care",
  stage1_lomn: "LOMN Request Template (for your Doctor)",
  stage2_appeal: "Internal Appeal Letter",
  stage3_hearing: "Fair Hearing Request",
  stage3_memo: "Memo of Law",
};

function findOcrText(docs: Document[], ...keywords: string[]): string | undefined {
  for (const doc of docs) {
    if (!doc.ocr_text) continue;
    const name = doc.name.toLowerCase();
    if (keywords.some((kw) => name.includes(kw.toLowerCase()))) {
      return doc.ocr_text;
    }
  }
  return undefined;
}

export async function runDocumentGeneration({
  caseId,
  documentType,
  documentId,
}: {
  caseId: string;
  documentType: DocumentType;
  documentId: string;
}): Promise<GenerationOutcome> {
  const serviceClient = await createServiceClient();

  // Atomic claim via RPC (migration 017). The claim succeeds when the row is
  // pending / failed / unset, OR when it is stuck in 'generating' past
  // STALE_CLAIM_SECONDS — the previous worker is then presumed dead.
  //
  // The old code filtered `.in('generation_status', ['pending','failed'])`,
  // which meant a row whose worker was killed mid-flight (function timeout,
  // deploy, cold kill) could NEVER be claimed again. The Supabase JS client
  // can't express the staleness OR-condition in one filter, hence the RPC —
  // and it must stay one statement so concurrent callers serialise on the
  // row lock rather than both claiming.
  const { data: claimed, error: claimErr } = await serviceClient.rpc(
    "claim_document_generation",
    { doc_id: documentId, stale_seconds: STALE_CLAIM_SECONDS }
  );

  if (claimErr) {
    console.error("[document-generation] claim failed:", claimErr);
    throw claimErr;
  }

  const claimRows = (claimed ?? []) as { document_id: string; reclaimed: boolean }[];
  if (claimRows.length === 0) {
    return describeRefusedClaim(serviceClient, documentId);
  }
  if (claimRows[0]?.reclaimed) {
    console.warn(
      `[document-generation] reclaimed stale 'generating' row ${documentId}`
    );
  }

  try {
    const { data: caseData, error: caseError } = await serviceClient
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();
    if (!caseData) {
      console.error("[document-generation] case query failed:", caseError, "caseId:", caseId);
      throw new Error(`Case not found: ${caseError?.message ?? "unknown"}`);
    }

    const { data: intake, error: intakeError } = await serviceClient
      .from("intake_data")
      .select("*")
      .eq("case_id", caseId)
      .single();
    if (!intake) {
      console.error("[document-generation] intake query failed:", intakeError, "caseId:", caseId);
      throw new Error(`Intake data not found: ${intakeError?.message ?? "unknown"}`);
    }

    const { data: allDocs } = await serviceClient
      .from("documents")
      .select("*")
      .eq("case_id", caseId);

    const typedCase = caseData as Case;
    const typedIntake = intake as IntakeData;
    const docs = (allDocs || []) as Document[];

    let systemPrompt: string;
    let userPrompt: string;

    switch (documentType) {
      case "stage1_request":
        systemPrompt = await getAiSystemPrompt(serviceClient, "stage1_request_system");
        userPrompt = buildStage1RequestPrompt(typedCase, typedIntake);
        break;

      case "stage1_lomn":
        systemPrompt = await getAiSystemPrompt(serviceClient, "stage1_lomn_system");
        userPrompt = buildStage1LomnPrompt(typedCase, typedIntake);
        break;

      case "stage2_appeal": {
        const iadText = findOcrText(docs, "iad", "initial adverse", "adverse determination");
        if (!iadText) throw new Error("IAD OCR text not found. Upload and process the IAD first.");
        const lomnText = findOcrText(docs, "lomn", "medical necessity");
        systemPrompt = await getAiSystemPrompt(serviceClient, "stage2_appeal_system");
        userPrompt = buildStage2AppealPrompt(typedCase, typedIntake, iadText, lomnText);
        break;
      }

      case "stage3_hearing": {
        const fadText = findOcrText(docs, "fad", "final adverse");
        if (!fadText) throw new Error("FAD OCR text not found. Upload and process the FAD first.");
        systemPrompt = await getAiSystemPrompt(serviceClient, "stage3_hearing_system");
        userPrompt = buildStage3HearingPrompt(typedCase, typedIntake, fadText);
        break;
      }

      case "stage3_memo": {
        const fadText2 = findOcrText(docs, "fad", "final adverse");
        const uasText = findOcrText(docs, "uas", "evidence package", "universal assessment");
        if (!fadText2 || !uasText) {
          throw new Error("FAD and UAS OCR text required. Upload and process both first.");
        }
        const lomnText2 = findOcrText(docs, "lomn", "medical necessity");
        systemPrompt = await getAiSystemPrompt(serviceClient, "stage3_memo_system");
        userPrompt = buildStage3MemoPrompt(typedCase, typedIntake, fadText2, uasText, lomnText2);
        break;
      }

      default:
        throw new Error(`Unknown document type: ${documentType}`);
    }

    const content = await generateDocument(systemPrompt, userPrompt);

    const { data: doc, error: updateError } = await serviceClient
      .from("documents")
      .update({
        content,
        status: "review_needed",
        generation_status: "ready",
        generation_error: null,
      })
      .eq("id", documentId)
      .select()
      .single();

    if (updateError || !doc) throw updateError ?? new Error("Failed to save document");

    await serviceClient.from("document_versions").insert({
      document_id: doc.id,
      version: 1,
      content,
      author: "AI Generated",
      note: `Initial draft generated from case data${
        documentType.startsWith("stage2") ? " and IAD analysis" :
        documentType === "stage3_memo" ? " and UAS/FAD analysis" :
        documentType === "stage3_hearing" ? " and FAD" : ""
      }`,
    });

    // NOTE: the stage 2/3 `pending` fee row used to be created here, with the
    // cent amounts hardcoded a second time. That was circular — generation is
    // gated on the fee being paid, but the row that prompts the client to pay
    // was only written by generation, so a self-serve client never saw a stage
    // 2/3 fee at all. The row is now created when the stage becomes reachable,
    // via ensureStageFeeRow() in lib/billing/stage-payment.ts (called from
    // intake, from markStagePaid, and from the OCR stage-advance path), and the
    // amounts come from PRICING in lib/constants.ts.

    return { status: "ready", documentId };
  } catch (err) {
    console.error(`[document-generation] ${documentType} failed:`, err);
    // AiProviderError messages already carry an `[ai:<code>]` tag; anything
    // else is stored raw and classified heuristically at the display boundary.
    const raw = err instanceof Error ? err.message : "Generation failed";
    await serviceClient
      .from("documents")
      .update({ generation_status: "failed", generation_error: raw })
      .eq("id", documentId);
    return { status: "failed", documentId, error: raw };
  }
}

/**
 * The claim was refused. Distinguish "someone else is actively working on it"
 * (retry later) from "already finished" (nothing to do) from "gone", so the
 * API route can return an honest status code instead of a blanket 200.
 */
async function describeRefusedClaim(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  documentId: string
): Promise<GenerationOutcome> {
  const { data: row } = await serviceClient
    .from("documents")
    .select("generation_status")
    .eq("id", documentId)
    .maybeSingle();

  if (!row) return { status: "not_found", documentId };
  if (row.generation_status === "ready") {
    return { status: "already_ready", documentId };
  }
  console.log(
    `[document-generation] skipping ${documentId} — generation already in flight`
  );
  return { status: "in_flight", documentId };
}
