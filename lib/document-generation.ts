import { createServiceClient } from "@/lib/supabase/server";
import { generateDocument } from "@/lib/openrouter";
import {
  STAGE1_REQUEST_SYSTEM_PROMPT,
  buildStage1RequestPrompt,
  STAGE1_LOMN_SYSTEM_PROMPT,
  buildStage1LomnPrompt,
  STAGE2_APPEAL_SYSTEM_PROMPT,
  buildStage2AppealPrompt,
  STAGE3_HEARING_SYSTEM_PROMPT,
  buildStage3HearingPrompt,
  STAGE3_MEMO_SYSTEM_PROMPT,
  buildStage3MemoPrompt,
} from "@/lib/prompts";
import type { Case, IntakeData, Document } from "@/types";

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
}): Promise<void> {
  const serviceClient = await createServiceClient();

  // Atomic claim: only proceed if the row was previously pending or failed.
  // Postgres row-locks per UPDATE, so two concurrent invocations cannot both
  // pass this filter — one returns 1 row, the other returns 0.
  const { data: claimed, error: claimErr } = await serviceClient
    .from("documents")
    .update({ generation_status: "generating", generation_error: null })
    .eq("id", documentId)
    .in("generation_status", ["pending", "failed"])
    .select("id");

  if (claimErr) {
    console.error("[document-generation] claim failed:", claimErr);
    throw claimErr;
  }
  if (!claimed || claimed.length === 0) {
    console.log(
      `[document-generation] skipping ${documentId} — already generating or ready`
    );
    return;
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
        systemPrompt = STAGE1_REQUEST_SYSTEM_PROMPT;
        userPrompt = buildStage1RequestPrompt(typedCase, typedIntake);
        break;

      case "stage1_lomn":
        systemPrompt = STAGE1_LOMN_SYSTEM_PROMPT;
        userPrompt = buildStage1LomnPrompt(typedCase, typedIntake);
        break;

      case "stage2_appeal": {
        const iadText = findOcrText(docs, "iad", "initial adverse", "adverse determination");
        if (!iadText) throw new Error("IAD OCR text not found. Upload and process the IAD first.");
        const lomnText = findOcrText(docs, "lomn", "medical necessity");
        systemPrompt = STAGE2_APPEAL_SYSTEM_PROMPT;
        userPrompt = buildStage2AppealPrompt(typedCase, typedIntake, iadText, lomnText);
        break;
      }

      case "stage3_hearing": {
        const fadText = findOcrText(docs, "fad", "final adverse");
        if (!fadText) throw new Error("FAD OCR text not found. Upload and process the FAD first.");
        systemPrompt = STAGE3_HEARING_SYSTEM_PROMPT;
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
        systemPrompt = STAGE3_MEMO_SYSTEM_PROMPT;
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

    if (documentType === "stage2_appeal") {
      await serviceClient.from("billing").insert({
        case_id: caseId,
        stage: 2,
        amount: 14900,
        type: "stage_fee",
        status: "pending",
      });
    } else if (documentType === "stage3_hearing") {
      await serviceClient.from("billing").insert({
        case_id: caseId,
        stage: 3,
        amount: 29900,
        type: "stage_fee",
        status: "pending",
      });
    }
  } catch (err) {
    console.error(`[document-generation] ${documentType} failed:`, err);
    const msg = err instanceof Error ? err.message : "Generation failed";
    await serviceClient
      .from("documents")
      .update({ generation_status: "failed", generation_error: msg })
      .eq("id", documentId);
  }
}
