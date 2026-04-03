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

  const { text } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json(
      { error: "Comment text is required" },
      { status: 400 }
    );
  }

  const { data: comment, error } = await supabase
    .from("document_comments")
    .insert({
      document_id: id,
      author_id: user.id,
      text: text.trim(),
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
