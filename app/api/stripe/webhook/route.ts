import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { PRICING } from "@/lib/constants";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { caseId, stage, includeWhiteGlove } = session.metadata || {};

    if (!caseId || !stage) {
      console.error("Missing metadata in checkout session");
      return NextResponse.json({ received: true });
    }

    const serviceClient = await createServiceClient();
    const stageNum = parseInt(stage, 10);

    // Update billing record for stage fee
    const { data: existingBilling } = await serviceClient
      .from("billing")
      .select("id")
      .eq("case_id", caseId)
      .eq("stage", stageNum)
      .eq("type", "stage_fee")
      .single();

    if (existingBilling) {
      await serviceClient
        .from("billing")
        .update({
          status: "paid",
          stripe_payment_id: session.payment_intent as string,
        })
        .eq("id", existingBilling.id);
    } else {
      const STAGE_AMOUNTS: Record<number, number> = {
        1: PRICING.stage1,
        2: PRICING.stage2,
        3: PRICING.stage3,
      };
      await serviceClient.from("billing").insert({
        case_id: caseId,
        stage: stageNum,
        amount: STAGE_AMOUNTS[stageNum] || 0,
        type: "stage_fee",
        status: "paid",
        stripe_payment_id: session.payment_intent as string,
      });
    }

    // Handle White Glove add-on
    if (includeWhiteGlove === "true") {
      await serviceClient.from("billing").insert({
        case_id: caseId,
        stage: stageNum,
        amount: PRICING.whiteGlove,
        type: "white_glove",
        status: "paid",
        stripe_payment_id: session.payment_intent as string,
      });

      // Update case tier
      await serviceClient
        .from("cases")
        .update({ tier: "white_glove" })
        .eq("id", caseId);
    }
  }

  return NextResponse.json({ received: true });
}
