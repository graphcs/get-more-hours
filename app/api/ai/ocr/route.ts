import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const OCR_MODEL =
  process.env.OPENROUTER_OCR_MODEL || "google/gemini-2.0-flash-001";

export async function POST(req: Request) {
  try {
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
      return NextResponse.json(
        { error: "No file to process" },
        { status: 400 }
      );
    }

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      console.error("File download error:", downloadError);
      return NextResponse.json(
        { error: "Failed to download file" },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: "OCR failed to extract text" },
        { status: 500 }
      );
    }

    // Save OCR text to document
    await serviceClient
      .from("documents")
      .update({ ocr_text: ocrText })
      .eq("id", documentId);

    // Check if this upload should trigger AI generation
    await checkAndTriggerGeneration(serviceClient, doc, req);

    return NextResponse.json({
      message: "OCR complete",
      documentId,
      textLength: ocrText.length,
    });
  } catch (err) {
    console.error("OCR error:", err);
    return NextResponse.json(
      { error: "OCR processing failed" },
      { status: 500 }
    );
  }
}

async function checkAndTriggerGeneration(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  doc: Record<string, unknown>,
  req: Request
) {
  const caseId = doc.case_id as string;
  const docName = (doc.name as string).toLowerCase();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cookie = req.headers.get("cookie") || "";

  const triggerGeneration = (documentType: string) =>
    fetch(`${baseUrl}/api/ai/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ caseId, documentType }),
    }).catch((err) =>
      console.error(`Generation trigger error (${documentType}):`, err)
    );

  // IAD uploaded → generate Stage 2 appeal + advance case
  if (
    docName.includes("initial adverse") ||
    docName.includes("iad")
  ) {
    await serviceClient
      .from("cases")
      .update({ current_stage: 2, stage_status: "in_progress" })
      .eq("id", caseId);

    await triggerGeneration("stage2_appeal");
  }

  // FAD uploaded → generate Stage 3 hearing request + advance case
  if (
    docName.includes("final adverse") ||
    docName.includes("fad")
  ) {
    await serviceClient
      .from("cases")
      .update({ current_stage: 3, stage_status: "in_progress" })
      .eq("id", caseId);

    await triggerGeneration("stage3_hearing");
  }

  // UAS uploaded → generate Memo of Law (only if already at Stage 3)
  if (docName.includes("uas") || docName.includes("evidence package")) {
    const { data: caseData } = await serviceClient
      .from("cases")
      .select("current_stage")
      .eq("id", caseId)
      .single();

    if (caseData?.current_stage === 3) {
      await triggerGeneration("stage3_memo");
    }
  }
}
