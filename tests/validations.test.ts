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
    dob: "1948-04-11",
    phone: "(212) 555-0000",
    address: "123 Main Street, Apt 4B",
    city: "Brooklyn",
    zip: "11201",
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

describe("intakeSchema — fields the form marks required", () => {
  // The intake UI has always rendered a red asterisk on these, but the schema
  // used to accept them as `.optional()`. PR 2 makes the schema match the UI,
  // so the asterisk and the enforced behaviour can no longer drift apart.
  const requiredNow = {
    dob: "Date of birth is required",
    phone: "Phone number is required",
    address: "Address is required",
    city: "City is required",
    zip: "ZIP code is required",
  } as const;

  for (const [field, message] of Object.entries(requiredNow)) {
    it(`rejects a missing ${field}`, () => {
      const r = intakeSchema.safeParse(validIntake({ [field]: undefined }));
      expect(r.success).toBe(false);
      expect(r.error?.issues.map((i) => i.message)).toContain(message);
    });

    it(`rejects a whitespace-only ${field}`, () => {
      const r = intakeSchema.safeParse(validIntake({ [field]: "   " }));
      expect(r.success).toBe(false);
      expect(r.error?.issues.map((i) => i.message)).toContain(message);
      expect(r.error?.issues.some((i) => i.path[0] === field)).toBe(true);
    });
  }
});

// ── The coercion trap, now fixed ─────────────────────────────────────────────
// `types/index.ts` types the intake form's numeric fields as `number | ""` and
// seeds them with `""`. The schema used a bare `z.coerce.number()`, and
// `Number("")` is `0` — so a *blank* dropdown never failed as "missing". It
// silently became 0, passing `.min(0)` on the current-* fields outright and
// tripping `.positive()` on the requested-* fields with a baffling "must be
// positive" message about a field the user had never touched.
//
// PR 2 normalises ""/null/undefined to undefined before coercing, so blank now
// reports as plainly required. Real numbers and numeric strings from an HTML
// form post still coerce exactly as before. These tests pin the fix.
describe("intakeSchema — blank numeric fields report as required", () => {
  it('rejects "" on currentHours/currentDays instead of reading it as 0', () => {
    const r = intakeSchema.safeParse(
      validIntake({ currentHours: "", currentDays: "" })
    );
    expect(r.success).toBe(false);
    const messages = r.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toContain("Current hours per day is required");
    expect(messages).toContain("Days per week is required");
  });

  it('rejects "" on requestedHours/requestedDays as required, not "not positive"', () => {
    const r = intakeSchema.safeParse(
      validIntake({ requestedHours: "", requestedDays: "" })
    );
    expect(r.success).toBe(false);
    const messages = r.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toContain("Requested hours per day is required");
    expect(messages).toContain("Requested days per week is required");
    // The old, confusing wording must not come back for an untouched field.
    expect(messages).not.toContain("Requested hours must be positive");
    expect(messages.some((m) => m.includes("greater than zero"))).toBe(false);
  });

  it("reports the blank field on its own path so the UI can highlight it", () => {
    const r = intakeSchema.safeParse(validIntake({ requestedHours: "" }));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toContain("requestedHours");
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
    const zero = intakeSchema.safeParse(validIntake({ requestedHours: 0 }));
    expect(zero.success).toBe(false);
    // An explicit 0 is a real answer, so it still gets the range message —
    // only *blank* switched to "is required".
    expect(zero.error?.issues.map((i) => i.message)).toContain(
      "Requested hours per day must be greater than zero"
    );
    expect(intakeSchema.safeParse(validIntake({ requestedDays: -1 })).success).toBe(false);
  });

  it("rejects negatives on the current-* fields but allows an explicit 0", () => {
    expect(intakeSchema.safeParse(validIntake({ currentHours: -1 })).success).toBe(false);
    const zero = intakeSchema.safeParse(validIntake({ currentHours: 0 }));
    expect(zero.success).toBe(true);
    expect(zero.data?.currentHours).toBe(0);
  });

  it("treats null as missing rather than as 0 (Number(null) === 0)", () => {
    // The old footgun: a null from JSON used to sail through as a real zero.
    const r = intakeSchema.safeParse(validIntake({ currentHours: null }));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toContain(
      "Current hours per day is required"
    );
  });

  it("does NOT flag requestedHours <= currentHours — no cross-field rule exists", () => {
    // Asking for fewer hours than you already have is nonsense but currently
    // valid. Still true after PR 2: no cross-field refinement was added.
    const r = intakeSchema.safeParse(
      validIntake({ currentHours: 40, requestedHours: 10 })
    );
    expect(r.success).toBe(true);
  });
});
