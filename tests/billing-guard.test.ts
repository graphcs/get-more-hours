import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkStagePaid } from "@/lib/billing/guard";

type QueryResult = { data: unknown; error: unknown };

/**
 * Minimal PostgREST-style chainable stub. Every filter method returns `this`,
 * and `maybeSingle()` resolves to whatever the table was configured with. Also
 * records the `.eq()` filters applied so tests can assert the query shape.
 */
function makeClient(tables: Record<string, QueryResult>) {
  const filters: Record<string, Record<string, unknown>> = {};

  const from = vi.fn((table: string) => {
    filters[table] ??= {};
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((col: string, val: unknown) => {
        filters[table][col] = val;
        return builder;
      }),
      maybeSingle: vi.fn(async () => tables[table] ?? { data: null, error: null }),
    };
    return builder;
  });

  return { client: { from } as unknown as SupabaseClient, from, filters };
}

const CASE_ID = "11111111-2222-3333-4444-555555555555";

describe("checkStagePaid — stage argument validation", () => {
  it.each([0, 4, -1, 1.5, Number.NaN])("rejects stage %s with a 400", async (stage) => {
    const { client, from } = makeClient({});
    const gate = await checkStagePaid(client, CASE_ID, stage);

    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(400);
    await expect(gate.response.json()).resolves.toEqual({
      error: `Invalid stage: ${stage}`,
    });
    // Bails out before touching the database.
    expect(from).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3])("accepts stage %s as in-range", async (stage) => {
    const { client } = makeClient({
      cases: { data: { tier: "white_glove" }, error: null },
    });
    const gate = await checkStagePaid(client, CASE_ID, stage);
    expect(gate.ok).toBe(true);
  });
});

describe("checkStagePaid — white_glove bypass", () => {
  it("passes without consulting the billing table", async () => {
    const { client, from } = makeClient({
      cases: { data: { tier: "white_glove" }, error: null },
    });

    const gate = await checkStagePaid(client, CASE_ID, 3);

    expect(gate).toEqual({ ok: true });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("cases");
    expect(from).not.toHaveBeenCalledWith("billing");
  });

  it("bypasses even when there is no billing row at all", async () => {
    const { client } = makeClient({
      cases: { data: { tier: "white_glove" }, error: null },
      billing: { data: null, error: null },
    });
    expect((await checkStagePaid(client, CASE_ID, 1)).ok).toBe(true);
  });
});

describe("checkStagePaid — self_serve with a paid stage_fee", () => {
  it("passes", async () => {
    const { client } = makeClient({
      cases: { data: { tier: "self_serve" }, error: null },
      billing: { data: { id: "billing-1" }, error: null },
    });

    expect((await checkStagePaid(client, CASE_ID, 2))).toEqual({ ok: true });
  });

  it("scopes the billing lookup to case + stage + stage_fee + paid", async () => {
    const { client, filters } = makeClient({
      cases: { data: { tier: "self_serve" }, error: null },
      billing: { data: { id: "billing-1" }, error: null },
    });

    await checkStagePaid(client, CASE_ID, 2);

    expect(filters.cases).toEqual({ id: CASE_ID });
    expect(filters.billing).toEqual({
      case_id: CASE_ID,
      stage: 2,
      type: "stage_fee",
      status: "paid",
    });
  });
});

describe("checkStagePaid — unpaid stage", () => {
  it("returns 402 with a redirectUrl pointing at the billing page", async () => {
    const { client } = makeClient({
      cases: { data: { tier: "self_serve" }, error: null },
      billing: { data: null, error: null },
    });

    const gate = await checkStagePaid(client, CASE_ID, 2);

    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(402);
    await expect(gate.response.json()).resolves.toEqual({
      error: "Stage 2 requires payment before processing",
      redirectUrl: "/dashboard/billing?stage=2",
    });
  });

  it("puts the requested stage in the redirectUrl query string", async () => {
    for (const stage of [1, 2, 3]) {
      const { client } = makeClient({
        cases: { data: { tier: "self_serve" }, error: null },
        billing: { data: null, error: null },
      });
      const gate = await checkStagePaid(client, CASE_ID, stage);
      expect(gate.ok).toBe(false);
      if (gate.ok) continue;
      const body = await gate.response.json();
      expect(body.redirectUrl).toBe(`/dashboard/billing?stage=${stage}`);
    }
  });

  it("treats a billing query error as unpaid (the error is not surfaced)", async () => {
    // guard.ts destructures only `data` from the billing query, so a DB failure
    // is indistinguishable from "no paid row" and fails closed with a 402.
    const { client } = makeClient({
      cases: { data: { tier: "self_serve" }, error: null },
      billing: { data: null, error: { message: "connection reset" } },
    });

    const gate = await checkStagePaid(client, CASE_ID, 1);
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(402);
  });
});

describe("checkStagePaid — missing case", () => {
  it("returns 404 when the case row is absent", async () => {
    const { client } = makeClient({ cases: { data: null, error: null } });

    const gate = await checkStagePaid(client, CASE_ID, 1);
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(404);
    await expect(gate.response.json()).resolves.toEqual({ error: "Case not found" });
  });

  it("returns 404 when the case query errors", async () => {
    const { client } = makeClient({
      cases: { data: null, error: { message: "boom" } },
    });

    const gate = await checkStagePaid(client, CASE_ID, 1);
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(404);
  });
});
