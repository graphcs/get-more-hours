import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkStagePaid } from "@/lib/billing/guard";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const caseId = formData.get("caseId") as string | null;
    const documentName = formData.get("documentName") as string | null;
    const stage = formData.get("stage") as string | null;

    if (!file || !caseId || !documentName || !stage) {
      return NextResponse.json(
        { error: "file, caseId, documentName, and stage are required" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF and image files are allowed" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Verify case belongs to user
    const { data: caseData, error: caseError } = await serviceClient
      .from("cases")
      .select("id, user_id")
      .eq("id", caseId)
      .single();

    if (caseError || !caseData || caseData.user_id !== user.id) {
      return NextResponse.json(
        { error: "Case not found or unauthorized" },
        { status: 403 }
      );
    }

    const stageNum = parseInt(stage, 10);
    const gate = await checkStagePaid(serviceClient, caseId, stageNum);
    if (!gate.ok) return gate.response;

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "pdf";
    const storagePath = `${caseId}/${Date.now()}-${file.name}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Determine format
    const format = file.type === "application/pdf" ? "pdf" : "image";

    // Create document record
    const { data: doc, error: docError } = await serviceClient
      .from("documents")
      .insert({
        case_id: caseId,
        name: documentName,
        type: "uploaded",
        stage: stageNum,
        status: "uploaded",
        format,
        storage_path: storagePath,
        version: 1,
        ocr_status: "pending",
      })
      .select()
      .single();

    if (docError) {
      console.error("Document record error:", docError);
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    // Create version entry
    await serviceClient.from("document_versions").insert({
      document_id: doc.id,
      version: 1,
      author: user.user_metadata?.full_name || "User",
      note: `Uploaded ${file.name}`,
    });

    // Trigger OCR in the background for PDFs and images
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    fetch(`${baseUrl}/api/ai/ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.get("cookie") || "",
      },
      body: JSON.stringify({ documentId: doc.id }),
    }).catch((err) => console.error("OCR trigger error:", err));

    return NextResponse.json(
      {
        message: "File uploaded successfully",
        document: doc,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
