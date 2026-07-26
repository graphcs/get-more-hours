import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { intakeSchema } from "@/lib/validations";
import { ensureStageFeeRow } from "@/lib/billing/stage-payment";
import { createCheckoutSession } from "@/lib/stripe";
import { findUsableCase } from "@/lib/intake-case";

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
      // `error` stays the first message for backward compatibility; `issues`
      // lets the wizard highlight every offending field and jump the user back
      // to the step that owns the first one.
      return NextResponse.json(
        {
          error: parsed.error.issues[0].message,
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.map(String),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // Check if user already has a *complete* case. An orphaned case row from a
    // previously failed intake is cleaned up rather than treated as a case.
    const existingCase = await findUsableCase(supabase, user.id);

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

    // The block below belongs to one logical transaction. PostgREST gives us no
    // multi-statement transaction, so any failure is rolled back by deleting
    // the case — every child table (intake_data, billing, documents) is
    // ON DELETE CASCADE. Previously a failed document insert returned 500 but
    // left the case row behind, after which /intake redirected to /dashboard
    // and this route answered 409: the user was locked out of intake forever.
    //
    // Scope matters. Only the rows that make a case *usable* live in here;
    // Stripe Checkout is deliberately outside it (see below), because a Stripe
    // outage must never cost a client their intake.
    const rollback = async (reason: string, cause: unknown) => {
      console.error(`Intake rollback (${reason}):`, cause);
      const { error: rollbackError } = await supabase
        .from("cases")
        .delete()
        .eq("id", newCase.id);
      if (rollbackError) {
        console.error("Intake rollback failed to delete case:", rollbackError);
      }
    };

    try {
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
        await rollback("intake_data", intakeError);
        return NextResponse.json(
          { error: "Failed to save intake data" },
          { status: 500 }
        );
      }

      // Create the pending Stage 1 fee row (amount comes from PRICING).
      // ensureStageFeeRow is idempotent and self-healing — it logs rather than
      // throwing on a write failure, and every path that makes a stage
      // reachable calls it again — so a hiccup there is not worth discarding a
      // completed intake over. A hard throw still lands in the catch below.
      await ensureStageFeeRow(supabase, newCase.id, 1);

      // Create placeholder documents so the UI can poll for generation status.
      const [
        { data: reqDoc, error: reqErr },
        { data: lomnDoc, error: lomnErr },
      ] = await Promise.all([
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
        await rollback("documents", reqErr || lomnErr);
        return NextResponse.json(
          { error: "Failed to initialize documents" },
          { status: 500 }
        );
      }
    } catch (err) {
      await rollback("unexpected", err);
      return NextResponse.json(
        { error: "Something went wrong" },
        { status: 500 }
      );
    }

    // ── The case is committed. Nothing past this point may roll it back. ──

    // Best-effort, non-critical: keep the profile name in sync. A failure here
    // must not undo a case the user successfully completed.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ name: `${body.firstName} ${body.lastName}` })
      .eq("id", user.id);

    if (profileError) {
      console.error("Profile name update failed:", profileError);
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
      // Deliberately NOT a rollback. The case, its intake and the pending fee
      // row are already saved, so the client can pay from /dashboard/billing.
      // A Stripe outage must not destroy a completed intake.
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
