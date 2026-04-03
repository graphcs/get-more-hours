"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface LetterViewerProps {
  content: string;
  documentId: string;
  onContentSaved?: (newContent: string) => void;
}

export function LetterViewer({
  content,
  documentId,
  onContentSaved,
}: LetterViewerProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);

  const wordCount = editContent
    .split(/\s+/)
    .filter(Boolean).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });

      if (res.ok) {
        setEditing(false);
        onContentSaved?.(editContent);
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex gap-1">
          {editing ? (
            <>
              {["Bold", "Italic", "Underline"].map((b) => (
                <button
                  key={b}
                  className="px-2.5 py-1 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded cursor-pointer hover:bg-gray-100"
                >
                  {b}
                </button>
              ))}
            </>
          ) : (
            <span className="text-sm text-gray-400">
              Read-only · Click &ldquo;Edit Letter&rdquo; to make changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <span className="text-xs text-gray-400">{wordCount} words</span>
          )}
          {editing ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditContent(content);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Save Changes
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setEditing(true)}>
              Edit Letter
            </Button>
          )}
        </div>
      </div>

      {/* Letter content */}
      <div className="flex-1 overflow-auto flex justify-center p-7 bg-gray-100">
        <div className="w-full max-w-[620px] bg-white rounded-sm shadow-md p-12 min-h-[600px]">
          {editing ? (
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[550px] border-none outline-none resize-none text-sm leading-7 text-slate-700 font-serif bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          ) : (
            <div className="text-sm leading-7 text-slate-700 font-serif whitespace-pre-wrap">
              {content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
