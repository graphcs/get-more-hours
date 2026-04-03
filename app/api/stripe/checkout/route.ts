import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    const { caseId, stage, includeWhiteGlove } = await req.json();

    if (!caseId || !stage) {
      return NextResponse.json(
        { error: "caseId and stage are required" },
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await createCheckoutSession({
      caseId,
      caseNumber: caseData.case_number,
      stage: Number(stage),
      includeWhiteGlove: !!includeWhiteGlove,
      customerEmail: user.email || "",
      successUrl: `${baseUrl}/dashboard?payment=success&stage=${stage}`,
      cancelUrl: `${baseUrl}/dashboard/billing`,
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
