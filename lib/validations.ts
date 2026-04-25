import { z } from "zod";

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

export const intakeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dob: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().default("NY"),
  zip: z.string().optional(),
  mltc: z.string().min(1, "MLTC is required"),
  currentHours: z.coerce.number().int().min(0),
  currentDays: z.coerce.number().int().min(0),
  requestedHours: z.coerce.number().int().positive("Requested hours must be positive"),
  requestedDays: z.coerce.number().int().positive("Requested days must be positive"),
  conditions: z.array(z.string()).default([]),
  otherConditions: z.string().optional(),
  changeDescription: z.string().min(1, "Please describe what has changed recently"),
  adlLevels: z
    .record(z.string(), z.enum(["independent", "some_help", "full_help"]))
    .default({}),
  adlNotes: z.string().optional(),
});

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

export const commentSchema = z.object({
  text: z.string().trim().min(1, "Comment cannot be empty").max(5000),
});
