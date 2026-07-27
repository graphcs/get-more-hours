import type { BillingStatus } from "@/types";

// ─── Medical Conditions (18) ───
export const MEDICAL_CONDITIONS = [
  "Alzheimer's / Dementia",
  "Parkinson's Disease",
  "Stroke / Post-Stroke",
  "Heart Disease / CHF",
  "Diabetes",
  "COPD / Breathing Issues",
  "Arthritis / Joint Problems",
  "Cancer",
  "Kidney Disease / Dialysis",
  "Vision Loss / Blindness",
  "Hearing Loss",
  "Depression / Anxiety",
  "Fall Risk / Balance Issues",
  "Incontinence",
  "Chronic Pain",
  "Mobility Impairment",
  "Wound Care Needs",
  "Feeding Tube / Special Nutrition",
] as const;

// ─── ADL Categories (12) ───
export const ADL_CATEGORIES = [
  { id: "bathing", label: "Bathing & Showering", description: "Getting in/out of tub or shower, washing body", icon: "🚿" },
  { id: "dressing", label: "Getting Dressed", description: "Putting on and taking off clothes, shoes, buttons, zippers", icon: "👔" },
  { id: "toileting", label: "Toileting", description: "Getting to/from the toilet, cleaning oneself", icon: "🚽" },
  { id: "transferring", label: "Moving Around", description: "Getting in/out of bed, standing up from a chair, walking", icon: "🚶" },
  { id: "eating", label: "Eating & Drinking", description: "Feeding oneself, cutting food, holding utensils", icon: "🍽️" },
  { id: "medication", label: "Taking Medication", description: "Remembering, organizing, and taking prescribed medicines", icon: "💊" },
  { id: "housekeeping", label: "Light Housekeeping", description: "Tidying up, laundry, washing dishes", icon: "🏠" },
  { id: "cooking", label: "Meal Preparation", description: "Planning meals, cooking, using the kitchen safely", icon: "🍳" },
  { id: "shopping", label: "Shopping & Errands", description: "Getting groceries, picking up prescriptions", icon: "🛒" },
  { id: "transportation", label: "Transportation", description: "Getting to medical appointments, pharmacy, etc.", icon: "🚗" },
  { id: "communication", label: "Communication", description: "Using the phone, understanding conversations", icon: "📞" },
  { id: "supervision", label: "Safety & Supervision", description: "Wandering risk, leaving stove on, needs someone present", icon: "👁️" },
] as const;

// ─── ADL Levels ───
export const ADL_LEVELS = [
  { value: "independent", label: "Can do alone" },
  { value: "some_help", label: "Needs some help" },
  { value: "full_help", label: "Cannot do without help" },
] as const;

// ─── MLTC Companies ───

/**
 * Why a plan is no longer offered on the intake form. Surfaced to staff so an
 * old case reads "this plan closed" rather than "why is there no address?".
 */
export interface MltcRetirement {
  /**
   * ISO date the plan stopped operating, when a source gives one. `null` means
   * the closure is established but the date is not — never guess one.
   */
  date: string | null;
  /** One line, staff-facing, explaining what happened to the plan. */
  reason: string;
}

export interface MltcPlan {
  value: string;
  label: string;
  /** Present only on plans that no longer operate. Absent means selectable. */
  retired?: MltcRetirement;
}

/**
 * EVERY MLTC value that has ever been stored in `cases.mltc`, including plans
 * that have since closed.
 *
 * This list exists to RESOLVE a stored value to a label — it is not the intake
 * dropdown (that is `MLTC_OPTIONS`, derived below). Historical cases keep
 * pointing at closed plans, because we deliberately do not rewrite
 * `cases.mltc`: remapping a member to a successor plan is the owner's data
 * decision, not something we can infer. So a retired entry must never be
 * deleted from here, or those cases would render a raw slug.
 *
 * To take a plan off the intake form, add a `retired` block — do NOT delete the
 * entry. To put a plan on the intake form, add it here without `retired` AND
 * record its address decision in `lib/mltc-addresses.ts`.
 *
 * Roster checked against the NYS DOH MLTC consumer guides — pub. 3339 (NYC),
 * 3340 (rest of state) and 3341 (Long Island), all rev. 10/25, e.g.
 * https://www.health.ny.gov/publications/3339.pdf. Checked: 2026-07-26.
 */
export const MLTC_PLANS = [
  { value: "aetna", label: "Aetna Better Health" },
  { value: "anthem", label: "Anthem BCBS HealthPlus MLTC" },
  { value: "centerlight", label: "CenterLight Healthcare" },
  { value: "centers_plan", label: "Centers Plan for Healthy Living" },
  { value: "elderplan", label: "Elderplan" },
  { value: "fidelis", label: "Fidelis Care at Home" },
  {
    value: "guildnet",
    label: "GuildNet",
    // GuildNet's MLTC plan closed and it is absent from the current NYS DOH
    // plan directory. No source we trust gives a closure date, so `date` is null.
    // Sources: https://www.health.ny.gov/publications/3339.pdf (rev. 10/25,
    //   GuildNet absent); http://health.wnylc.com/health/entry/179/ ("CLOSED").
    // Checked: 2026-07-26.
    retired: {
      date: null,
      reason:
        "GuildNet closed its MLTC plan and no longer appears in the NYS DOH plan directory.",
    },
  },
  { value: "hamaspik", label: "Hamaspik Choice" },
  { value: "healthfirst", label: "Healthfirst" },
  {
    value: "independence",
    label: "Independence Care System",
    // Sources: https://www.health.ny.gov/publications/3339.pdf (rev. 10/25,
    //   absent); http://health.wnylc.com/health/entry/179/
    //   ("CLOSED (now a health home)").
    // Checked: 2026-07-26.
    retired: {
      date: null,
      reason:
        "Independence Care System closed its MLTC plan and converted to a health home.",
    },
  },
  { value: "metroplus", label: "MetroPlusHealth MLTC" },
  { value: "molina", label: "Molina Healthcare" },
  // NYS DOH still lists this plan as "RiverSpring at Home"; the plan itself
  // rebranded to ElderServe at Home (riverspringathome.org now redirects to
  // elderserveathome.org). Both names are in the label so a member recognises
  // it and a letter carries the current legal name. Checked: 2026-07-26.
  {
    value: "riverspring",
    label: "ElderServe at Home (formerly RiverSpring at Home)",
  },
  { value: "senior_whole", label: "Senior Whole Health" },
  {
    value: "unitedhealth",
    label: "UnitedHealthcare",
    // Sources: http://health.wnylc.com/health/entry/179/ ("CLOSED 9/1/19");
    //   https://www.health.ny.gov/publications/3339.pdf (rev. 10/25, absent).
    // Checked: 2026-07-26.
    retired: {
      date: "2019-09-01",
      reason:
        "UnitedHealthcare Personal Assist, its New York MLTC plan, closed on 2019-09-01; UnitedHealthcare has no current NY MLTC plan.",
    },
  },
  { value: "villagecaremax", label: "VillageCareMAX" },
  { value: "vnsny", label: "VNS Health" },
  {
    value: "wellcare",
    label: "WellCare",
    // Source: https://www.health.ny.gov/publications/3339.pdf (rev. 10/25) —
    //   "Wellcare Fidelis MAP" appears only under Medicaid Advantage Plus; no
    //   partial-capitation MLTC plan carries the WellCare name.
    // Checked: 2026-07-26.
    retired: {
      date: null,
      reason:
        "No MLTC plan operates under the WellCare name in New York; WellCare's NY business sits under the Wellcare Fidelis brand, and which plan a self-described WellCare member is enrolled in cannot be inferred.",
    },
  },
  { value: "other", label: "Other" },
] as const satisfies readonly MltcPlan[];

export type MltcPlanValue = (typeof MLTC_PLANS)[number]["value"];

const MLTC_PLAN_BY_VALUE: ReadonlyMap<string, MltcPlan> = new Map<
  string,
  MltcPlan
>(MLTC_PLANS.map((plan) => [plan.value, plan]));

/**
 * The intake dropdown: plans a NEW case may be filed against.
 *
 * Never use this to turn a stored `cases.mltc` value into a label — closed
 * plans are absent by design and the lookup comes back empty. Use
 * {@link getMltcLabel} for that.
 */
export const MLTC_OPTIONS: readonly MltcPlan[] = MLTC_PLANS.filter(
  (plan) => !("retired" in plan)
);

/**
 * Display label for any stored `cases.mltc` value, including retired plans and
 * values we have never heard of (those fall back to the raw value so nothing
 * ever renders blank). This is the ONLY correct way to label a stored value.
 */
export function getMltcLabel(value: string): string {
  return MLTC_PLAN_BY_VALUE.get(value)?.label ?? value;
}

/** Retirement details for a stored value, or `null` if the plan still runs. */
export function getMltcRetirement(value: string): MltcRetirement | null {
  return MLTC_PLAN_BY_VALUE.get(value)?.retired ?? null;
}

// ─── Stage Labels ───
export const STAGE_LABELS: Record<number, string> = {
  1: "Request for Increase",
  2: "Internal Appeal",
  3: "Fair Hearing",
};

// ─── Stage Status Map ───
export const STATUS_MAP: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  pending: { label: "Pending", color: "#9CA3AF", bg: "#F3F4F6", border: "#E5E7EB" },
  in_progress: { label: "In Progress", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  submitted: { label: "Submitted", color: "#1E40AF", bg: "#EFF6FF", border: "#93C5FD" },
  responded: { label: "Responded", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  complete: { label: "Complete", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
};

// ─── Billing Status Map ───
export const BILLING_STATUS_MAP: Record<
  BillingStatus,
  { label: string; className: string }
> = {
  paid: {
    label: "Paid",
    className: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-600 border-amber-200",
  },
  refunded: {
    label: "Refunded",
    className: "bg-gray-100 text-gray-500 border-gray-200",
  },
  failed: {
    label: "Failed",
    className: "bg-red-50 text-red-600 border-red-200",
  },
  disputed: {
    label: "Disputed",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  expired: {
    label: "Expired",
    className: "bg-gray-100 text-gray-500 border-gray-200",
  },
};

// ─── Pricing (in cents) ───
export const PRICING = {
  stage1: 9900,
  stage2: 14900,
  stage3: 29900,
  whiteGlove: 19900,
} as const;

// ─── Colors ───
export const COLORS = {
  blue: "#1E40AF",
  blueSoft: "#EFF6FF",
  blueLight: "#DBEAFE",
  blueBorder: "#93C5FD",
  navy: "#0F172A",
  navyMid: "#1E293B",
  gray700: "#374151",
  gray500: "#6B7280",
  gray400: "#9CA3AF",
  gray300: "#D1D5DB",
  gray200: "#E5E7EB",
  gray100: "#F3F4F6",
  gray50: "#F9FAFB",
  white: "#FFFFFF",
  green: "#059669",
  greenSoft: "#ECFDF5",
  greenBorder: "#A7F3D0",
  amber: "#D97706",
  amberSoft: "#FFFBEB",
  amberBorder: "#FDE68A",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  redBorder: "#FECACA",
  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",
  purpleBorder: "#DDD6FE",
} as const;
