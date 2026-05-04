import { after, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import {
  NAME_MAP,
  STAGE_MAP,
  runDocumentGeneration,
  type DocumentType,
} from "@/lib/document-generation";
import { checkStagePaid } from "@/lib/billing/guard";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const OCR_MODEL =
  process.env.OPENROUTER_OCR_MODEL || "google/gemini-2.0-flash-001";

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

  await serviceClient
    .from("documents")
    .update({ ocr_status: "processing", ocr_error: null })
    .eq("id", documentId);

  try {
    // Fetch document
    const { data: doc, error: docError } = await serviceClient
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

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

    // Send to vision model for OCR
    const response = await openai.chat.completions.create({
      model: OCR_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this document. Preserve the structure, headings, and formatting as closely as possible. Return only the extracted text, no commentary.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 8000,
    });

    const ocrText = response.choices[0]?.message?.content;

    if (!ocrText) {
      throw new Error("OCR failed to extract text");
    }

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
    const msg = err instanceof Error ? err.message : "OCR failed";
    await serviceClient
      .from("documents")
      .update({ ocr_status: "failed", ocr_error: msg })
      .eq("id", documentId);
    console.error("OCR error:", err);
    return NextResponse.json(
      { error: "OCR processing failed" },
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

  // Always create the placeholder + advance the case stage. Only schedule
  // runDocumentGeneration if the stage fee is paid; otherwise the Stripe
  // webhook's triggerStageGeneration will pick up the pending placeholder
  // once payment lands.
  const prepareStage = async (
    documentType: DocumentType,
    stageNum: number
  ) => {
    await serviceClient
      .from("cases")
      .update({ current_stage: stageNum, stage_status: "in_progress" })
      .eq("id", caseId);

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
