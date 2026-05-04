import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkStagePaid } from "@/lib/billing/guard";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS (clients_own_documents / admin_all_documents) enforces access.
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (docErr || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const gate = await checkStagePaid(supabase, doc.case_id, doc.stage);
  if (!gate.ok) return gate.response;

  const { data: target, error: verErr } = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", versionId)
    .eq("document_id", id)
    .single();

  if (verErr || !target) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const newVersion = doc.version + 1;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();

  const { error: insErr } = await supabase.from("document_versions").insert({
    document_id: id,
    version: newVersion,
    content: target.content,
    author: profile?.name || "User",
    note: `Restored from v${target.version}`,
  });

  if (insErr) {
    console.error("Version insert error:", insErr);
    return NextResponse.json(
      { error: "Failed to record restore" },
      { status: 500 }
    );
  }

  const { data: updated, error: updErr } = await supabase
    .from("documents")
    .update({ content: target.content, version: newVersion })
    .eq("id", id)
    .select()
    .single();

  if (updErr) {
    console.error("Document update error:", updErr);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }

  return NextResponse.json({ document: updated });
}
