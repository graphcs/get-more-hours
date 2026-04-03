import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Basic validation
    if (!body.firstName || !body.lastName || !body.mltc) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!body.currentHours || !body.currentDays || !body.requestedHours || !body.requestedDays) {
      return NextResponse.json(
        { error: "Hours and days are required" },
        { status: 400 }
      );
    }

    if (!body.changeDescription) {
      return NextResponse.json(
        { error: "Please describe what has changed recently" },
        { status: 400 }
      );
    }

    // Check if user already has a case
    const { data: existingCase } = await supabase
      .from("cases")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (existingCase) {
      return NextResponse.json(
        { error: "You already have an active case" },
        { status: 409 }
      );
    }

    // Create the case
    const { data: newCase, error: caseError } = await supabase
      .from("cases")
      .insert({
        user_id: user.id,
        mltc: body.mltc,
        current_hours: Number(body.currentHours),
        current_days: Number(body.currentDays),
        requested_hours: Number(body.requestedHours),
        requested_days: Number(body.requestedDays),
        current_stage: 1,
        stage_status: "in_progress",
      })
      .select()
      .single();

    if (caseError) {
      console.error("Case creation error:", caseError);
      return NextResponse.json(
        { error: "Failed to create case" },
        { status: 500 }
      );
    }

    // Create intake data
    const { error: intakeError } = await supabase.from("intake_data").insert({
      case_id: newCase.id,
      first_name: body.firstName,
      last_name: body.lastName,
      dob: body.dob || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      city: body.city || null,
      state: body.state || "NY",
      zip: body.zip || null,
      conditions: body.conditions || [],
      other_conditions: body.otherConditions || null,
      change_description: body.changeDescription,
      adl_levels: body.adlLevels || {},
      adl_notes: body.adlNotes || null,
    });

    if (intakeError) {
      console.error("Intake data error:", intakeError);
      // Clean up the case if intake fails
      await supabase.from("cases").delete().eq("id", newCase.id);
      return NextResponse.json(
        { error: "Failed to save intake data" },
        { status: 500 }
      );
    }

    // Create billing record for Stage 1
    await supabase.from("billing").insert({
      case_id: newCase.id,
      stage: 1,
      amount: 9900, // $99 in cents
      type: "stage_fee",
      status: "pending",
    });

    // Update profile name if needed
    await supabase
      .from("profiles")
      .update({ name: `${body.firstName} ${body.lastName}` })
      .eq("id", user.id);

    // Trigger AI document generation in the background
    // We don't await these — they run async and the client polls for results
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const generateDoc = (documentType: string) =>
      fetch(`${baseUrl}/api/ai/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: req.headers.get("cookie") || "",
        },
        body: JSON.stringify({ caseId: newCase.id, documentType }),
      }).catch((err) => console.error(`Generation error (${documentType}):`, err));

    // Fire and forget — generate both Stage 1 documents
    Promise.all([
      generateDoc("stage1_request"),
      generateDoc("stage1_lomn"),
    ]).catch((err) => console.error("Document generation failed:", err));

    return NextResponse.json(
      {
        message: "Case created successfully",
        caseId: newCase.id,
        caseNumber: newCase.case_number,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Intake error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
