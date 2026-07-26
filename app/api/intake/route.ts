import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { intakeSchema } from "@/lib/validations";
import { ensureStageFeeRow } from "@/lib/billing/stage-payment";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = intakeSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const body = parsed.data;

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

    // Create the pending Stage 1 fee row (amount comes from PRICING).
    await ensureStageFeeRow(supabase, newCase.id, 1);

    // Update profile name if needed
    await supabase
      .from("profiles")
      .update({ name: `${body.firstName} ${body.lastName}` })
      .eq("id", user.id);

    // Create placeholder documents so the UI can poll for generation status.
    const [{ data: reqDoc, error: reqErr }, { data: lomnDoc, error: lomnErr }] =
      await Promise.all([
        supabase
          .from("documents")
          .insert({
            case_id: newCase.id,
            name: "Request for Increase in Plan of Care",
            type: "generated",
            stage: 1,
            status: "pending",
            format: "letter",
            version: 1,
            generation_status: "pending",
          })
          .select("id")
          .single(),
        supabase
          .from("documents")
          .insert({
            case_id: newCase.id,
            name: "LOMN Request Template (for your Doctor)",
            type: "generated",
            stage: 1,
            status: "pending",
            format: "letter",
            version: 1,
            generation_status: "pending",
          })
          .select("id")
          .single(),
      ]);

    if (reqErr || lomnErr || !reqDoc || !lomnDoc) {
      console.error("Placeholder document insert failed:", reqErr || lomnErr);
      return NextResponse.json(
        { error: "Failed to initialize documents" },
        { status: 500 }
      );
    }

    // Stage 1 document generation is deferred until the Stage 1 fee is paid —
    // markStagePaid() (lib/billing/stage-payment.ts) triggers it from both the
    // Stripe webhook and the admin comp route.
    //
    // Send the client straight into Stripe Checkout so they are actually asked
    // to pay. Previously intake ended here, leaving two `pending` placeholder
    // documents that the dashboard polled forever behind a "GENERATING" badge
    // with no payment prompt anywhere.
    let checkoutUrl: string | null = null;
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const session = await createCheckoutSession({
        caseId: newCase.id,
        caseNumber: newCase.case_number,
        stage: 1,
        includeWhiteGlove: false,
        customerEmail: body.email || user.email || "",
        successUrl: `${baseUrl}/dashboard?payment=success&stage=1`,
        // Abandoning payment must not lose the case — land on Billing with the
        // Stage 1 card highlighted so paying is one click away.
        cancelUrl: `${baseUrl}/dashboard/billing?stage=1`,
      });
      checkoutUrl = session.url;
    } catch (err) {
      // The case is saved either way; the client can pay from /dashboard/billing.
      console.error("Intake checkout session creation failed:", err);
    }

    return NextResponse.json(
      {
        message: "Case created successfully",
        caseId: newCase.id,
        caseNumber: newCase.case_number,
        checkoutUrl,
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
