"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/constants";
import {
  billingUrlForStage,
  paymentRequiredFrom,
} from "@/lib/billing/payment-required";

interface PayToGenerateCardProps {
  caseId: string;
  stage: number;
  /** Stage fee in cents. */
  amount: number;
  /** Copy tuned to what is actually blocked at this stage. */
  headline?: string;
  body?: string;
}

/**
 * Unmissable blocking card shown wherever documents are gated behind an unpaid
 * stage fee.
 *
 * This replaces the perpetual "GENERATING" spinner. Generation never starts
 * until the stage fee is paid, so a spinner was a lie — in production 17
 * documents sat at `generation_status: 'pending'` behind it while 10 stage-1
 * fees stayed unpaid, with nothing anywhere telling the client to pay.
 */
export function PayToGenerateCard({
  caseId,
  stage,
  amount,
  headline,
  body,
}: PayToGenerateCardProps) {
  const [loading, setLoading] = useState(false);
  const price = `$${(amount / 100).toFixed(0)}`;

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, stage }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const blocked = paymentRequiredFrom(res, payload);
        if (blocked) {
          window.location.href = blocked.redirectUrl;
          return;
        }
        throw new Error(payload.error || "Could not start checkout");
      }

      if (!payload.url) throw new Error("Could not start checkout");
      window.location.href = payload.url as string;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start checkout"
      );
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-5 px-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <Lock className="h-5 w-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-amber-900">
            {headline ?? "Pay to generate your letters"}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
            {body ??
              `Your Stage ${stage} documents (${STAGE_LABELS[stage] ?? "your letters"}) are ready to be written, but we can't start until the ${price} stage fee is paid. Nothing is generating right now.`}
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <Button onClick={handlePay} disabled={loading} className="gap-1.5">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {loading ? "Opening checkout…" : `Pay ${price} & start now`}
            </Button>
            <Link
              href={billingUrlForStage(stage)}
              className={buttonVariants({ variant: "outline" })}
            >
              View billing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
