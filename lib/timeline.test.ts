import { describe, expect, it } from "vitest";
import { deriveTimeline, type TimelineEntry } from "@/lib/timeline";
import type { Document, GenerationStatus } from "@/types";
import type { StagePaymentGate } from "@/lib/billing/payment-required";

const CASE_ID = "11111111-2222-3333-4444-555555555555";
const CREATED_AT = "2026-03-01T10:00:00.000Z";
const UPDATED_AT = "2026-03-04T10:00:00.000Z";

const GATE: StagePaymentGate = { caseId: CASE_ID, stage: 1, amount: 9900 };

/** The exact placeholder rows intake writes (app/api/intake/route.ts). */
function generatedDoc(
  name: string,
  generation_status: GenerationStatus | null,
  overrides: Partial<Document> = {}
): Document {
  return {
    id: `doc-${name}`,
    case_id: CASE_ID,
    name,
    type: "generated",
    stage: 1,
    status: generation_status === "ready" ? "ready" : "pending",
    format: "letter",
    storage_path: null,
    ocr_text: null,
    content: generation_status === "ready" ? "Dear Care Manager," : null,
    version: 1,
    generation_status,
    generation_error: null,
    ocr_status: null,
    ocr_error: null,
    created_at: CREATED_AT,
    updated_at: generation_status === "ready" ? UPDATED_AT : CREATED_AT,
    ...overrides,
  };
}

function placeholders(status: GenerationStatus | null): Document[] {
  return [
    generatedDoc("Request for Increase in Plan of Care", status),
    generatedDoc("LOMN Request Template (for your Doctor)", status),
  ];
}

function find(entries: TimelineEntry[], fragment: string): TimelineEntry {
  const entry = entries.find((e) => e.text.includes(fragment));
  if (!entry) {
    throw new Error(
      `No timeline entry matching "${fragment}" in: ${entries
        .map((e) => e.text)
        .join(" | ")}`
    );
  }
  return entry;
}

function generatedClaims(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((e) => / generated$/.test(e.text));
}

describe("deriveTimeline — generated documents", () => {
  it("does NOT claim documents are generated when the stage fee is unpaid", () => {
    // The reported bug: intake creates both rows as `pending` placeholders, so
    // an unpaid case showed two green "… generated" entries next to a card
    // saying nothing was generating.
    const entries = deriveTimeline({
      documents: placeholders("pending"),
      caseCreatedAt: CREATED_AT,
      paymentGate: GATE,
    });

    expect(generatedClaims(entries)).toHaveLength(0);
    expect(entries.some((e) => e.state === "done" && e.text.includes("Request")))
      .toBe(false);

    for (const label of ["Request letter", "LOMN template"]) {
      const entry = find(entries, label);
      expect(entry.state).toBe("blocked");
      expect(entry.date).toBe("Pending");
      expect(entry.text).toContain("stage fee is paid");
    }
  });

  it("marks a document generated only when generation_status is ready", () => {
    const entries = deriveTimeline({
      documents: placeholders("ready"),
      caseCreatedAt: CREATED_AT,
      paymentGate: null,
    });

    const request = find(entries, "Request letter");
    expect(request.state).toBe("done");
    expect(request.text).toBe("Request letter generated");
    // Dated from generation completion, not from the intake placeholder insert.
    expect(request.date).toBe("Mar 4");

    expect(find(entries, "LOMN template").state).toBe("done");
    expect(generatedClaims(entries)).toHaveLength(2);
  });

  it("shows a failed generation as failed, never as generated", () => {
    const [request, lomn] = placeholders("pending");
    const entries = deriveTimeline({
      documents: [
        { ...request, generation_status: "failed", generation_error: "boom" },
        lomn,
      ],
      caseCreatedAt: CREATED_AT,
      paymentGate: null,
    });

    const entry = find(entries, "Request letter");
    expect(entry.state).toBe("failed");
    expect(entry.date).toBe("Failed");
    expect(entry.text).toContain("couldn't be generated");
    expect(generatedClaims(entries)).toHaveLength(0);
  });

  it("shows an in-flight generation as in progress, never as generated", () => {
    const entries = deriveTimeline({
      documents: placeholders("generating"),
      caseCreatedAt: CREATED_AT,
      paymentGate: null,
    });

    for (const label of ["Request letter", "LOMN template"]) {
      const entry = find(entries, label);
      expect(entry.state).toBe("in_progress");
      expect(entry.date).toBe("In progress");
    }
    expect(generatedClaims(entries)).toHaveLength(0);
  });

  it("distinguishes paid-but-pending from unpaid-and-pending", () => {
    const paid = find(
      deriveTimeline({
        documents: placeholders("pending"),
        caseCreatedAt: CREATED_AT,
        paymentGate: null,
      }),
      "Request letter"
    );
    expect(paid.state).toBe("upcoming");
    expect(paid.text).toContain("not generated yet");

    const unpaid = find(
      deriveTimeline({
        documents: placeholders("pending"),
        caseCreatedAt: CREATED_AT,
        paymentGate: GATE,
      }),
      "Request letter"
    );
    expect(unpaid.state).toBe("blocked");
  });

  it("treats a pre-migration row with content as generated", () => {
    // Migration 009 backfilled `ready`, but a null status with content is still
    // a genuinely generated document.
    const entries = deriveTimeline({
      documents: [
        generatedDoc("Request for Increase in Plan of Care", null, {
          content: "Dear Care Manager,",
          status: "ready",
          updated_at: UPDATED_AT,
        }),
      ],
      caseCreatedAt: CREATED_AT,
    });

    expect(find(entries, "Request letter").state).toBe("done");
  });

  it("omits document entries entirely when no rows exist", () => {
    const entries = deriveTimeline({
      documents: [],
      caseCreatedAt: CREATED_AT,
    });

    expect(entries.some((e) => e.text.includes("Request letter"))).toBe(false);
    expect(entries.some((e) => e.text.includes("LOMN template"))).toBe(false);
  });
});

describe("deriveTimeline — non-document entries", () => {
  it("always reports intake as completed, dated from case creation", () => {
    const entries = deriveTimeline({
      documents: placeholders("pending"),
      caseCreatedAt: CREATED_AT,
      paymentGate: GATE,
    });

    expect(entries[0]).toEqual({
      date: "Mar 1",
      text: "Intake completed",
      state: "done",
    });
  });

  it("marks an uploaded document as uploaded even while OCR is pending", () => {
    const upload: Document = {
      ...generatedDoc("LOMN from Dr. Smith", null),
      type: "uploaded",
      status: "uploaded",
      format: "pdf",
      storage_path: "case/lomn.pdf",
      ocr_status: "pending",
      created_at: UPDATED_AT,
    };

    const entries = deriveTimeline({
      documents: [...placeholders("ready"), upload],
      caseCreatedAt: CREATED_AT,
    });

    expect(find(entries, "LOMN from Dr. Smith uploaded")).toEqual({
      date: "Mar 4",
      text: "LOMN from Dr. Smith uploaded",
      state: "done",
    });
    // The signed-LOMN step is satisfied by that upload.
    expect(entries.some((e) => e.text === "Upload signed LOMN")).toBe(false);
  });

  it("keeps the signed-LOMN step upcoming until a LOMN is uploaded", () => {
    const entries = deriveTimeline({
      documents: placeholders("ready"),
      caseCreatedAt: CREATED_AT,
    });

    expect(find(entries, "Upload signed LOMN").state).toBe("upcoming");
  });

  it("does not show submission or determination as done on an in-progress stage 1", () => {
    const entries = deriveTimeline({
      documents: placeholders("pending"),
      caseCreatedAt: CREATED_AT,
      stageStatus: "in_progress",
      currentStage: 1,
      paymentGate: GATE,
    });

    expect(find(entries, "Finalize & submit")).toMatchObject({
      state: "upcoming",
      date: "—",
    });
    expect(find(entries, "Await MLTC determination")).toMatchObject({
      state: "upcoming",
      date: "—",
    });
  });

  it("marks submission done and determination in progress once submitted", () => {
    const entries = deriveTimeline({
      documents: placeholders("ready"),
      caseCreatedAt: CREATED_AT,
      stageStatus: "submitted",
      currentStage: 1,
    });

    expect(find(entries, "Finalize & submit").state).toBe("done");
    expect(find(entries, "Await MLTC determination").state).toBe("in_progress");
  });

  it("marks both done once the MLTC has responded", () => {
    const entries = deriveTimeline({
      documents: placeholders("ready"),
      caseCreatedAt: CREATED_AT,
      stageStatus: "responded",
      currentStage: 1,
    });

    expect(find(entries, "Finalize & submit").state).toBe("done");
    expect(find(entries, "MLTC determination received").state).toBe("done");
  });

  it("treats a case that advanced past stage 1 as submitted and determined", () => {
    const entries = deriveTimeline({
      documents: placeholders("ready"),
      caseCreatedAt: CREATED_AT,
      stageStatus: "in_progress",
      currentStage: 2,
    });

    expect(find(entries, "Finalize & submit").state).toBe("done");
    expect(find(entries, "MLTC determination received").state).toBe("done");
  });
});
