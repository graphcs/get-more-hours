import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { compSchema } from "@/lib/validations";
import { markStagePaid } from "@/lib/billing/stage-payment";

// Admin-only: comp (mark paid) or un-comp (revert to pending) a stage fee for a
// case, without a Stripe payment. The stage payment gate (lib/billing/guard.ts)
// reads purely from the billing table, so a paid stage_fee row unlocks the
// stage exactly like a Stripe-webhook-created one.
//
// Comping goes through markStagePaid() so it *also* kicks off document
// generation. Previously it only wrote the billing row: the gate opened but no
// work ever started, and the client watched a "GENERATING" spinner forever
// while the admin UI showed "paid". Do not reintroduce a bare billing write.
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = compSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }
  const { stage, action } = parsed.data;

  const { data: existing } = await supabase
    .from("billing")
    .select("id, status, stripe_payment_id")
    .eq("case_id", id)
    .eq("stage", stage)
    .eq("type", "stage_fee")
    .maybeSingle();

  if (action === "uncomp") {
    if (!existing || existing.status !== "paid") {
      return NextResponse.json({ ok: true, status: "pending" });
    }
    // Never revert a real Stripe payment — only manual comps (no payment id).
    if (existing.stripe_payment_id) {
      return NextResponse.json(
        { error: "Cannot un-comp a real Stripe payment" },
        { status: 409 }
      );
    }
    const { error } = await supabase
      .from("billing")
      .update({ status: "pending", stripe_event: { manual_comp_removed: true, admin_id: user.id } })
      .eq("id", existing.id);
    if (error) {
      console.error("Un-comp failed:", error);
      return NextResponse.json({ error: "Failed to remove comp" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "pending" });
  }

  // action === "comp"
  const result = await markStagePaid({
    client: supabase,
    caseId: id,
    stage,
    stripeEvent: { manual_comp: true, admin_id: user.id },
  });

  if (!result.ok) {
    console.error("Comp failed:", result.error);
    return NextResponse.json({ error: "Failed to comp stage" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "paid" });
}
