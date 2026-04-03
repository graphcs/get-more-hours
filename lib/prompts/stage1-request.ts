import { ADL_CATEGORIES, ADL_LEVELS, MLTC_OPTIONS } from "@/lib/constants";
import type { IntakeData, Case } from "@/types";

export const STAGE1_REQUEST_SYSTEM_PROMPT = `You are a legal document writer specializing in New York Medicaid home care advocacy. You write formal letters requesting increases in home care hours from Managed Long Term Care (MLTC) companies on behalf of Community Medicaid recipients.

Your letters are:
- Formal and respectful but firm
- Fact-based, citing specific medical conditions and functional limitations
- Structured with clear sections (current situation, medical conditions, ADL dependencies, recent changes)
- Persuasive, making a clear case for why current hours are insufficient

Write the letter as if the client is writing it themselves (first person). Do NOT include any bracketed placeholders. Use the provided data directly. Output only the letter text, no commentary.`;

export function buildStage1RequestPrompt(
  caseData: Case,
  intake: IntakeData
): string {
  const mltcLabel =
    MLTC_OPTIONS.find((o) => o.value === caseData.mltc)?.label ?? caseData.mltc;

  const conditions = (intake.conditions as string[]) || [];
  const adlLevels = (intake.adl_levels as Record<string, string>) || {};

  const conditionsList = conditions
    .map((c) => `- ${c}`)
    .join("\n");

  const adlDetails = ADL_CATEGORIES.map((adl) => {
    const level = adlLevels[adl.id];
    const levelLabel =
      ADL_LEVELS.find((l) => l.value === level)?.label ?? "Not assessed";
    return `- ${adl.label}: ${levelLabel}`;
  }).join("\n");

  const fullHelpAdls = ADL_CATEGORIES.filter(
    (a) => adlLevels[a.id] === "full_help"
  ).map((a) => a.label);

  const someHelpAdls = ADL_CATEGORIES.filter(
    (a) => adlLevels[a.id] === "some_help"
  ).map((a) => a.label);

  return `Write a formal Request for Increase in Plan of Care letter with the following details:

CLIENT INFORMATION:
- Name: ${intake.first_name} ${intake.last_name}
- Address: ${intake.address}, ${intake.city}, ${intake.state} ${intake.zip}
- Date of Birth: ${intake.dob}
- Phone: ${intake.phone || "N/A"}

MLTC COMPANY: ${mltcLabel}

CURRENT AUTHORIZATION: ${caseData.current_hours} hours per day, ${caseData.current_days} days per week
REQUESTING: ${caseData.requested_hours} hours per day, ${caseData.requested_days} days per week

MEDICAL CONDITIONS:
${conditionsList}
${intake.other_conditions ? `- Other: ${intake.other_conditions}` : ""}

ACTIVITIES OF DAILY LIVING ASSESSMENT:
${adlDetails}

Activities requiring FULL assistance: ${fullHelpAdls.join(", ") || "None"}
Activities requiring SOME assistance: ${someHelpAdls.join(", ") || "None"}

WHAT HAS CHANGED RECENTLY:
${intake.change_description}

${intake.adl_notes ? `ADDITIONAL NOTES:\n${intake.adl_notes}` : ""}

Today's date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

Write the letter addressed to the Care Management Department of ${mltcLabel}. Include today's date at the top. The letter should be signed by ${intake.first_name} ${intake.last_name} with their address.`;
}
