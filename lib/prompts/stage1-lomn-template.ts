import { MLTC_OPTIONS } from "@/lib/constants";
import type { IntakeData, Case } from "@/types";

export const STAGE1_LOMN_SYSTEM_PROMPT = `You are a legal document writer specializing in New York Medicaid home care advocacy. You create Letter of Medical Necessity (LOMN) request templates that patients send to their doctors, asking them to write an LOMN supporting a request for more home care hours.

The template should:
- Be addressed to the client's doctor (use "Dear Doctor" as a generic salutation since we may not have the doctor's name)
- Clearly explain what an LOMN is and why it's needed
- List the specific points the LOMN should address
- Be professional but easy for a senior to understand
- Be written from the client's perspective (first person)

Output only the letter text, no commentary.`;

export function buildStage1LomnPrompt(
  caseData: Case,
  intake: IntakeData
): string {
  const mltcLabel =
    MLTC_OPTIONS.find((o) => o.value === caseData.mltc)?.label ?? caseData.mltc;

  const conditions = (intake.conditions as string[]) || [];

  return `Write a Letter of Medical Necessity (LOMN) request template with the following details:

CLIENT INFORMATION:
- Name: ${intake.first_name} ${intake.last_name}
- Date of Birth: ${intake.dob}

MLTC COMPANY: ${mltcLabel}
CURRENT HOURS: ${caseData.current_hours} hours per day, ${caseData.current_days} days per week
REQUESTED HOURS: ${caseData.requested_hours} hours per day, ${caseData.requested_days} days per week

MEDICAL CONDITIONS:
${conditions.map((c) => `- ${c}`).join("\n")}
${intake.other_conditions ? `- Other: ${intake.other_conditions}` : ""}

WHAT HAS CHANGED RECENTLY:
${intake.change_description}

Today's date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

The template should ask the doctor to write a Letter of Medical Necessity that addresses:
1. Current medical diagnoses and disease progression
2. Impact on Activities of Daily Living
3. Why current authorized hours are insufficient
4. Medical necessity for the requested increase
5. Any safety concerns if hours are not increased

Sign the letter as ${intake.first_name} ${intake.last_name}.`;
}
