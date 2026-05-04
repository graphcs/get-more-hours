import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { documentUpdateSchema } from "@/lib/validations";
import { checkStagePaid } from "@/lib/billing/guard";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
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

  // Fetch versions
  const { data: versions } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", id)
    .order("version", { ascending: false });

  return NextResponse.json({
    document,
    versions: versions || [],
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = documentUpdateSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Fetch current document
  const { data: document, error: fetchError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const gate = await checkStagePaid(supabase, document.case_id, document.stage);
  if (!gate.ok) return gate.response;

  const updates: Record<string, unknown> = {};

  // Update content (letter edit)
  if (parsed.data.content !== undefined) {
    const newVersion = document.version + 1;
    updates.content = parsed.data.content;
    updates.version = newVersion;

    // Get user profile for author name
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();

    // Create version entry
    await supabase.from("document_versions").insert({
      document_id: id,
      version: newVersion,
      content: parsed.data.content,
      author: profile?.name || "User",
      note: parsed.data.note || "Manual edit",
    });
  }

  // Update status
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
  }

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("Document update error:", updateError);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }

  return NextResponse.json({ document: updated });
}
