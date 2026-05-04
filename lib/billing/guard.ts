import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StageGate =
  | { ok: true }
  | { ok: false; response: NextResponse };

// White Glove tier (cases.tier='white_glove') bypasses all per-stage gates.
// Otherwise the case must have a billing row with type='stage_fee', status='paid' for the requested stage.
export async function checkStagePaid(
  client: SupabaseClient,
  caseId: string,
  stage: number
): Promise<StageGate> {
  if (!Number.isInteger(stage) || stage < 1 || stage > 3) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Invalid stage: ${stage}` },
        { status: 400 }
      ),
    };
  }

  const { data: caseRow, error: caseErr } = await client
    .from("cases")
    .select("tier")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !caseRow) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      ),
    };
  }

  if (caseRow.tier === "white_glove") return { ok: true };

  const { data: billing } = await client
    .from("billing")
    .select("id")
    .eq("case_id", caseId)
    .eq("stage", stage)
    .eq("type", "stage_fee")
    .eq("status", "paid")
    .maybeSingle();

  if (billing) return { ok: true };

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: `Stage ${stage} requires payment before processing`,
        redirectUrl: `/dashboard/billing?stage=${stage}`,
      },
      { status: 402 }
    ),
  };
}
