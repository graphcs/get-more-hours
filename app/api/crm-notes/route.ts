import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get("caseId");

  if (!caseId) {
    return NextResponse.json(
      { error: "caseId is required" },
      { status: 400 }
    );
  }

  const { data: notes, error } = await supabase
    .from("crm_notes")
    .select("*, author:profiles(id, name)")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }

  return NextResponse.json({ notes: notes || [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { caseId, text } = await req.json();

  if (!caseId || !text?.trim()) {
    return NextResponse.json(
      { error: "caseId and text are required" },
      { status: 400 }
    );
  }

  const { data: note, error } = await supabase
    .from("crm_notes")
    .insert({
      case_id: caseId,
      author_id: user.id,
      text: text.trim(),
    })
    .select("*, author:profiles(id, name)")
    .single();

  if (error) {
    console.error("CRM note error:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }

  return NextResponse.json({ note }, { status: 201 });
}
