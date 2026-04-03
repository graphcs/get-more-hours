import { MLTC_OPTIONS } from "@/lib/constants";
import type { IntakeData, Case } from "@/types";

export const STAGE2_APPEAL_SYSTEM_PROMPT = `You are a legal document writer specializing in New York Medicaid home care advocacy. You write Internal Appeal letters challenging Initial Adverse Determinations (IADs) issued by Managed Long Term Care (MLTC) companies.

Your appeal letters:
- Address each specific point of denial from the IAD
- Reference the client's medical conditions and functional limitations as counter-evidence
- Cite the Letter of Medical Necessity if available
- Are structured as point-by-point rebuttals
- Use formal, respectful but assertive language
- Reference applicable NY state regulations where appropriate
- Written from the client's perspective (first person)

Output only the letter text, no commentary.`;

export function buildStage2AppealPrompt(
  caseData: Case,
  intake: IntakeData,
  iadText: string,
  lomnText?: string
): string {
  const mltcLabel =
    MLTC_OPTIONS.find((o) => o.value === caseData.mltc)?.label ?? caseData.mltc;

  const conditions = (intake.conditions as string[]) || [];

  return `Write a formal Internal Appeal letter challenging the following Initial Adverse Determination.

CLIENT INFORMATION:
- Name: ${intake.first_name} ${intake.last_name}
- Address: ${intake.address}, ${intake.city}, ${intake.state} ${intake.zip}

MLTC COMPANY: ${mltcLabel}
CURRENT AUTHORIZATION: ${caseData.current_hours} hours per day, ${caseData.current_days} days per week
REQUESTED: ${caseData.requested_hours} hours per day, ${caseData.requested_days} days per week

MEDICAL CONDITIONS:
${conditions.map((c) => `- ${c}`).join("\n")}
${intake.other_conditions ? `- Other: ${intake.other_conditions}` : ""}

WHAT HAS CHANGED RECENTLY:
${intake.change_description}

--- INITIAL ADVERSE DETERMINATION (IAD) TEXT ---
${iadText}
--- END IAD TEXT ---

${lomnText ? `--- LETTER OF MEDICAL NECESSITY TEXT ---\n${lomnText}\n--- END LOMN TEXT ---` : ""}

Today's date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

Write the appeal letter addressed to the Appeals Department of ${mltcLabel}. For each reason cited in the IAD for denial, provide a specific counter-argument referencing the client's medical conditions, functional limitations, and medical evidence. The letter should be signed by ${intake.first_name} ${intake.last_name}.`;
}
