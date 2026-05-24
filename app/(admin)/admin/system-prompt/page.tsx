import { createClient } from "@/lib/supabase/server";
import { PROMPT_CONFIGS, type PromptKey } from "@/lib/prompts";
import { SystemPromptEditor } from "@/components/admin/system-prompt-editor";
import type { AiPrompt } from "@/types";

export default async function AdminSystemPromptPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_prompts")
    .select("*")
    .in(
      "key",
      PROMPT_CONFIGS.map((prompt) => prompt.key)
    );

  const promptsByKey = ((data as AiPrompt[] | null) ?? []).reduce<
    Partial<Record<PromptKey, AiPrompt>>
  >((acc, prompt) => {
    acc[prompt.key] = prompt;
    return acc;
  }, {});

  const prompts = PROMPT_CONFIGS.map((config) => {
    const prompt = promptsByKey[config.key] ?? null;
    const customContent = prompt?.content?.trim() || "";
    return {
      key: config.key,
      name: config.name,
      description: config.description,
      content: customContent || config.defaultContent,
      customContent: customContent || null,
      defaultContent: config.defaultContent,
      isCustom: Boolean(customContent),
      updatedAt: prompt?.updated_at ?? null,
      updatedBy: prompt?.updated_by ?? null,
    };
  });

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">System Prompt</h1>
        <p className="text-muted-foreground mt-0.5">
          Customize AI instructions for generated documents and OCR
        </p>
      </div>

      <SystemPromptEditor initialPrompts={prompts} />
    </div>
  );
}
