import { describe, expect, it } from "vitest";
import {
  INTAKE_REVIEW_STEP,
  INTAKE_STEP_FIELDS,
  intakeSchema,
  intakeStepSchema,
  isIntakeFieldRequired,
  stepForIntakeField,
  toIntakeFieldErrors,
  validateIntakeStep,
} from "@/lib/validations";

const completeIntake = {
  firstName: "Jane",
  lastName: "Doe",
  dob: "1948-04-11",
  phone: "(212) 555-0000",
  email: "",
  address: "123 Main Street, Apt 4B",
  city: "Brooklyn",
  state: "NY",
  zip: "11201",
  mltc: "healthfirst",
  currentHours: 4,
  currentDays: 5,
  requestedHours: 8,
  requestedDays: 7,
  conditions: ["Diabetes"],
  otherConditions: "",
  changeDescription: "She fell in January and can no longer walk unassisted.",
  adlLevels: { bathing: "full_help" },
  adlNotes: "",
};

describe("intakeSchema", () => {
  it("accepts a complete intake", () => {
    expect(intakeSchema.safeParse(completeIntake).success).toBe(true);
  });

  it("rejects a blank change description", () => {
    const parsed = intakeSchema.safeParse({
      ...completeIntake,
      changeDescription: "   ",
    });
    expect(parsed.success).toBe(false);
    expect(toIntakeFieldErrors(parsed.error!.issues)).toEqual({
      changeDescription: "Please describe what has changed recently",
    });
  });

  it("reports an unselected hours dropdown as required, not 'not positive'", () => {
    // The form models an unselected dropdown as "". A bare z.coerce.number()
    // turns that into 0 and blames .positive().
    const parsed = intakeSchema.safeParse({
      ...completeIntake,
      requestedHours: "",
    });
    expect(parsed.success).toBe(false);
    expect(toIntakeFieldErrors(parsed.error!.issues)).toEqual({
      requestedHours: "Requested hours per day is required",
    });
  });

  it("still coerces numeric strings from the select elements", () => {
    const parsed = intakeSchema.safeParse({
      ...completeIntake,
      requestedHours: "8",
      currentHours: "4",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data!.requestedHours).toBe(8);
  });
});

describe("step mapping", () => {
  it("covers every schema field exactly once", () => {
    const mapped = INTAKE_STEP_FIELDS.flat();
    expect([...mapped].sort()).toEqual(Object.keys(intakeSchema.shape).sort());
    expect(new Set(mapped).size).toBe(mapped.length);
  });

  it("puts changeDescription on the Medical History step", () => {
    expect(stepForIntakeField("changeDescription")).toBe(1);
    expect(stepForIntakeField("firstName")).toBe(0);
    expect(stepForIntakeField("adlNotes")).toBe(2);
  });

  it("falls back to the review step for unknown fields", () => {
    expect(stepForIntakeField("nope")).toBe(INTAKE_REVIEW_STEP);
  });

  it("picks only the fields of the requested step", () => {
    expect(Object.keys(intakeStepSchema(1).shape).sort()).toEqual([
      "changeDescription",
      "conditions",
      "otherConditions",
    ]);
  });
});

describe("validateIntakeStep", () => {
  it("blocks step 1 when the change description is blank", () => {
    expect(validateIntakeStep(1, { ...completeIntake, changeDescription: "" }))
      .toEqual({
        changeDescription: "Please describe what has changed recently",
      });
  });

  it("does not leak other steps' errors into the current step", () => {
    // Step 0 is entirely blank, but validating step 1 must only complain
    // about step 1 — otherwise the user is blocked by invisible fields.
    const errors = validateIntakeStep(1, {
      changeDescription: "Her mobility got much worse.",
    });
    expect(errors).toEqual({});
  });

  it("passes a complete step", () => {
    expect(validateIntakeStep(0, completeIntake)).toEqual({});
    expect(validateIntakeStep(INTAKE_REVIEW_STEP, completeIntake)).toEqual({});
  });
});

describe("isIntakeFieldRequired", () => {
  it("agrees with the schema for every field the UI marks required", () => {
    expect(isIntakeFieldRequired("changeDescription")).toBe(true);
    expect(isIntakeFieldRequired("firstName")).toBe(true);
    expect(isIntakeFieldRequired("requestedHours")).toBe(true);
    expect(isIntakeFieldRequired("dob")).toBe(true);
  });

  it("does not mark optional or defaulted fields as required", () => {
    expect(isIntakeFieldRequired("email")).toBe(false);
    expect(isIntakeFieldRequired("state")).toBe(false);
    expect(isIntakeFieldRequired("otherConditions")).toBe(false);
    expect(isIntakeFieldRequired("adlNotes")).toBe(false);
    expect(isIntakeFieldRequired("conditions")).toBe(false);
  });
});

describe("toIntakeFieldErrors", () => {
  it("keeps the first message per field and ignores unknown paths", () => {
    expect(
      toIntakeFieldErrors([
        { path: ["zip"], message: "first" },
        { path: ["zip"], message: "second" },
        { path: ["bogus"], message: "ignored" },
        { path: [], message: "ignored too" },
      ])
    ).toEqual({ zip: "first" });
  });
});
