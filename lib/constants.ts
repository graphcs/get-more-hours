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
export const MLTC_OPTIONS = [
  { value: "aetna", label: "Aetna Better Health" },
  { value: "centerlight", label: "CenterLight Healthcare" },
  { value: "elderplan", label: "Elderplan" },
  { value: "fidelis", label: "Fidelis Care at Home" },
  { value: "guildnet", label: "GuildNet" },
  { value: "healthfirst", label: "Healthfirst" },
  { value: "independence", label: "Independence Care System" },
  { value: "molina", label: "Molina Healthcare" },
  { value: "senior_whole", label: "Senior Whole Health" },
  { value: "unitedhealth", label: "UnitedHealthcare" },
  { value: "vnsny", label: "VNS Health" },
  { value: "wellcare", label: "WellCare" },
  { value: "other", label: "Other" },
] as const;

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
