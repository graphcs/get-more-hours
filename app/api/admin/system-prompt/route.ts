import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { systemPromptSchema } from "@/lib/validations";
import {
  PROMPT_CONFIGS,
  PROMPT_KEYS,
  getPromptConfig,
  type PromptKey,
} from "@/lib/prompts";
import type { AiPrompt } from "@/types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      supabase,
      user,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, user, response: null };
}

function isPromptKey(value: string | null): value is PromptKey {
  return Boolean(value && PROMPT_KEYS.includes(value as PromptKey));
}

function promptPayload(key: PromptKey, prompt: AiPrompt | null) {
  const config = getPromptConfig(key)!;
  const customPrompt = prompt?.content?.trim() || "";

  return {
    key,
    name: config.name,
    description: config.description,
    content: customPrompt || config.defaultContent,
    customContent: customPrompt || null,
    defaultContent: config.defaultContent,
    isCustom: Boolean(customPrompt),
    updatedAt: prompt?.updated_at ?? null,
    updatedBy: prompt?.updated_by ?? null,
  };
}

export async function GET() {
  const { supabase, response } = await requireAdmin();
  if (response) return response;

  const { data, error } = await supabase
    .from("ai_prompts")
    .select("*")
    .in("key", [...PROMPT_KEYS]);

  if (error) {
    console.error("System prompt fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompt" },
      { status: 500 }
    );
  }

  const rows = ((data as AiPrompt[] | null) ?? []).reduce<
    Partial<Record<PromptKey, AiPrompt>>
  >((acc, prompt) => {
    acc[prompt.key] = prompt;
    return acc;
  }, {});

  return NextResponse.json({
    prompts: PROMPT_CONFIGS.map((config) =>
      promptPayload(config.key, rows[config.key] ?? null)
    ),
  });
}

export async function PUT(req: Request) {
  const { supabase, user, response } = await requireAdmin();
  if (response) return response;

  const parsed = systemPromptSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const config = getPromptConfig(parsed.data.key);
  if (!config) {
    return NextResponse.json({ error: "Unknown prompt" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ai_prompts")
    .upsert(
      {
        key: parsed.data.key,
        content: parsed.data.content,
        updated_by: user!.id,
      },
      { onConflict: "key" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("System prompt save error:", error);
    return NextResponse.json(
      { error: "Failed to save prompt" },
      { status: 500 }
    );
  }

  return NextResponse.json(promptPayload(parsed.data.key, data as AiPrompt));
}

export async function DELETE(req: Request) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;

  const key = new URL(req.url).searchParams.get("key");
  if (!isPromptKey(key)) {
    return NextResponse.json({ error: "Unknown prompt" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ai_prompts")
    .delete()
    .eq("key", key);

  if (error) {
    console.error("System prompt reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset prompt" },
      { status: 500 }
    );
  }

  return NextResponse.json(promptPayload(key, null));
}
