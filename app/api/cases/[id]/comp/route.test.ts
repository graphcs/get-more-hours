/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE REGRESSION TEST FOR THE OUTAGE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * An admin comping a stage marked the fee `paid` and returned. It never
 * triggered document generation — only the Stripe webhook did. The gate opened,
 * the admin UI said "paid", and the client watched a "GENERATING" spinner for
 * 26 days while nothing ran. Two production cases were affected.
 *
 * If this file fails, comped clients are stranded again.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "@/lib/billing/__fixtures__/fake-supabase";

type GenerationArgs = {
  caseId: string;
  documentType: string;
  documentId: string;
};
const runDocumentGeneration =
  vi.fn<(args: GenerationArgs) => Promise<void>>(async () => {});
// `after()` normally defers to post-response; run the callback immediately so
// the test can assert on it.
const afterTasks: Array<() => unknown> = [];

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (task: () => unknown) => {
      afterTasks.push(task);
    },
  };
});

vi.mock("@/lib/document-generation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/document-generation")>();
  return { ...actual, runDocumentGeneration };
});

let supabase: FakeSupabase;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabase,
  createServiceClient: async () => supabase,
}));

const CASE_ID = "case-1";
const ADMIN_ID = "admin-1";

function seed() {
  supabase = createFakeSupabase(
    {
      profiles: [{ id: ADMIN_ID, role: "admin" }],
      cases: [{ id: CASE_ID, tier: "self_serve", current_stage: 1 }],
      billing: [
        {
          id: "bill-1",
          case_id: CASE_ID,
          stage: 1,
          type: "stage_fee",
          status: "pending",
          amount: 9900,
        },
      ],
      documents: [
        {
          id: "doc-request",
          case_id: CASE_ID,
          stage: 1,
          type: "generated",
          name: "Request for Increase in Plan of Care",
          generation_status: "pending",
        },
        {
          id: "doc-lomn",
          case_id: CASE_ID,
          stage: 1,
          type: "generated",
          name: "LOMN Request Template (for your Doctor)",
          generation_status: "pending",
        },
      ],
    },
    { id: ADMIN_ID }
  );
}

async function comp(stage: number, action: "comp" | "uncomp" = "comp") {
  const { POST } = await import("./route");
  const req = new Request("http://localhost/api/cases/case-1/comp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage, action }),
  });
  const res = await POST(req, { params: Promise.resolve({ id: CASE_ID }) });
  // Drain the scheduled post-response work.
  for (const task of afterTasks.splice(0)) await task();
  return res;
}

function billingRow(stage: number) {
  return (supabase.tables.billing as Array<Record<string, unknown>>).find(
    (r) => r.stage === stage && r.type === "stage_fee"
  );
}

describe("POST /api/cases/[id]/comp", () => {
  beforeEach(() => {
    runDocumentGeneration.mockClear();
    afterTasks.length = 0;
    seed();
  });

  it("triggers document generation when an admin comps a stage", async () => {
    const res = await comp(1);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "paid" });

    // Billing was updated...
    expect(billingRow(1)).toMatchObject({ status: "paid" });

    // ...AND the work actually started. This is the assertion that would have
    // caught the 26-day outage.
    expect(runDocumentGeneration).toHaveBeenCalledTimes(2);
    expect(
      runDocumentGeneration.mock.calls.map((c) => c[0].documentType)
    ).toEqual(expect.arrayContaining(["stage1_request", "stage1_lomn"]));
  });

  it("comps a stage that has no billing row yet, and still generates", async () => {
    supabase.tables.billing = [];

    const res = await comp(1);

    expect(res.status).toBe(200);
    expect(billingRow(1)).toMatchObject({
      status: "paid",
      amount: 9900,
      case_id: CASE_ID,
    });
    expect(runDocumentGeneration).toHaveBeenCalledTimes(2);
  });

  it("does not regenerate documents that are already ready", async () => {
    const docs = supabase.tables.documents as Array<Record<string, unknown>>;
    docs[0].generation_status = "ready";

    await comp(1);

    expect(runDocumentGeneration).toHaveBeenCalledTimes(1);
    expect(runDocumentGeneration.mock.calls[0][0].documentId).toBe("doc-lomn");
  });

  it("creates the next stage's pending fee row so the client is asked to pay", async () => {
    await comp(1);

    // Stage 2's fee row used to be created only inside runDocumentGeneration,
    // which could never run for a self-serve client — a circular dependency.
    expect(billingRow(2)).toMatchObject({
      stage: 2,
      type: "stage_fee",
      status: "pending",
      amount: 14900,
    });
  });

  it("does not trigger generation when un-comping", async () => {
    await comp(1);
    runDocumentGeneration.mockClear();

    const res = await comp(1, "uncomp");

    await expect(res.json()).resolves.toMatchObject({ status: "pending" });
    expect(billingRow(1)).toMatchObject({ status: "pending" });
    expect(runDocumentGeneration).not.toHaveBeenCalled();
  });

  it("rejects non-admins", async () => {
    (supabase.tables.profiles as Array<Record<string, unknown>>)[0].role =
      "client";

    const res = await comp(1);

    expect(res.status).toBe(403);
    expect(runDocumentGeneration).not.toHaveBeenCalled();
  });
});
