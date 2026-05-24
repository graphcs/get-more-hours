import type { SupabaseClient } from "@supabase/supabase-js";
import { STAGE1_REQUEST_SYSTEM_PROMPT } from "./stage1-request";
import { STAGE1_LOMN_SYSTEM_PROMPT } from "./stage1-lomn-template";
import { STAGE2_APPEAL_SYSTEM_PROMPT } from "./stage2-appeal";
import { STAGE3_HEARING_SYSTEM_PROMPT } from "./stage3-hearing-request";
import { STAGE3_MEMO_SYSTEM_PROMPT } from "./stage3-memo-of-law";
import { OCR_EXTRACTION_PROMPT } from "./ocr";

export const PROMPT_CONFIGS = [
  {
    key: "stage1_request_system",
    name: "Request for Increase Letter",
    description: "Writes the Stage 1 request letter from client intake data.",
    defaultContent: STAGE1_REQUEST_SYSTEM_PROMPT,
  },
  {
    key: "stage1_lomn_system",
    name: "LOMN Request Template",
    description: "Writes the template clients send to doctors for an LOMN.",
    defaultContent: STAGE1_LOMN_SYSTEM_PROMPT,
  },
  {
    key: "stage2_appeal_system",
    name: "Internal Appeal Letter",
    description: "Writes Stage 2 appeals using IAD text and case data.",
    defaultContent: STAGE2_APPEAL_SYSTEM_PROMPT,
  },
  {
    key: "stage3_hearing_system",
    name: "Fair Hearing Request",
    description: "Writes the NYS OTDA fair hearing request.",
    defaultContent: STAGE3_HEARING_SYSTEM_PROMPT,
  },
  {
    key: "stage3_memo_system",
    name: "Memo of Law",
    description: "Writes the fair hearing legal memorandum.",
    defaultContent: STAGE3_MEMO_SYSTEM_PROMPT,
  },
  {
    key: "ocr_extraction",
    name: "OCR Extraction",
    description: "Extracts text from uploaded PDFs and images.",
    defaultContent: OCR_EXTRACTION_PROMPT,
  },
] as const;

export type PromptKey = (typeof PROMPT_CONFIGS)[number]["key"];

export const PROMPT_KEYS = PROMPT_CONFIGS.map((prompt) => prompt.key) as [
  PromptKey,
  ...PromptKey[],
];

export function getPromptConfig(key: string) {
  return PROMPT_CONFIGS.find((prompt) => prompt.key === key);
}

export async function getAiSystemPrompt(
  client: SupabaseClient,
  key: PromptKey
): Promise<string> {
  const config = getPromptConfig(key);
  if (!config) return "";

  const { data, error } = await client
    .from("ai_prompts")
    .select("content")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error(`[prompts] failed to load custom prompt ${key}:`, error);
    return config.defaultContent;
  }

  const customPrompt =
    typeof data?.content === "string" ? data.content.trim() : "";

  return customPrompt || config.defaultContent;
}
