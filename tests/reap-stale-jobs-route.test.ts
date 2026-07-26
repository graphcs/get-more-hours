import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseAiErrorCode } from "@/lib/ai-errors";
import { STALE_CLAIM_SECONDS } from "@/lib/ai-limits";

const createServiceClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => createServiceClient(),
}));

import { GET } from "@/app/api/cron/reap-stale-jobs/route";

type Result = { data: unknown; error: unknown };

function query(result: Result) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "update", "eq", "lt", "or"]) {
    q[m] = vi.fn(() => q);
  }
  q.then = (res: (v: Result) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return q;
}

function request(headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/cron/reap-stale-jobs", { headers });
}

const SECRET = "test-cron-secret";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("authorization", () => {
  it("fails closed when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong bearer token", async () => {
    expect((await GET(request())).status).toBe(401);
    expect(
      (await GET(request({ authorization: "Bearer nope" }))).status
    ).toBe(401);
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});

describe("sweep", () => {
  function mockClient(generation: unknown[], ocr: unknown[]) {
    const queries = [
      query({ data: generation, error: null }),
      query({ data: ocr, error: null }),
    ];
    let i = 0;
    const from = vi.fn(() => queries[i++]);
    createServiceClient.mockReturnValue({ from });
    return { from, queries };
  }

  it("flips stale generating + processing rows to failed", async () => {
    const { queries } = mockClient([{ id: "gen-1" }], [{ id: "ocr-1" }, { id: "ocr-2" }]);

    const res = await GET(request({ authorization: `Bearer ${SECRET}` }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.generationReaped).toBe(1);
    expect(body.ocrReaped).toBe(2);
    expect(body.generationIds).toEqual(["gen-1"]);
    expect(body.staleSeconds).toBe(STALE_CLAIM_SECONDS);

    const genUpdate = queries[0].update as ReturnType<typeof vi.fn>;
    const genPatch = genUpdate.mock.calls[0][0];
    expect(genPatch.generation_status).toBe("failed");
    // The stored error must be tagged 'stalled' so describeAiError renders the
    // recoverable copy and the viewer offers "Try again".
    expect(parseAiErrorCode(genPatch.generation_error)).toBe("stalled");

    const ocrUpdate = queries[1].update as ReturnType<typeof vi.fn>;
    const ocrPatch = ocrUpdate.mock.calls[0][0];
    expect(ocrPatch.ocr_status).toBe("failed");
    expect(parseAiErrorCode(ocrPatch.ocr_error)).toBe("stalled");
  });

  it("only touches rows older than the staleness cutoff", async () => {
    const { queries } = mockClient([], []);

    const before = Date.now();
    await GET(request({ authorization: `Bearer ${SECRET}` }));

    const eq = queries[0].eq as ReturnType<typeof vi.fn>;
    const lt = queries[0].lt as ReturnType<typeof vi.fn>;
    expect(eq).toHaveBeenCalledWith("generation_status", "generating");
    expect(lt.mock.calls[0][0]).toBe("updated_at");

    const cutoff = Date.parse(lt.mock.calls[0][1] as string);
    // A live in-flight generation (claimed seconds ago) must not be reaped.
    expect(before - cutoff).toBeGreaterThanOrEqual(STALE_CLAIM_SECONDS * 1000 - 50);
  });

  it("reports zero work as a successful no-op", async () => {
    mockClient([], []);
    const res = await GET(request({ authorization: `Bearer ${SECRET}` }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.generationReaped).toBe(0);
    expect(body.ocrReaped).toBe(0);
    expect(body.errors).toEqual([]);
  });
});
