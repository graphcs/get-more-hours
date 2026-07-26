import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRICING } from "@/lib/constants";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "@/lib/billing/__fixtures__/fake-supabase";

const state = vi.hoisted(() => ({ supabase: null as unknown }));
const { createCheckoutSession } = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(async () => ({
    url: "https://checkout.stripe.test/session",
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.supabase,
  createServiceClient: async () => state.supabase,
}));

vi.mock("@/lib/stripe", () => ({ createCheckoutSession }));

const CASE_ID = "case-1";
const USER_ID = "user-1";

let supabase: FakeSupabase;

function seed(
  billing: Array<Record<string, unknown>> = [],
  tier = "self_serve"
) {
  supabase = createFakeSupabase(
    {
      cases: [
        {
          id: CASE_ID,
          user_id: USER_ID,
          case_number: "GMH-0001",
          tier,
          current_stage: 1,
        },
      ],
      billing,
    },
    { id: USER_ID, email: "client@example.com" }
  );
  state.supabase = supabase;
}

async function post(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function paidFee(stage: number) {
  return {
    case_id: CASE_ID,
    stage,
    type: "stage_fee",
    status: "paid",
    amount: PRICING.stage1,
  };
}

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    createCheckoutSession.mockClear();
    seed();
  });

  it("creates a session for stage 1", async () => {
    const res = await post({ caseId: CASE_ID, stage: 1 });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      url: "https://checkout.stripe.test/session",
    });
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 1,
        cancelUrl: expect.stringContaining("/dashboard/billing?stage=1"),
      })
    );
  });

  it("refuses to charge twice for the same stage", async () => {
    seed([paidFee(1)]);

    const res = await post({ caseId: CASE_ID, stage: 1 });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      error: "Stage 1 is already paid",
    });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("enforces sequential unlock server side", async () => {
    // Nothing paid — stage 3 must not be purchasable out of order.
    const res = await post({ caseId: CASE_ID, stage: 3 });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      redirectUrl: "/dashboard/billing?stage=2",
    });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("allows the next stage once the previous one is paid", async () => {
    seed([paidFee(1)]);

    const res = await post({ caseId: CASE_ID, stage: 2 });

    expect(res.status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 2 })
    );
  });

  it("rejects stages outside 1-3", async () => {
    const res = await post({ caseId: CASE_ID, stage: 4 });

    expect(res.status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("tells white glove clients there is nothing to buy", async () => {
    seed([], "white_glove");

    const res = await post({ caseId: CASE_ID, stage: 2 });

    expect(res.status).toBe(409);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("404s on a case the user does not own", async () => {
    const res = await post({ caseId: "someone-elses-case", stage: 1 });

    expect(res.status).toBe(404);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});
