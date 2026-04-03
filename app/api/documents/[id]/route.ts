import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const body = await req.json();

  // Fetch current document
  const { data: document, error: fetchError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  // Update content (letter edit)
  if (body.content !== undefined) {
    const newVersion = document.version + 1;
    updates.content = body.content;
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
      content: body.content,
      author: profile?.name || "User",
      note: body.note || "Manual edit",
    });
  }

  // Update status
  if (body.status !== undefined) {
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
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
