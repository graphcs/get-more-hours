import { z } from "zod";
import { PROMPT_KEYS } from "@/lib/prompts";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export const contactStatusSchema = z.object({
  status: z.enum(["new", "contacted", "resolved"]),
});

/**
 * A required free-text field. The message is attached at the schema level as
 * well as to `.min(1)` so a missing key, a null and an empty string all produce
 * the same human-readable sentence instead of zod's "expected string, received
 * undefined".
 */
const requiredText = (message: string) =>
  z.string({ error: message }).trim().min(1, message);

/**
 * The intake form models unselected number dropdowns as `""` (see
 * `IntakeFormData`). A bare `z.coerce.number()` turns `""` into `0`, which then
 * fails `.positive()` with a confusing "must be positive" message — so blank is
 * normalised to `undefined` first and reported as a plain "is required".
 */
const countField = (label: string, { positive }: { positive: boolean }) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    positive
      ? z.coerce
          .number({ error: `${label} is required` })
          .int(`${label} must be a whole number`)
          .positive(`${label} must be greater than zero`)
      : z.coerce
          .number({ error: `${label} is required` })
          .int(`${label} must be a whole number`)
          .min(0, `${label} cannot be negative`)
  );

export const intakeSchema = z.object({
  firstName: requiredText("First name is required"),
  lastName: requiredText("Last name is required"),
  dob: requiredText("Date of birth is required"),
  phone: requiredText("Phone number is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: requiredText("Address is required"),
  city: requiredText("City is required"),
  state: z.string().default("NY"),
  zip: requiredText("ZIP code is required"),
  mltc: requiredText("MLTC is required"),
  currentHours: countField("Current hours per day", { positive: false }),
  currentDays: countField("Days per week", { positive: false }),
  requestedHours: countField("Requested hours per day", { positive: true }),
  requestedDays: countField("Requested days per week", { positive: true }),
  conditions: z.array(z.string()).default([]),
  otherConditions: z.string().optional(),
  changeDescription: requiredText(
    "Please describe what has changed recently"
  ),
  adlLevels: z
    .record(z.string(), z.enum(["independent", "some_help", "full_help"]))
    .default({}),
  adlNotes: z.string().optional(),
});

export type IntakeField = keyof typeof intakeSchema.shape;

/** Validation errors keyed by intake field name. */
export type IntakeFieldErrors = Partial<Record<IntakeField, string>>;

/**
 * Which fields belong to which wizard step. The order matches
 * `STEP_LABELS` in `components/intake/intake-form.tsx`. Keeping the map here —
 * next to the schema — is what lets both the client wizard and the API agree on
 * where a given error belongs.
 */
export const INTAKE_STEP_FIELDS = [
  [
    "firstName",
    "lastName",
    "dob",
    "phone",
    "email",
    "address",
    "city",
    "state",
    "zip",
    "mltc",
    "currentHours",
    "currentDays",
    "requestedHours",
    "requestedDays",
  ],
  ["conditions", "otherConditions", "changeDescription"],
  ["adlLevels", "adlNotes"],
  [],
] as const satisfies readonly (readonly IntakeField[])[];

export const INTAKE_REVIEW_STEP = INTAKE_STEP_FIELDS.length - 1;

/** A schema covering only the fields shown on `step`. */
export function intakeStepSchema(step: number) {
  const fields = INTAKE_STEP_FIELDS[step] ?? [];
  const mask = Object.fromEntries(fields.map((f) => [f, true as const]));
  return intakeSchema.pick(mask as Record<IntakeField, true>);
}

/** The wizard step that owns `field`, or the review step if it is unknown. */
export function stepForIntakeField(field: string): number {
  const index = INTAKE_STEP_FIELDS.findIndex((fields) =>
    (fields as readonly string[]).includes(field)
  );
  return index === -1 ? INTAKE_REVIEW_STEP : index;
}

/**
 * True when the schema rejects a missing value for `field`. The UI reads this
 * instead of hardcoding asterisks, so the required marker and the enforced
 * behaviour can never drift apart.
 */
export function isIntakeFieldRequired(field: IntakeField): boolean {
  return !intakeSchema.shape[field].safeParse(undefined).success;
}

/** Flatten a zod error into one message per field (first issue wins). */
export function toIntakeFieldErrors(
  issues: readonly { path: PropertyKey[] | readonly PropertyKey[]; message: string }[]
): IntakeFieldErrors {
  const errors: IntakeFieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    if (!(key in intakeSchema.shape)) continue;
    const field = key as IntakeField;
    if (errors[field] === undefined) errors[field] = issue.message;
  }
  return errors;
}

/** Validate a single wizard step. Returns `{}` when the step is complete. */
export function validateIntakeStep(
  step: number,
  data: unknown
): IntakeFieldErrors {
  const parsed = intakeStepSchema(step).safeParse(data);
  return parsed.success ? {} : toIntakeFieldErrors(parsed.error.issues);
}

export const documentUpdateSchema = z
  .object({
    content: z.string().optional(),
    status: z
      .enum(["pending", "ready", "review_needed", "uploaded", "reviewed"])
      .optional(),
    note: z.string().optional(),
  })
  .refine((d) => d.content !== undefined || d.status !== undefined, {
    message: "Nothing to update",
  });

export const crmNoteSchema = z.object({
  caseId: z.string().uuid("Invalid case id"),
  text: z.string().trim().min(1, "Note cannot be empty").max(10000),
});

export const stageUpdateSchema = z
  .object({
    currentStage: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .optional(),
    stageStatus: z
      .enum(["pending", "in_progress", "submitted", "responded", "complete"])
      .optional(),
  })
  .refine(
    (d) => d.currentStage !== undefined || d.stageStatus !== undefined,
    { message: "Provide currentStage or stageStatus" }
  );

export const compSchema = z.object({
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  action: z.enum(["comp", "uncomp"]),
});

export const tierSchema = z.object({
  tier: z.enum(["self_serve", "white_glove"]),
});

export const commentSchema = z.object({
  text: z.string().trim().min(1, "Comment cannot be empty").max(5000),
});

export const systemPromptSchema = z.object({
  key: z.enum(PROMPT_KEYS),
  content: z
    .string()
    .trim()
    .min(1, "Prompt cannot be empty")
    .max(20000, "Prompt must be 20,000 characters or less"),
});
