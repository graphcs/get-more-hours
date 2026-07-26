import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRICING } from "@/lib/constants";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "@/lib/billing/__fixtures__/fake-supabase";

// Hoisted so the vi.mock factory (which is hoisted above imports) can see it.
const { runDocumentGeneration } = vi.hoisted(() => ({
  runDocumentGeneration: vi.fn(async () => {}),
}));

vi.mock("@/lib/document-generation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/document-generation")>();
  return { ...actual, runDocumentGeneration };
});

const state = vi.hoisted(() => ({ supabase: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.supabase,
  createServiceClient: async () => state.supabase,
}));

import {
  ensureStageFeeRow,
  getStagePaymentGate,
  markStagePaid,
  stageFeeAmount,
  triggerStageGeneration,
} from "@/lib/billing/stage-payment";
import type { SupabaseClient } from "@supabase/supabase-js";

const CASE_ID = "case-1";

// Runs the scheduled task synchronously instead of deferring past the response.
const scheduled: Array<() => Promise<void>> = [];
const schedule = (task: () => Promise<void>) => {
  scheduled.push(task);
};
async function drain() {
  for (const task of scheduled.splice(0)) await task();
}

let supabase: FakeSupabase;

function client() {
  return supabase as unknown as SupabaseClient;
}

function billing() {
  return supabase.tables.billing as Array<Record<string, unknown>>;
}

beforeEach(() => {
  runDocumentGeneration.mockClear();
  scheduled.length = 0;
  supabase = createFakeSupabase({
    cases: [{ id: CASE_ID, tier: "self_serve" }],
    billing: [],
    documents: [
      {
        id: "doc-request",
        case_id: CASE_ID,
        stage: 1,
        type: "generated",
        name: "Request for Increase in Plan of Care",
        generation_status: "pending",
      },
    ],
  });
  state.supabase = supabase;
});

describe("stageFeeAmount", () => {
  it("reads from PRICING rather than hardcoded cents", () => {
    expect(stageFeeAmount(1)).toBe(PRICING.stage1);
    expect(stageFeeAmount(2)).toBe(PRICING.stage2);
    expect(stageFeeAmount(3)).toBe(PRICING.stage3);
  });

  it("rejects stages outside 1-3", () => {
    expect(() => stageFeeAmount(4)).toThrow();
  });
});

describe("markStagePaid", () => {
  it("writes the billing row AND schedules generation together", async () => {
    const result = await markStagePaid({
      client: client(),
      caseId: CASE_ID,
      stage: 1,
      schedule,
    });

    expect(result.ok).toBe(true);
    expect(billing()).toContainEqual(
      expect.objectContaining({
        stage: 1,
        type: "stage_fee",
        status: "paid",
        amount: PRICING.stage1,
      })
    );

    // Scheduled, not yet run — generation must not block the response (Stripe
    // webhooks in particular have to return promptly).
    expect(runDocumentGeneration).not.toHaveBeenCalled();
    await drain();
    expect(runDocumentGeneration).toHaveBeenCalledWith({
      caseId: CASE_ID,
      documentType: "stage1_request",
      documentId: "doc-request",
    });
  });

  it("updates an existing pending row instead of inserting a duplicate", async () => {
    billing().push({
      id: "b1",
      case_id: CASE_ID,
      stage: 1,
      type: "stage_fee",
      status: "pending",
      amount: PRICING.stage1,
    });

    await markStagePaid({
      client: client(),
      caseId: CASE_ID,
      stage: 1,
      stripePaymentId: "pi_123",
      schedule,
    });

    const stage1 = billing().filter(
      (r) => r.stage === 1 && r.type === "stage_fee"
    );
    expect(stage1).toHaveLength(1);
    expect(stage1[0]).toMatchObject({
      status: "paid",
      stripe_payment_id: "pi_123",
    });
  });

  it("opens up the next stage by creating its pending fee row", async () => {
    await markStagePaid({
      client: client(),
      caseId: CASE_ID,
      stage: 2,
      schedule,
    });

    expect(billing()).toContainEqual(
      expect.objectContaining({
        stage: 3,
        type: "stage_fee",
        status: "pending",
        amount: PRICING.stage3,
      })
    );
  });

  it("does not create a stage 4 row after the final stage", async () => {
    await markStagePaid({
      client: client(),
      caseId: CASE_ID,
      stage: 3,
      schedule,
    });

    expect(billing().some((r) => r.stage === 4)).toBe(false);
  });

  it("rejects an invalid stage without writing anything", async () => {
    const result = await markStagePaid({
      client: client(),
      caseId: CASE_ID,
      stage: 9,
      schedule,
    });

    expect(result).toEqual({ ok: false, error: "Invalid stage: 9" });
    expect(billing()).toHaveLength(0);
    expect(scheduled).toHaveLength(0);
  });
});

describe("ensureStageFeeRow", () => {
  it("is idempotent — no duplicate pending rows on repeat calls", async () => {
    await ensureStageFeeRow(client(), CASE_ID, 2);
    await ensureStageFeeRow(client(), CASE_ID, 2);

    expect(
      billing().filter((r) => r.stage === 2 && r.type === "stage_fee")
    ).toHaveLength(1);
  });

  it("never downgrades an already paid fee back to pending", async () => {
    billing().push({
      id: "b1",
      case_id: CASE_ID,
      stage: 2,
      type: "stage_fee",
      status: "paid",
      amount: PRICING.stage2,
    });

    await ensureStageFeeRow(client(), CASE_ID, 2);

    const rows = billing().filter((r) => r.stage === 2);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("paid");
  });
});

describe("triggerStageGeneration", () => {
  it("skips documents whose name maps to no known document type", async () => {
    (supabase.tables.documents as Array<Record<string, unknown>>).push({
      id: "doc-unknown",
      case_id: CASE_ID,
      stage: 1,
      type: "generated",
      name: "Some Unrelated File",
      generation_status: "pending",
    });

    await triggerStageGeneration(CASE_ID, 1);

    expect(runDocumentGeneration).toHaveBeenCalledTimes(1);
  });

  it("keeps generating siblings when one generation rejects", async () => {
    (supabase.tables.documents as Array<Record<string, unknown>>).push({
      id: "doc-lomn",
      case_id: CASE_ID,
      stage: 1,
      type: "generated",
      name: "LOMN Request Template (for your Doctor)",
      generation_status: "pending",
    });
    runDocumentGeneration.mockRejectedValueOnce(new Error("provider down"));

    await expect(triggerStageGeneration(CASE_ID, 1)).resolves.toBeUndefined();
    expect(runDocumentGeneration).toHaveBeenCalledTimes(2);
  });
});

describe("getStagePaymentGate", () => {
  it("returns a gate when the stage fee is unpaid", async () => {
    await expect(
      getStagePaymentGate(client(), { id: CASE_ID, tier: "self_serve" }, 1)
    ).resolves.toEqual({
      caseId: CASE_ID,
      stage: 1,
      amount: PRICING.stage1,
    });
  });

  it("returns null once the stage fee is paid", async () => {
    await markStagePaid({
      client: client(),
      caseId: CASE_ID,
      stage: 1,
      schedule,
    });

    await expect(
      getStagePaymentGate(client(), { id: CASE_ID, tier: "self_serve" }, 1)
    ).resolves.toBeNull();
  });

  it("returns null for white_glove — the tier bypasses every stage gate", async () => {
    await expect(
      getStagePaymentGate(client(), { id: CASE_ID, tier: "white_glove" }, 3)
    ).resolves.toBeNull();
  });
});
