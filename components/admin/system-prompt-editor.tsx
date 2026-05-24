"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, Save } from "lucide-react";

interface PromptState {
  key: string;
  name: string;
  description: string;
  content: string;
  customContent: string | null;
  defaultContent: string;
  isCustom: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface SystemPromptEditorProps {
  initialPrompts: PromptState[];
}

export function SystemPromptEditor({
  initialPrompts,
}: SystemPromptEditorProps) {
  const [prompts, setPrompts] = useState(initialPrompts);
  const [selectedKey, setSelectedKey] = useState(initialPrompts[0]?.key ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const selectedPrompt =
    prompts.find((prompt) => prompt.key === selectedKey) ?? prompts[0];

  const content = selectedPrompt?.content ?? "";
  const savedContent =
    selectedPrompt?.customContent || selectedPrompt?.defaultContent || "";
  const hasChanges = content.trim() !== savedContent.trim();

  function updatePrompt(key: string, updates: Partial<PromptState>) {
    setPrompts((current) =>
      current.map((prompt) =>
        prompt.key === key ? { ...prompt, ...updates } : prompt
      )
    );
  }

  const updatedLabel = useMemo(() => {
    if (!selectedPrompt?.updatedAt) return null;
    return new Date(selectedPrompt.updatedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [selectedPrompt?.updatedAt]);

  async function handleSave() {
    if (!selectedPrompt) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/system-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: selectedPrompt.key, content }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to save prompt");

      updatePrompt(selectedPrompt.key, body);
      toast.success("Prompt saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save prompt");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!selectedPrompt) return;
    setResetting(true);
    try {
      const params = new URLSearchParams({ key: selectedPrompt.key });
      const res = await fetch(`/api/admin/system-prompt?${params}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to reset prompt");

      updatePrompt(selectedPrompt.key, body);
      toast.success("Prompt reset");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset prompt");
    } finally {
      setResetting(false);
    }
  }

  if (!selectedPrompt) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden h-fit">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold text-foreground">
            Prompts
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {prompts.map((prompt) => {
            const active = prompt.key === selectedPrompt.key;
            return (
              <button
                key={prompt.key}
                type="button"
                onClick={() => setSelectedKey(prompt.key)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  active ? "bg-primary/10" : "hover:bg-muted/60"
                }`}
              >
                <div
                  className={`text-sm font-semibold ${
                    active ? "text-primary" : "text-foreground"
                  }`}
                >
                  {prompt.name}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
                  {prompt.description}
                </div>
                {prompt.isCustom && (
                  <span className="inline-flex mt-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-blue-50 text-primary border-blue-200">
                    Custom
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">
              {selectedPrompt.name}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {updatedLabel
                ? `Last updated ${updatedLabel}`
                : selectedPrompt.description}
            </p>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              selectedPrompt.isCustom
                ? "bg-blue-50 text-primary border-blue-200"
                : "bg-gray-100 text-gray-500 border-gray-200"
            }`}
          >
            {selectedPrompt.isCustom ? "Custom" : "Default"}
          </span>
        </div>

        <div className="p-6">
          <Textarea
            value={content}
            onChange={(e) =>
              updatePrompt(selectedPrompt.key, { content: e.target.value })
            }
            className="min-h-[420px] resize-y bg-white font-mono text-sm leading-6"
            aria-label="System prompt"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-gray-400">
              {content.length.toLocaleString()} characters
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={
                  saving ||
                  resetting ||
                  (!selectedPrompt.isCustom && !hasChanges)
                }
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {resetting ? "Resetting..." : "Reset to Default"}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || resetting || content.trim().length === 0}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save Prompt"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
