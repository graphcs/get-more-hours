import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { LetterPdfDocument } from "@/lib/pdf/letter-pdf";

export const runtime = "nodejs";

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_. ]/gi, "_").slice(0, 120) || "letter";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (document.format !== "letter" || !document.content) {
    return NextResponse.json(
      { error: "No letter content available for this document" },
      { status: 400 },
    );
  }

  const createdAt = new Date(document.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const buffer = await renderToBuffer(
    LetterPdfDocument({
      content: document.content,
      title: document.name,
      subtitle: `${createdAt} · v${document.version}`,
    }),
  );

  const disposition =
    new URL(req.url).searchParams.get("mode") === "inline"
      ? "inline"
      : "attachment";

  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/pdf",
  });

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${safeFilename(document.name)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
