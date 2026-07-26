import { after, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  NAME_MAP,
  STAGE_MAP,
  runDocumentGeneration,
  type DocumentType,
} from "@/lib/document-generation";
import { checkStagePaid } from "@/lib/billing/guard";
import { ensureStageFeeRow } from "@/lib/billing/stage-payment";
import { getAiSystemPrompt } from "@/lib/prompts";
import { extractTextFromImage } from "@/lib/openrouter";
import { describeAiError } from "@/lib/ai-errors";

// This route used to build its own OpenAI client with neither `timeout` nor
// `maxRetries`, so it silently ran on the SDK defaults (10 min / 2 retries)
// while generation ran on 90s / 0 retries. Both now share the single
// configured client in lib/openrouter.ts, budgeted to finish inside
// maxDuration.
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

  const { documentId } = await req.json();

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();

  // Fetch BEFORE claiming. The old order flipped ocr_status to 'processing'
  // first, so the "document not found" early-return below left the row
  // 'processing' forever with no catch to clean it up — and doc-viewer's
  // isNonTerminal() polled on it indefinitely.
  const { data: doc, error: docError } = await serviceClient
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Claim only once we know the row exists. ocr_started_at lets the reaper
  // (app/api/cron/reap-stale-jobs) recover this row if the function is killed.
  await serviceClient
    .from("documents")
    .update({
      ocr_status: "processing",
      ocr_error: null,
      ocr_started_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  try {
    if (!doc.storage_path) {
      throw new Error("No file to process");
    }

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || "unknown"}`);
    }

    // Convert to base64 for the vision model
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const mimeType = doc.format === "pdf" ? "application/pdf" : "image/jpeg";
    const extractionPrompt = await getAiSystemPrompt(
      serviceClient,
      "ocr_extraction"
    );

    // Send to vision model for OCR (bounded retries + budget, see openrouter.ts)
    const ocrText = await extractTextFromImage({
      prompt: extractionPrompt,
      dataUrl: `data:${mimeType};base64,${base64}`,
    });

    // Save OCR text to document
    await serviceClient
      .from("documents")
      .update({ ocr_text: ocrText, ocr_status: "ready" })
      .eq("id", documentId);

    // Check if this upload should trigger AI generation
    await checkAndTriggerGeneration(serviceClient, doc);

    return NextResponse.json({
      message: "OCR complete",
      documentId,
      textLength: ocrText.length,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "OCR failed";
    await serviceClient
      .from("documents")
      .update({ ocr_status: "failed", ocr_error: raw })
      .eq("id", documentId);
    console.error("OCR error:", err);
    // Friendly copy + a machine code so the client can branch (credits modal).
    const info = describeAiError(raw);
    return NextResponse.json(
      { error: info.message, errorCode: info.code, errorTitle: info.title },
      { status: 500 }
    );
  }
}

async function checkAndTriggerGeneration(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  doc: Record<string, unknown>
) {
  const caseId = doc.case_id as string;
  const docName = (doc.name as string).toLowerCase();

  // Always create the placeholder + advance the case stage + make sure the
  // stage's fee row exists so the client is actually asked to pay. Only
  // schedule runDocumentGeneration if the stage fee is already paid; otherwise
  // markStagePaid's triggerStageGeneration picks up the pending placeholder
  // once payment (or an admin comp) lands.
  const prepareStage = async (
    documentType: DocumentType,
    stageNum: number
  ) => {
    await serviceClient
      .from("cases")
      .update({ current_stage: stageNum, stage_status: "in_progress" })
      .eq("id", caseId);

    await ensureStageFeeRow(serviceClient, caseId, stageNum);

    const documentId = await ensurePlaceholderDocument(
      serviceClient,
      caseId,
      documentType
    );
    if (!documentId) return;

    const gate = await checkStagePaid(serviceClient, caseId, stageNum);
    if (!gate.ok) return;

    after(() =>
      runDocumentGeneration({ caseId, documentType, documentId })
    );
  };

  // IAD uploaded → advance to Stage 2 + (if paid) generate appeal.
  if (
    docName.includes("initial adverse") ||
    docName.includes("iad")
  ) {
    await prepareStage("stage2_appeal", 2);
  }

  // FAD uploaded → advance to Stage 3 + (if paid) generate hearing request.
  if (
    docName.includes("final adverse") ||
    docName.includes("fad")
  ) {
    await prepareStage("stage3_hearing", 3);
  }

  // UAS uploaded → create Memo of Law placeholder if the case is at Stage 3,
  // and schedule generation only if Stage 3 is paid. UAS by itself doesn't
  // advance the case. Since FAD now advances unconditionally, current_stage===3
  // no longer implies paid — we explicitly gate on checkStagePaid.
  if (docName.includes("uas") || docName.includes("evidence package")) {
    const { data: caseData } = await serviceClient
      .from("cases")
      .select("current_stage")
      .eq("id", caseId)
      .single();

    if (caseData?.current_stage === 3) {
      const documentId = await ensurePlaceholderDocument(
        serviceClient,
        caseId,
        "stage3_memo"
      );
      if (!documentId) return;

      const gate = await checkStagePaid(serviceClient, caseId, 3);
      if (!gate.ok) return;

      after(() =>
        runDocumentGeneration({
          caseId,
          documentType: "stage3_memo",
          documentId,
        })
      );
    }
  }
}

// Returns the id of the placeholder generated document for this (caseId, documentType),
// inserting one if it doesn't yet exist. Returns null if generation should be skipped
// (e.g. the document is already 'ready' — manual retry is the path to regenerate).
async function ensurePlaceholderDocument(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  caseId: string,
  documentType: DocumentType
): Promise<string | null> {
  const name = NAME_MAP[documentType];
  const stage = STAGE_MAP[documentType];

  const { data: existing } = await serviceClient
    .from("documents")
    .select("id, generation_status")
    .eq("case_id", caseId)
    .eq("type", "generated")
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    if (existing.generation_status === "ready") return null;
    return existing.id as string;
  }

  const { data: inserted, error: insertError } = await serviceClient
    .from("documents")
    .insert({
      case_id: caseId,
      name,
      type: "generated",
      stage,
      status: "pending",
      format: "letter",
      version: 1,
      generation_status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error(
      `Failed to create placeholder document for ${documentType}:`,
      insertError
    );
    return null;
  }

  return inserted.id as string;
}
