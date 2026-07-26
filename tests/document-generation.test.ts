import { beforeEach, describe, expect, it, vi } from "vitest";
import { STALE_CLAIM_SECONDS } from "@/lib/ai-limits";

const createServiceClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => createServiceClient(),
}));

vi.mock("@/lib/openrouter", () => ({
  generateDocument: vi.fn(async () => "generated body"),
}));

import { runDocumentGeneration } from "@/lib/document-generation";

type Result = { data: unknown; error: unknown };

/** Minimal thenable stand-in for the supabase-js query builder. */
function query(result: Result) {
  const q: Record<string, unknown> = {};
  for (const m of [
    "select",
    "update",
    "insert",
    "eq",
    "in",
    "lt",
    "or",
    "limit",
  ]) {
    q[m] = vi.fn(() => q);
  }
  q.single = vi.fn(async () => result);
  q.maybeSingle = vi.fn(async () => result);
  q.then = (res: (v: Result) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return q;
}

function serviceClient({
  claim,
  documentRow,
}: {
  claim: Result;
  documentRow?: Result;
}) {
  const documents = query(documentRow ?? { data: null, error: null });
  const cases = query({ data: null, error: { message: "no such case" } });
  const rpc = vi.fn(async () => claim);
  const from = vi.fn((table: string) => (table === "cases" ? cases : documents));
  return { rpc, from, documents, cases };
}

const args = {
  caseId: "case-1",
  documentType: "stage1_request" as const,
  documentId: "doc-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("stale-claim reclamation", () => {
  it("claims through the RPC with the shared staleness threshold", async () => {
    const client = serviceClient({
      claim: { data: [{ document_id: "doc-1", reclaimed: false }], error: null },
    });
    createServiceClient.mockReturnValue(client);

    await runDocumentGeneration(args);

    expect(client.rpc).toHaveBeenCalledWith("claim_document_generation", {
      doc_id: "doc-1",
      stale_seconds: STALE_CLAIM_SECONDS,
    });
  });

  it("proceeds when the RPC reclaims a row that was stuck in 'generating'", async () => {
    // This is the case the old `.in(['pending','failed'])` filter could never
    // match: a row whose worker died mid-flight. The claim must succeed.
    const client = serviceClient({
      claim: { data: [{ document_id: "doc-1", reclaimed: true }], error: null },
    });
    createServiceClient.mockReturnValue(client);

    const outcome = await runDocumentGeneration(args);

    // The case lookup is stubbed to fail, so it lands in the catch — which is
    // what proves the claim was granted and the body ran.
    expect(outcome.status).toBe("failed");
    expect(client.documents.update).toHaveBeenCalledWith(
      expect.objectContaining({ generation_status: "failed" })
    );
  });

  it("records the failure reason on the row so retry becomes reachable", async () => {
    const client = serviceClient({
      claim: { data: [{ document_id: "doc-1", reclaimed: false }], error: null },
    });
    createServiceClient.mockReturnValue(client);

    const outcome = await runDocumentGeneration(args);

    expect(outcome).toMatchObject({ status: "failed", documentId: "doc-1" });
    const update = client.documents.update as ReturnType<typeof vi.fn>;
    expect(update.mock.calls[0][0].generation_error).toContain("Case not found");
  });
});

describe("refused claims are reported honestly", () => {
  it("returns in_flight when a live generation still holds the claim", async () => {
    // Previously this path returned HTTP 200 "Document generated" — success
    // plus an eternal spinner.
    const client = serviceClient({
      claim: { data: [], error: null },
      documentRow: { data: { generation_status: "generating" }, error: null },
    });
    createServiceClient.mockReturnValue(client);

    expect((await runDocumentGeneration(args)).status).toBe("in_flight");
  });

  it("returns already_ready for a finished document", async () => {
    const client = serviceClient({
      claim: { data: [], error: null },
      documentRow: { data: { generation_status: "ready" }, error: null },
    });
    createServiceClient.mockReturnValue(client);

    expect((await runDocumentGeneration(args)).status).toBe("already_ready");
  });

  it("returns not_found when the row is gone", async () => {
    const client = serviceClient({
      claim: { data: [], error: null },
      documentRow: { data: null, error: null },
    });
    createServiceClient.mockReturnValue(client);

    expect((await runDocumentGeneration(args)).status).toBe("not_found");
  });

  it("propagates an RPC error rather than silently reporting success", async () => {
    const client = serviceClient({
      claim: { data: null, error: { message: "rpc exploded" } },
    });
    createServiceClient.mockReturnValue(client);

    await expect(runDocumentGeneration(args)).rejects.toMatchObject({
      message: "rpc exploded",
    });
  });
});
