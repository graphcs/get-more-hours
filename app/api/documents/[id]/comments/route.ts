import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { commentSchema } from "@/lib/validations";
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

  const { data: comments, error } = await supabase
    .from("document_comments")
    .select("*, author:profiles(id, name, role)")
    .eq("document_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Comments fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }

  return NextResponse.json({ comments: comments || [] });
}

export async function POST(
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

  const parsed = commentSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("case_id, stage")
    .eq("id", id)
    .single();

  if (docErr || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const gate = await checkStagePaid(supabase, doc.case_id, doc.stage);
  if (!gate.ok) return gate.response;

  const { data: comment, error } = await supabase
    .from("document_comments")
    .insert({
      document_id: id,
      author_id: user.id,
      text: parsed.data.text,
    })
    .select("*, author:profiles(id, name, role)")
    .single();

  if (error) {
    console.error("Comment create error:", error);
    return NextResponse.json(
      { error: "Failed to post comment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ comment }, { status: 201 });
}
