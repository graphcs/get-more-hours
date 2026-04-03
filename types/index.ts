// ─── Enums / Union Types ───
export type UserRole = "client" | "admin";
export type StageNumber = 1 | 2 | 3;
export type StageStatus = "pending" | "in_progress" | "submitted" | "responded" | "complete";
export type CaseTier = "self_serve" | "white_glove";
export type DocumentType = "generated" | "uploaded";
export type DocumentStatus = "pending" | "ready" | "review_needed" | "uploaded" | "reviewed";
export type DocumentFormat = "letter" | "pdf" | "image";
export type BillingType = "stage_fee" | "white_glove";
export type BillingStatus = "pending" | "paid" | "refunded";
export type AdlLevel = "independent" | "some_help" | "full_help";

// ─── Database Models ───
export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  user_id: string;
  case_number: string;
  current_stage: StageNumber;
  stage_status: StageStatus;
  tier: CaseTier;
  mltc: string;
  current_hours: number;
  current_days: number;
  requested_hours: number;
  requested_days: number;
  created_at: string;
  updated_at: string;
}

export interface IntakeData {
  id: string;
  case_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  conditions: string[];
  other_conditions: string | null;
  change_description: string;
  adl_levels: Record<string, AdlLevel>;
  adl_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  case_id: string;
  name: string;
  type: DocumentType;
  stage: StageNumber;
  status: DocumentStatus;
  format: DocumentFormat | null;
  storage_path: string | null;
  ocr_text: string | null;
  content: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  content: string | null;
  author: string;
  note: string | null;
  created_at: string;
}

export interface DocumentComment {
  id: string;
  document_id: string;
  author_id: string;
  text: string;
  created_at: string;
  // Joined fields
  author?: Profile;
}

export interface BillingRecord {
  id: string;
  case_id: string;
  stage: StageNumber;
  amount: number;
  type: BillingType;
  stripe_payment_id: string | null;
  status: BillingStatus;
  created_at: string;
}

export interface CRMNote {
  id: string;
  case_id: string;
  author_id: string;
  text: string;
  created_at: string;
  // Joined fields
  author?: Profile;
}

// ─── Form Types ───
export interface IntakeFormData {
  // Step 1: Personal Info
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  mltc: string;
  currentHours: number | "";
  currentDays: number | "";
  requestedHours: number | "";
  requestedDays: number | "";
  // Step 2: Medical Conditions
  conditions: string[];
  otherConditions: string;
  changeDescription: string;
  // Step 3: ADLs
  adlLevels: Record<string, AdlLevel>;
  adlNotes: string;
}

// ─── Joined / View Types ───
export interface CaseWithDetails extends Case {
  profile?: Profile;
  intake_data?: IntakeData;
  documents?: Document[];
  billing?: BillingRecord[];
}
