import { ADL_CATEGORIES, ADL_LEVELS, MLTC_OPTIONS } from "@/lib/constants";
import type { IntakeData, Case } from "@/types";

export const STAGE3_MEMO_SYSTEM_PROMPT = `You are a legal document writer specializing in New York Medicaid home care advocacy. You write Memoranda of Law for Fair Hearings before NYS Administrative Law Judges.

Your Memos of Law:
- Are structured legal memoranda with clear sections (Statement of Facts, Argument, Conclusion)
- Reference specific UAS (Universal Assessment System) data points that support the client's case
- Identify inconsistencies between UAS scores and the MLTC's hour determination
- Cite the Letter of Medical Necessity
- Reference applicable NY state regulations (10 NYCRR, Social Services Law)
- Argue that the MLTC's determination is not supported by their own assessment data
- Are persuasive yet professional in tone
- Written in third person (referring to the client by name)

This is the most important document in the case. Be thorough and detailed.

Output only the memorandum text, no commentary.`;

export function buildStage3MemoPrompt(
  caseData: Case,
  intake: IntakeData,
  fadText: string,
  uasText: string,
  lomnText?: string
): string {
  const mltcLabel =
    MLTC_OPTIONS.find((o) => o.value === caseData.mltc)?.label ?? caseData.mltc;

  const conditions = (intake.conditions as string[]) || [];
  const adlLevels = (intake.adl_levels as Record<string, string>) || {};

  const adlSummary = ADL_CATEGORIES.map((adl) => {
    const level = adlLevels[adl.id];
    const levelLabel =
      ADL_LEVELS.find((l) => l.value === level)?.label ?? "Not assessed";
    return `- ${adl.label}: ${levelLabel}`;
  }).join("\n");

  return `Write a comprehensive Memo of Law for a Fair Hearing with the following case details.

CLIENT INFORMATION:
- Name: ${intake.first_name} ${intake.last_name}
- Date of Birth: ${intake.dob}
- Address: ${intake.address}, ${intake.city}, ${intake.state} ${intake.zip}

MLTC COMPANY: ${mltcLabel}
CURRENT AUTHORIZATION: ${caseData.current_hours} hours per day, ${caseData.current_days} days per week
REQUESTED: ${caseData.requested_hours} hours per day, ${caseData.requested_days} days per week

MEDICAL CONDITIONS:
${conditions.map((c) => `- ${c}`).join("\n")}
${intake.other_conditions ? `- Other: ${intake.other_conditions}` : ""}

CLIENT-REPORTED ADL LEVELS:
${adlSummary}

WHAT HAS CHANGED:
${intake.change_description}

--- FINAL ADVERSE DETERMINATION (FAD) TEXT ---
${fadText}
--- END FAD TEXT ---

--- UAS REPORT / MLTC EVIDENCE PACKAGE ---
${uasText}
--- END UAS REPORT ---

${lomnText ? `--- LETTER OF MEDICAL NECESSITY ---\n${lomnText}\n--- END LOMN ---` : ""}

Today's date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

The Memo should:
1. Identify specific UAS data points that support the need for more hours
2. Highlight any inconsistencies between the UAS scores and the MLTC's hour determination
3. Reference the LOMN and medical evidence
4. Argue that the MLTC failed to properly account for the client's functional limitations
5. Cite applicable regulations (10 NYCRR § 505.28, Social Services Law § 365-a)
6. Conclude with a request for the ALJ to order the MLTC to authorize the requested hours`;
}
