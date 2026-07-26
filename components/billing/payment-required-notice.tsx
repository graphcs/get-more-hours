"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { PaymentRequiredInfo } from "@/lib/billing/payment-required";

interface PaymentRequiredNoticeProps {
  info: PaymentRequiredInfo;
  className?: string;
  size?: "sm" | "default";
}

/**
 * Inline surface for a 402 from the stage payment gate. Always renders a real
 * "Pay now" link built from the guard's `redirectUrl`, so a blocked action is
 * one click from being unblocked instead of a dead end.
 */
export function PaymentRequiredNotice({
  info,
  className = "",
  size = "default",
}: PaymentRequiredNoticeProps) {
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 p-3 ${className}`}
    >
      <div className="flex items-start gap-2">
        <CreditCard className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p
            className={`text-amber-900 ${size === "sm" ? "text-xs" : "text-sm"}`}
          >
            {info.message}
          </p>
          <Link
            href={info.redirectUrl}
            className={buttonVariants({
              size: "sm",
              className: "mt-2 text-xs",
            })}
          >
            Pay now
          </Link>
        </div>
      </div>
    </div>
  );
}
