import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import {
  markStagePaid,
  recordWhiteGloveUpgrade,
} from "@/lib/billing/stage-payment";
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

  const serviceClient = await createServiceClient();
  const rawEvent = event as unknown as Record<string, unknown>;

  // Idempotency: claim this event.id before any side effects. A duplicate
  // delivery hits the primary-key constraint (Postgres SQLSTATE 23505) and
  // we return 200 so Stripe stops retrying.
  const { error: dedupErr } = await serviceClient
    .from("stripe_events")
    .insert({ event_id: event.id, type: event.type });
  if (dedupErr) {
    if (dedupErr.code === "23505") {
      return NextResponse.json({ received: true, deduplicated: true });
    }
    console.error("stripe_events insert failed:", dedupErr);
    return NextResponse.json(
      { error: "event log failed" },
      { status: 500 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { caseId, stage, includeWhiteGlove, type } = session.metadata || {};

      if (!caseId) {
        console.error("Missing caseId metadata in checkout session");
        break;
      }

      // Standalone white-glove upgrade (no stage fee component).
      if (type === "white_glove_standalone") {
        await recordWhiteGloveUpgrade({
          client: serviceClient,
          caseId,
          stripePaymentId: session.payment_intent as string,
          stripeEvent: rawEvent,
        });
        break;
      }

      if (!stage) {
        console.error("Missing stage metadata in stage-fee checkout session");
        break;
      }

      const stageNum = parseInt(stage, 10);

      // markStagePaid writes the billing row AND schedules generation for the
      // stage. Never split those two apart — see lib/billing/stage-payment.ts.
      const paid = await markStagePaid({
        client: serviceClient,
        caseId,
        stage: stageNum,
        stripePaymentId: session.payment_intent as string,
        stripeEvent: rawEvent,
      });
      if (!paid.ok) {
        // Return non-2xx so Stripe retries; the event-id claim is rolled back
        // below so the retry isn't deduplicated away.
        await serviceClient
          .from("stripe_events")
          .delete()
          .eq("event_id", event.id);
        return NextResponse.json({ error: paid.error }, { status: 500 });
      }

      // Handle White Glove add-on bundled with stage fee.
      if (includeWhiteGlove === "true") {
        await recordWhiteGloveUpgrade({
          client: serviceClient,
          caseId,
          stage: stageNum,
          stripePaymentId: session.payment_intent as string,
          stripeEvent: rawEvent,
        });
      }
      break;
    }

    case "charge.refunded":
    case "charge.failed": {
      const charge = event.data.object as Stripe.Charge;
      const pi = charge.payment_intent as string | null;
      if (!pi) {
        console.error(`${event.type}: charge has no payment_intent`);
        break;
      }
      await serviceClient
        .from("billing")
        .update({
          status: event.type === "charge.refunded" ? "refunded" : "failed",
          stripe_event: rawEvent,
        })
        .eq("stripe_payment_id", pi);
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId =
        typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
      const charge = await stripe.charges.retrieve(chargeId);
      const pi = charge.payment_intent as string | null;
      if (!pi) {
        console.error("Dispute: charge has no payment_intent");
        break;
      }
      await serviceClient
        .from("billing")
        .update({ status: "disputed", stripe_event: rawEvent })
        .eq("stripe_payment_id", pi);
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { caseId, stage, type } = session.metadata || {};
      if (!caseId || type === "white_glove_standalone") break;
      await serviceClient
        .from("billing")
        .update({ status: "expired", stripe_event: rawEvent })
        .eq("case_id", caseId)
        .eq("stage", parseInt(stage || "0", 10))
        .eq("type", "stage_fee")
        .eq("status", "pending");
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
