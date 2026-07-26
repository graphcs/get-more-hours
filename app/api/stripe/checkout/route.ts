import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe";
import { isValidStage } from "@/lib/billing/stage-payment";
import type { BillingRecord } from "@/types";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { caseId, stage, includeWhiteGlove } = await req.json();

    if (!caseId || !stage) {
      return NextResponse.json(
        { error: "caseId and stage are required" },
        { status: 400 }
      );
    }

    const stageNum = Number(stage);
    if (!isValidStage(stageNum)) {
      return NextResponse.json(
        { error: `Invalid stage: ${stage}` },
        { status: 400 }
      );
    }

    // Fetch case
    const { data: caseData, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .eq("user_id", user.id)
      .single();

    if (error || !caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    // White Glove bypasses every per-stage gate — there is nothing to buy.
    if (caseData.tier === "white_glove") {
      return NextResponse.json(
        { error: "White Glove includes every stage — no payment needed" },
        { status: 409 }
      );
    }

    const { data: billing } = await supabase
      .from("billing")
      .select("stage, type, status")
      .eq("case_id", caseId);

    const records = (billing || []) as Pick<
      BillingRecord,
      "stage" | "type" | "status"
    >[];
    const isStageFeePaid = (n: number) =>
      records.some(
        (r) => r.stage === n && r.type === "stage_fee" && r.status === "paid"
      );

    // Duplicate-payment guard: never charge twice for the same stage.
    if (isStageFeePaid(stageNum)) {
      return NextResponse.json(
        { error: `Stage ${stageNum} is already paid` },
        { status: 409 }
      );
    }

    // Sequential unlock, enforced server side. The billing page renders the
    // same rule, but that is a client-visible UI concern — without this check
    // any authenticated owner could POST stage 3 first and pay out of order.
    if (stageNum > 1 && !isStageFeePaid(stageNum - 1)) {
      return NextResponse.json(
        {
          error: `Stage ${stageNum - 1} must be paid before Stage ${stageNum}`,
          redirectUrl: `/dashboard/billing?stage=${stageNum - 1}`,
        },
        { status: 409 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await createCheckoutSession({
      caseId,
      caseNumber: caseData.case_number,
      stage: stageNum,
      includeWhiteGlove: !!includeWhiteGlove,
      customerEmail: user.email || "",
      successUrl: `${baseUrl}/dashboard?payment=success&stage=${stageNum}`,
      cancelUrl: `${baseUrl}/dashboard/billing?stage=${stageNum}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
