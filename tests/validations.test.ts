import { describe, expect, it } from "vitest";
import {
  commentSchema,
  contactSchema,
  intakeSchema,
  loginSchema,
  profileUpdateSchema,
  registerSchema,
  stageUpdateSchema,
} from "@/lib/validations";

/** Minimal payload that satisfies every required field of intakeSchema. */
function validIntake(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    mltc: "VNS Health",
    currentHours: 20,
    currentDays: 5,
    requestedHours: 40,
    requestedDays: 7,
    changeDescription: "Mobility has declined since the last assessment.",
    ...overrides,
  };
}

describe("loginSchema", () => {
  it("accepts a well-formed email and a 6+ char password", () => {
    const r = loginSchema.safeParse({ email: "a@b.com", password: "hunter2" });
    expect(r.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "hunter2" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Invalid email address");
  });

  it("rejects a password shorter than 6 characters", () => {
    const r = loginSchema.safeParse({ email: "a@b.com", password: "12345" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Password must be at least 6 characters");
  });
});

describe("registerSchema", () => {
  const base = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "hunter2",
    confirmPassword: "hunter2",
  };

  it("accepts a matching password pair", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("reports the mismatch on the confirmPassword path", () => {
    const r = registerSchema.safeParse({ ...base, confirmPassword: "hunter3" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(r.error?.issues[0]?.message).toBe("Passwords don't match");
  });

  it("treats phone as optional", () => {
    expect(registerSchema.safeParse({ ...base, phone: undefined }).success).toBe(true);
  });
});

describe("contactSchema", () => {
  it("requires a message of at least 10 characters", () => {
    const r = contactSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      message: "too short",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Message must be at least 10 characters");
  });
});

describe("profileUpdateSchema", () => {
  it("trims the name before applying the min length", () => {
    const r = profileUpdateSchema.safeParse({ name: "  Ada  " });
    expect(r.success).toBe(true);
    expect(r.data?.name).toBe("Ada");
  });

  it("allows an empty-string phone (the form's cleared state)", () => {
    expect(profileUpdateSchema.safeParse({ name: "Ada", phone: "" }).success).toBe(true);
  });
});

describe("stageUpdateSchema", () => {
  it("rejects an empty object", () => {
    const r = stageUpdateSchema.safeParse({});
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Provide currentStage or stageStatus");
  });

  it("rejects a stage outside 1-3", () => {
    expect(stageUpdateSchema.safeParse({ currentStage: 4 }).success).toBe(false);
  });

  it("accepts stageStatus alone", () => {
    expect(stageUpdateSchema.safeParse({ stageStatus: "submitted" }).success).toBe(true);
  });
});

describe("commentSchema", () => {
  it("rejects whitespace-only text after trimming", () => {
    const r = commentSchema.safeParse({ text: "   " });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Comment cannot be empty");
  });
});

describe("intakeSchema — happy path & defaults", () => {
  it("accepts a complete payload", () => {
    const r = intakeSchema.safeParse(validIntake());
    expect(r.success).toBe(true);
  });

  it("defaults state to NY and conditions/adlLevels to empty", () => {
    const r = intakeSchema.safeParse(validIntake());
    expect(r.data?.state).toBe("NY");
    expect(r.data?.conditions).toEqual([]);
    expect(r.data?.adlLevels).toEqual({});
  });

  it("allows email to be omitted or the empty string", () => {
    expect(intakeSchema.safeParse(validIntake({ email: "" })).success).toBe(true);
    expect(intakeSchema.safeParse(validIntake({ email: undefined })).success).toBe(true);
    expect(intakeSchema.safeParse(validIntake({ email: "nope" })).success).toBe(false);
  });

  it("requires a non-empty changeDescription", () => {
    const r = intakeSchema.safeParse(validIntake({ changeDescription: "" }));
    expect(r.success).toBe(false);
    expect(
      r.error?.issues.some(
        (i) => i.message === "Please describe what has changed recently"
      )
    ).toBe(true);
  });
});

// ── The coercion trap ────────────────────────────────────────────────────────
// `types/index.ts` types the intake form's numeric fields as `number | ""` and
// seeds them with `""`. The schema uses `z.coerce.number()`, and `Number("")`
// is `0` — so a *blank* field never fails as "missing", it silently becomes 0
// and then only trips `.positive()` on the requested-* fields. currentHours /
// currentDays use `.min(0)`, so a blank there passes as a real zero.
//
// These tests pin that behaviour deliberately. PR 2 (intake validation) changes
// the client/server contract here; if it changes the schema, these expectations
// must be updated in the same PR rather than silently drifting.
describe("intakeSchema — z.coerce.number() blank-field behaviour", () => {
  it('coerces "" to 0 for currentHours/currentDays, which PASSES .min(0)', () => {
    const r = intakeSchema.safeParse(
      validIntake({ currentHours: "", currentDays: "" })
    );
    expect(r.success).toBe(true);
    expect(r.data?.currentHours).toBe(0);
    expect(r.data?.currentDays).toBe(0);
  });

  it('coerces "" to 0 for requestedHours/requestedDays, which FAILS .positive()', () => {
    const r = intakeSchema.safeParse(
      validIntake({ requestedHours: "", requestedDays: "" })
    );
    expect(r.success).toBe(false);
    const messages = r.error?.issues.map((i) => i.message) ?? [];
    // Note: the failure surfaces as a "must be positive" message, NOT as a
    // "required" message — the field looks filled-in to the schema.
    expect(messages).toContain("Requested hours must be positive");
    expect(messages).toContain("Requested days must be positive");
  });

  it("coerces numeric strings from a normal HTML form post", () => {
    const r = intakeSchema.safeParse(
      validIntake({
        currentHours: "20",
        currentDays: "5",
        requestedHours: "40",
        requestedDays: "7",
      })
    );
    expect(r.success).toBe(true);
    expect(r.data?.currentHours).toBe(20);
    expect(r.data?.requestedHours).toBe(40);
  });

  it("rejects non-numeric strings (NaN is not coercible to a number)", () => {
    expect(
      intakeSchema.safeParse(validIntake({ requestedHours: "abc" })).success
    ).toBe(false);
  });

  it("rejects fractional hours because of .int()", () => {
    expect(
      intakeSchema.safeParse(validIntake({ requestedHours: 12.5 })).success
    ).toBe(false);
  });

  it("rejects explicit 0 and negatives on the requested-* fields", () => {
    expect(intakeSchema.safeParse(validIntake({ requestedHours: 0 })).success).toBe(false);
    expect(intakeSchema.safeParse(validIntake({ requestedDays: -1 })).success).toBe(false);
  });

  it("rejects negatives on the current-* fields but allows 0", () => {
    expect(intakeSchema.safeParse(validIntake({ currentHours: -1 })).success).toBe(false);
    expect(intakeSchema.safeParse(validIntake({ currentHours: 0 })).success).toBe(true);
  });

  it("coerces null to 0 as well (Number(null) === 0)", () => {
    // Documenting a real footgun: a null from JSON is NOT treated as missing.
    const r = intakeSchema.safeParse(validIntake({ currentHours: null }));
    expect(r.success).toBe(true);
    expect(r.data?.currentHours).toBe(0);
  });

  it("does NOT flag requestedHours <= currentHours — no cross-field rule exists", () => {
    // Asking for fewer hours than you already have is nonsense but currently
    // valid. If PR 2 adds a cross-field refinement, flip this expectation there.
    const r = intakeSchema.safeParse(
      validIntake({ currentHours: 40, requestedHours: 10 })
    );
    expect(r.success).toBe(true);
  });
});
