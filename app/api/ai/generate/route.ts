import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

type DocumentType =
  | "stage1_request"
  | "stage1_lomn"
  | "stage2_appeal"
  | "stage3_hearing"
  | "stage3_memo";

const STAGE_MAP: Record<DocumentType, number> = {
  stage1_request: 1,
  stage1_lomn: 1,
  stage2_appeal: 2,
  stage3_hearing: 3,
  stage3_memo: 3,
};

const NAME_MAP: Record<DocumentType, string> = {
  stage1_request: "Request for Increase in Plan of Care",
  stage1_lomn: "LOMN Request Template (for your Doctor)",
  stage2_appeal: "Internal Appeal Letter",
  stage3_hearing: "Fair Hearing Request",
  stage3_memo: "Memo of Law",
};

// Helper to find OCR text from uploaded docs
function findOcrText(
  docs: Document[],
  ...keywords: string[]
): string | undefined {
  for (const doc of docs) {
    if (!doc.ocr_text) continue;
    const name = doc.name.toLowerCase();
    if (keywords.some((kw) => name.includes(kw.toLowerCase()))) {
      return doc.ocr_text;
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { caseId, documentType } = (await req.json()) as {
      caseId: string;
      documentType: DocumentType;
    };

    if (!caseId || !documentType) {
      return NextResponse.json(
        { error: "caseId and documentType are required" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Fetch case and intake data
    const { data: caseData, error: caseError } = await serviceClient
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const { data: intake, error: intakeError } = await serviceClient
      .from("intake_data")
      .select("*")
      .eq("case_id", caseId)
      .single();

    if (intakeError || !intake) {
      return NextResponse.json(
        { error: "Intake data not found" },
        { status: 404 }
      );
    }

    // Fetch all documents for this case (needed for OCR text)
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
        if (!iadText) {
          return NextResponse.json(
            { error: "IAD OCR text not found. Upload and process the IAD first." },
            { status: 400 }
          );
        }
        const lomnText = findOcrText(docs, "lomn", "medical necessity");
        systemPrompt = STAGE2_APPEAL_SYSTEM_PROMPT;
        userPrompt = buildStage2AppealPrompt(typedCase, typedIntake, iadText, lomnText);
        break;
      }

      case "stage3_hearing": {
        const fadText = findOcrText(docs, "fad", "final adverse");
        if (!fadText) {
          return NextResponse.json(
            { error: "FAD OCR text not found. Upload and process the FAD first." },
            { status: 400 }
          );
        }
        systemPrompt = STAGE3_HEARING_SYSTEM_PROMPT;
        userPrompt = buildStage3HearingPrompt(typedCase, typedIntake, fadText);
        break;
      }

      case "stage3_memo": {
        const fadText2 = findOcrText(docs, "fad", "final adverse");
        const uasText = findOcrText(docs, "uas", "evidence package", "universal assessment");
        if (!fadText2 || !uasText) {
          return NextResponse.json(
            { error: "FAD and UAS OCR text required. Upload and process both first." },
            { status: 400 }
          );
        }
        const lomnText2 = findOcrText(docs, "lomn", "medical necessity");
        systemPrompt = STAGE3_MEMO_SYSTEM_PROMPT;
        userPrompt = buildStage3MemoPrompt(typedCase, typedIntake, fadText2, uasText, lomnText2);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown document type: ${documentType}` },
          { status: 400 }
        );
    }

    const stageNum = STAGE_MAP[documentType];
    const docName = NAME_MAP[documentType];

    // Generate the document
    const content = await generateDocument(systemPrompt, userPrompt);

    // Save to documents table
    const { data: doc, error: docError } = await serviceClient
      .from("documents")
      .insert({
        case_id: caseId,
        name: docName,
        type: "generated",
        stage: stageNum,
        status: "review_needed",
        format: "letter",
        content,
        version: 1,
      })
      .select()
      .single();

    if (docError) {
      console.error("Document save error:", docError);
      return NextResponse.json(
        { error: "Failed to save document" },
        { status: 500 }
      );
    }

    // Create initial version entry
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

    // Create billing record for new stages
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

    return NextResponse.json({
      message: "Document generated",
      documentId: doc.id,
      name: docName,
    });
  } catch (err) {
    console.error("Generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate document" },
      { status: 500 }
    );
  }
}
