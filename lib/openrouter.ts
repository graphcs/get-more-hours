import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";

export async function generateDocument(
  systemPrompt: string,
  userPrompt: string,
  model?: string
): Promise<string> {
  const response = await client.chat.completions.create({
    model: model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4000,
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content returned from AI model");
  }

  return content;
}
