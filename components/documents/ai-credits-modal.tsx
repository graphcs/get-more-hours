"use client";

import { useEffect } from "react";
import { CreditCard, ExternalLink, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { OPENROUTER_CREDITS_URL, aiErrorInfoForCode } from "@/lib/ai-errors";

interface AiCreditsModalProps {
  open: boolean;
  onClose: () => void;
  /** Raw provider error, shown as staff detail. Optional. */
  rawError?: string | null;
}

/**
 * Operator-facing modal for the one AI failure a human can fix in a minute:
 * the OpenRouter account is out of credit.
 *
 * Rendered for admins only. Clients see the neutral "credits exhausted" copy
 * from lib/ai-errors instead — they can't top up the provider account and
 * shouldn't see our vendor billing state.
 */
export function AiCreditsModal({ open, onClose, rawError }: AiCreditsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const info = aiErrorInfoForCode("insufficient_credits");
  const action = info.operatorAction;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-credits-modal-title"
      data-testid="ai-credits-modal"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200 p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-2 text-red-700">
          <CreditCard className="h-5 w-5" />
          <h3 id="ai-credits-modal-title" className="text-base font-semibold">
            {info.title}
          </h3>
        </div>

        <p className="text-sm text-gray-700 mb-3">
          OpenRouter rejected the request because the account has no credit
          left. Every document generation and OCR run will keep failing until
          it&apos;s topped up.
        </p>

        <ol className="text-sm text-gray-600 space-y-1.5 mb-5 list-decimal pl-5">
          <li>
            Open the OpenRouter credits page and add funds to the account that
            owns <code className="text-xs">OPENROUTER_API_KEY</code>.
          </li>
          <li>
            If the balance looks fine, check the daily spend cap on the same
            page — a reached cap reports as insufficient credit.
          </li>
          <li>
            Come back and press <strong>Try again</strong>. No redeploy or
            config change is needed; the next request picks up the new balance.
          </li>
        </ol>

        <div className="flex items-center gap-2">
          <a
            href={action?.href ?? OPENROUTER_CREDITS_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="ai-credits-modal-link"
            className={buttonVariants()}
          >
            {action?.label ?? "Add OpenRouter credits"}
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </a>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        {rawError && (
          <p className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 break-words">
            Staff detail: {rawError}
          </p>
        )}
      </div>
    </div>
  );
}
