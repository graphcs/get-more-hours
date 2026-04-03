import { MLTC_OPTIONS } from "@/lib/constants";
import type { IntakeData, Case } from "@/types";

export const STAGE3_HEARING_SYSTEM_PROMPT = `You are a legal document writer specializing in New York Medicaid home care advocacy. You write Fair Hearing requests to the New York State Office of Temporary and Disability Assistance (OTDA).

Your Fair Hearing requests:
- Follow the formal format required by NYS OTDA
- Clearly state what determination is being challenged
- Reference the Final Adverse Determination (FAD)
- State the requested remedy (specific hour increase)
- Are concise and factual
- Written from the client's perspective (first person)

Output only the letter/request text, no commentary.`;

export function buildStage3HearingPrompt(
  caseData: Case,
  intake: IntakeData,
  fadText: string
): string {
  const mltcLabel =
    MLTC_OPTIONS.find((o) => o.value === caseData.mltc)?.label ?? caseData.mltc;

  return `Write a formal Fair Hearing request to the New York State Office of Temporary and Disability Assistance (OTDA).

CLIENT INFORMATION:
- Name: ${intake.first_name} ${intake.last_name}
- Address: ${intake.address}, ${intake.city}, ${intake.state} ${intake.zip}
- Phone: ${intake.phone || "N/A"}

MLTC COMPANY: ${mltcLabel}
CURRENT AUTHORIZATION: ${caseData.current_hours} hours per day, ${caseData.current_days} days per week
REQUESTED: ${caseData.requested_hours} hours per day, ${caseData.requested_days} days per week

--- FINAL ADVERSE DETERMINATION (FAD) TEXT ---
${fadText}
--- END FAD TEXT ---

Today's date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

The request should be addressed to:
NYS Office of Temporary and Disability Assistance
Office of Administrative Hearings
P.O. Box 1930
Albany, NY 12201

Request that a Fair Hearing be held to review ${mltcLabel}'s Final Adverse Determination denying the increase in home care hours. Sign as ${intake.first_name} ${intake.last_name}.`;
}
