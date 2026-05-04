import { after, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { PRICING } from "@/lib/constants";
import {
  NAME_MAP,
  runDocumentGeneration,
  type DocumentType,
} from "@/lib/document-generation";
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
        await serviceClient.from("billing").insert({
          case_id: caseId,
          stage: 1,
          amount: PRICING.whiteGlove,
          type: "white_glove",
          status: "paid",
          stripe_payment_id: session.payment_intent as string,
          stripe_event: rawEvent,
        });
        await serviceClient
          .from("cases")
          .update({ tier: "white_glove" })
          .eq("id", caseId);
        break;
      }

      if (!stage) {
        console.error("Missing stage metadata in stage-fee checkout session");
        break;
      }

      const stageNum = parseInt(stage, 10);

      // Update or insert billing record for the stage fee
      const { data: existingBilling } = await serviceClient
        .from("billing")
        .select("id")
        .eq("case_id", caseId)
        .eq("stage", stageNum)
        .eq("type", "stage_fee")
        .maybeSingle();

      if (existingBilling) {
        await serviceClient
          .from("billing")
          .update({
            status: "paid",
            stripe_payment_id: session.payment_intent as string,
            stripe_event: rawEvent,
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
          stripe_event: rawEvent,
        });
      }

      // Schedule generation for any pending placeholder documents at this stage.
      after(() => triggerStageGeneration(caseId, stageNum));

      // Handle White Glove add-on bundled with stage fee.
      if (includeWhiteGlove === "true") {
        await serviceClient.from("billing").insert({
          case_id: caseId,
          stage: stageNum,
          amount: PRICING.whiteGlove,
          type: "white_glove",
          status: "paid",
          stripe_payment_id: session.payment_intent as string,
          stripe_event: rawEvent,
        });

        await serviceClient
          .from("cases")
          .update({ tier: "white_glove" })
          .eq("id", caseId);
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

const NAME_TO_TYPE: Record<string, DocumentType> = Object.fromEntries(
  Object.entries(NAME_MAP).map(([type, name]) => [name, type as DocumentType])
);

// Looks up placeholder documents at the given (case, stage) whose generation
// hasn't completed yet, and runs generation for any whose name matches a known
// document type. Stage 1 placeholders are created at intake; Stage 2/3 are
// usually created by the OCR auto-detect flow — this catches both paths.
async function triggerStageGeneration(caseId: string, stage: number) {
  const client = await createServiceClient();
  const { data: docs, error } = await client
    .from("documents")
    .select("id, name, generation_status")
    .eq("case_id", caseId)
    .eq("stage", stage)
    .eq("type", "generated")
    .neq("generation_status", "ready");

  if (error) {
    console.error("triggerStageGeneration: lookup failed", error);
    return;
  }

  const jobs: Promise<void>[] = [];
  for (const d of docs || []) {
    const documentType = NAME_TO_TYPE[d.name as string];
    if (!documentType) continue;
    jobs.push(
      runDocumentGeneration({ caseId, documentType, documentId: d.id as string })
    );
  }
  // allSettled so one failed generation doesn't drop sibling generations;
  // runDocumentGeneration records failed status internally on throw.
  await Promise.allSettled(jobs);
}
